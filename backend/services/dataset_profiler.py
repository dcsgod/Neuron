"""
Dataset Profiler — uses DuckDB to analyze CSV/Parquet/JSON files.
Detects schema, task type, issues, and recommends models.
"""
import duckdb
import json
from pathlib import Path
from typing import Dict, Any, List, Optional


def profile_dataset(file_path: str) -> Dict[str, Any]:
    """
    Profile a dataset file and return a comprehensive analysis.
    Supports: CSV, Parquet, JSON Lines.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {file_path}")

    ext = path.suffix.lower()
    conn = duckdb.connect(database=":memory:")

    try:
        # Load data
        if ext == ".csv":
            conn.execute(f"CREATE VIEW data AS SELECT * FROM read_csv_auto('{file_path}', header=true)")
        elif ext in (".parquet", ".pq"):
            conn.execute(f"CREATE VIEW data AS SELECT * FROM read_parquet('{file_path}')")
        elif ext == ".json":
            conn.execute(f"CREATE VIEW data AS SELECT * FROM read_json_auto('{file_path}')")
        elif ext == ".jsonl":
            conn.execute(f"CREATE VIEW data AS SELECT * FROM read_ndjson_auto('{file_path}')")
        else:
            raise ValueError(f"Unsupported format: {ext}")

        # Basic stats
        row_count = conn.execute("SELECT COUNT(*) FROM data").fetchone()[0]
        columns_raw = conn.execute("DESCRIBE data").fetchall()
        columns = [{"name": c[0], "type": c[1]} for c in columns_raw]
        col_names = [c["name"] for c in columns]

        # Sample rows
        sample = conn.execute("SELECT * FROM data LIMIT 5").fetchall()
        sample_dicts = [dict(zip(col_names, row)) for row in sample]
        # Make JSON-safe
        sample_dicts = [
            {k: (str(v) if not isinstance(v, (int, float, bool, type(None))) else v)
             for k, v in row.items()}
            for row in sample_dicts
        ]

        # Missing values per column
        missing_parts = ", ".join([
            f"COUNT(*) - COUNT({c['name']}) AS {c['name']}"
            for c in columns
        ])
        missing_row = conn.execute(f"SELECT {missing_parts} FROM data").fetchone()
        missing = {col_names[i]: int(missing_row[i]) for i in range(len(col_names))}
        total_missing = sum(missing.values())

        # Numeric column stats
        numeric_cols = [c["name"] for c in columns if _is_numeric(c["type"])]
        numeric_stats = {}
        for col in numeric_cols[:10]:  # limit to 10
            try:
                stats = conn.execute(
                    f"SELECT MIN({col}), MAX({col}), AVG({col}), STDDEV({col}) FROM data"
                ).fetchone()
                numeric_stats[col] = {
                    "min": round(float(stats[0]), 4) if stats[0] is not None else None,
                    "max": round(float(stats[1]), 4) if stats[1] is not None else None,
                    "mean": round(float(stats[2]), 4) if stats[2] is not None else None,
                    "std": round(float(stats[3]), 4) if stats[3] is not None else None,
                }
            except Exception:
                pass

        # Detect target column + task type
        task_type, target_col, issues, recommendations = _detect_task(
            conn, columns, numeric_cols, col_names, row_count, missing
        )

        return {
            "name": path.name,
            "path": file_path,
            "format": ext,
            "rows": row_count,
            "columns": columns,
            "column_count": len(columns),
            "sample": sample_dicts,
            "missing_values": missing,
            "total_missing": total_missing,
            "missing_pct": round(total_missing / max(row_count * len(columns), 1) * 100, 2),
            "numeric_stats": numeric_stats,
            "task_type": task_type,
            "target_column": target_col,
            "issues": issues,
            "recommendations": recommendations,
        }

    finally:
        conn.close()


def _is_numeric(dtype: str) -> bool:
    dtype = dtype.upper()
    return any(t in dtype for t in ["INT", "FLOAT", "DOUBLE", "DECIMAL", "NUMERIC", "REAL", "BIGINT"])


def _detect_task(
    conn, columns, numeric_cols, col_names, row_count, missing
) -> tuple:
    issues = []
    recommendations = []
    task_type = "unknown"
    target_col = None

    # Heuristic: find likely target column
    target_keywords = ["target", "label", "class", "y", "output", "result",
                       "churn", "fraud", "default", "survived", "price", "salary"]
    for col in reversed(col_names):  # last cols more likely to be target
        if col.lower() in target_keywords or any(k in col.lower() for k in target_keywords):
            target_col = col
            break
    if not target_col and col_names:
        target_col = col_names[-1]

    # Check task type
    if target_col:
        try:
            distinct = conn.execute(f"SELECT COUNT(DISTINCT {target_col}) FROM data").fetchone()[0]
            if distinct <= 20:
                task_type = "classification"
                # Check class imbalance
                dist = conn.execute(
                    f"SELECT {target_col}, COUNT(*) as cnt FROM data GROUP BY {target_col} ORDER BY cnt"
                ).fetchall()
                if len(dist) >= 2:
                    min_cls = dist[0][1]
                    max_cls = dist[-1][1]
                    if max_cls / max(min_cls, 1) > 5:
                        issues.append(f"Class imbalance detected (ratio {max_cls/max(min_cls,1):.1f}x). Consider oversampling.")
            else:
                task_type = "regression"
        except Exception:
            pass

    # Missing value warnings
    high_missing = [col for col, cnt in missing.items() if cnt / max(row_count, 1) > 0.2]
    if high_missing:
        issues.append(f"High missing values (>20%) in: {', '.join(high_missing[:5])}")

    # Leakage heuristic
    leakage_keywords = ["id", "uuid", "key", "index", "timestamp", "date", "time"]
    leakage_suspects = [
        c for c in col_names
        if any(k in c.lower() for k in leakage_keywords) and c != target_col
    ]
    if leakage_suspects:
        issues.append(f"Possible leakage columns detected: {', '.join(leakage_suspects[:3])}")

    # Recommendations
    if task_type == "classification":
        recommendations = [
            {"model": "LightGBM", "reason": "Fast gradient boosting, handles imbalance well"},
            {"model": "XGBoost", "reason": "Strong baseline for tabular classification"},
            {"model": "CatBoost", "reason": "Handles categorical features natively"},
            {"model": "Random Forest", "reason": "Robust, interpretable ensemble method"},
        ]
    elif task_type == "regression":
        recommendations = [
            {"model": "XGBoost Regressor", "reason": "Top performer on tabular regression"},
            {"model": "LightGBM Regressor", "reason": "Fast, efficient gradient boosting"},
            {"model": "Ridge Regression", "reason": "Strong linear baseline"},
            {"model": "Neural Network", "reason": "Non-linear patterns in large datasets"},
        ]
    else:
        recommendations = [{"model": "Exploratory Analysis", "reason": "Task type unclear, explore first"}]

    return task_type, target_col, issues, recommendations
