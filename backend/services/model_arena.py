"""
Model Arena — benchmarks multiple ML models on a dataset
and returns a ranked leaderboard.
"""
import time
import json
from pathlib import Path
from typing import Any, Dict, List, Optional, AsyncGenerator
import asyncio

import duckdb
import numpy as np


def _load_data(file_path: str, target_col: str):
    """Load dataset with DuckDB and return X, y arrays."""
    path = Path(file_path)
    ext = path.suffix.lower()
    conn = duckdb.connect(":memory:")
    if ext == ".csv":
        conn.execute(f"CREATE VIEW data AS SELECT * FROM read_csv_auto('{file_path}', header=true)")
    elif ext in (".parquet", ".pq"):
        conn.execute(f"CREATE VIEW data AS SELECT * FROM read_parquet('{file_path}')")
    else:
        raise ValueError(f"Unsupported format: {ext}")

    cols = [c[0] for c in conn.execute("DESCRIBE data").fetchall()]
    feature_cols = [c for c in cols if c != target_col]

    df_data = conn.execute(f"SELECT * FROM data LIMIT 10000").fetchdf()
    conn.close()

    # Simple numeric-only for now
    X = df_data[feature_cols].select_dtypes(include=["number"]).fillna(0).values
    y = df_data[target_col].values
    return X, y, feature_cols


async def run_arena(
    file_path: str,
    target_col: str,
    task_type: str = "classification",
    test_size: float = 0.2,
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Run model arena benchmark. Yields progress events then final leaderboard.
    """
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import StandardScaler
    from sklearn.metrics import (
        accuracy_score, f1_score, roc_auc_score,
        mean_squared_error, r2_score, mean_absolute_error
    )
    from sklearn.linear_model import LogisticRegression, Ridge, Lasso
    from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor, GradientBoostingClassifier
    from sklearn.svm import LinearSVC
    from sklearn.naive_bayes import GaussianNB

    yield {"type": "status", "message": "Loading dataset..."}
    await asyncio.sleep(0)

    try:
        X, y, features = _load_data(file_path, target_col)
    except Exception as e:
        yield {"type": "error", "message": str(e)}
        return

    yield {"type": "status", "message": f"Dataset loaded: {X.shape[0]} rows × {X.shape[1]} features"}
    await asyncio.sleep(0)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42)
    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    # Model registry
    if task_type == "classification":
        models = [
            ("Logistic Regression", LogisticRegression(max_iter=500, random_state=42)),
            ("Random Forest", RandomForestClassifier(n_estimators=100, random_state=42)),
            ("Gradient Boosting", GradientBoostingClassifier(n_estimators=100, random_state=42)),
            ("Naive Bayes", GaussianNB()),
        ]
        try:
            from lightgbm import LGBMClassifier
            models.insert(1, ("LightGBM", LGBMClassifier(n_estimators=100, random_state=42, verbose=-1)))
        except ImportError:
            pass
        try:
            from xgboost import XGBClassifier
            models.insert(1, ("XGBoost", XGBClassifier(n_estimators=100, random_state=42, eval_metric="logloss", verbosity=0)))
        except ImportError:
            pass
    else:
        models = [
            ("Ridge Regression", Ridge(random_state=42)),
            ("Lasso", Lasso(random_state=42)),
            ("Random Forest", RandomForestRegressor(n_estimators=100, random_state=42)),
        ]
        try:
            from lightgbm import LGBMRegressor
            models.insert(2, ("LightGBM", LGBMRegressor(n_estimators=100, random_state=42, verbose=-1)))
        except ImportError:
            pass
        try:
            from xgboost import XGBRegressor
            models.insert(2, ("XGBoost", XGBRegressor(n_estimators=100, random_state=42, verbosity=0)))
        except ImportError:
            pass

    results = []
    for i, (name, model) in enumerate(models):
        yield {"type": "progress", "model": name, "current": i + 1, "total": len(models)}
        await asyncio.sleep(0)

        start = time.monotonic()
        try:
            use_scaled = name in ["Logistic Regression", "Lasso", "Ridge Regression"]
            Xtr = X_train_s if use_scaled else X_train
            Xte = X_test_s if use_scaled else X_test

            model.fit(Xtr, y_train)
            preds = model.predict(Xte)
            elapsed = time.monotonic() - start

            if task_type == "classification":
                acc = float(accuracy_score(y_test, preds))
                f1 = float(f1_score(y_test, preds, average="weighted", zero_division=0))
                metrics = {"accuracy": round(acc, 4), "f1": round(f1, 4)}
                try:
                    proba = model.predict_proba(Xte)[:, 1] if hasattr(model, "predict_proba") else preds
                    auc = float(roc_auc_score(y_test, proba)) if len(np.unique(y_test)) == 2 else None
                    if auc:
                        metrics["roc_auc"] = round(auc, 4)
                except Exception:
                    pass
                primary = acc
            else:
                mse = float(mean_squared_error(y_test, preds))
                r2 = float(r2_score(y_test, preds))
                mae = float(mean_absolute_error(y_test, preds))
                metrics = {"mse": round(mse, 4), "r2": round(r2, 4), "mae": round(mae, 4)}
                primary = r2

            results.append({
                "model": name,
                "metrics": metrics,
                "primary_score": round(primary, 4),
                "train_time_ms": round(elapsed * 1000),
                "status": "success",
            })
        except Exception as e:
            results.append({
                "model": name,
                "metrics": {},
                "primary_score": 0,
                "train_time_ms": 0,
                "status": "error",
                "error": str(e),
            })

    # Sort by primary score descending
    results.sort(key=lambda r: r["primary_score"], reverse=True)
    for i, r in enumerate(results):
        r["rank"] = i + 1

    yield {
        "type": "leaderboard",
        "task_type": task_type,
        "target": target_col,
        "rows": X.shape[0],
        "features": X.shape[1],
        "results": results,
        "winner": results[0]["model"] if results else None,
    }
