"""
Cloud Service — wraps CLI tools for Databricks, Azure, AWS, GCP,
GitHub, Docker, and Kubernetes. Streams command output back.
"""
import asyncio
import shutil
import subprocess
import sys
from typing import AsyncGenerator, Dict, List, Optional, Tuple


# ─── CLI detection ──────────────────────────────────────────────
CLI_MAP = {
    "databricks": {"cmd": "databricks", "name": "Databricks CLI", "install": "pip install databricks-cli"},
    "azure":      {"cmd": "az",          "name": "Azure CLI",      "install": "https://aka.ms/installazurecliwindows"},
    "aws":        {"cmd": "aws",         "name": "AWS CLI",        "install": "https://aws.amazon.com/cli/"},
    "gcp":        {"cmd": "gcloud",      "name": "GCP CLI",        "install": "https://cloud.google.com/sdk/docs/install"},
    "github":     {"cmd": "gh",          "name": "GitHub CLI",     "install": "https://cli.github.com/"},
    "docker":     {"cmd": "docker",      "name": "Docker",         "install": "https://docs.docker.com/get-docker/"},
    "kubectl":    {"cmd": "kubectl",     "name": "Kubernetes",     "install": "https://kubernetes.io/docs/tasks/tools/"},
    "git":        {"cmd": "git",         "name": "Git",            "install": "https://git-scm.com/"},
}


def detect_installed_clis() -> List[Dict]:
    """Check which cloud CLIs are installed."""
    result = []
    for key, info in CLI_MAP.items():
        installed = shutil.which(info["cmd"]) is not None
        version = None
        if installed:
            try:
                out = subprocess.run(
                    [info["cmd"], "--version"],
                    capture_output=True, text=True, timeout=5
                )
                version = (out.stdout or out.stderr or "").split("\n")[0].strip()[:60]
            except Exception:
                pass
        result.append({
            "id": key,
            "name": info["name"],
            "installed": installed,
            "version": version,
            "install_url": info["install"],
        })
    return result


# ─── Command execution ───────────────────────────────────────────
async def stream_command(
    command: List[str],
    cwd: Optional[str] = None,
    timeout: int = 120,
) -> AsyncGenerator[Dict, None]:
    """
    Stream a shell command's stdout/stderr line by line.
    Yields: {type: 'stdout'|'stderr'|'exit'|'error', line: str, code: int}
    """
    yield {"type": "start", "command": " ".join(command)}
    try:
        proc = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd,
        )

        async def read_stream(stream, stream_type):
            while True:
                line = await stream.readline()
                if not line:
                    break
                yield {"type": stream_type, "line": line.decode("utf-8", errors="replace").rstrip()}

        stdout_lines = []
        stderr_lines = []

        async for chunk in read_stream(proc.stdout, "stdout"):
            stdout_lines.append(chunk["line"])
            yield chunk

        async for chunk in read_stream(proc.stderr, "stderr"):
            stderr_lines.append(chunk["line"])
            yield chunk

        await asyncio.wait_for(proc.wait(), timeout=timeout)
        yield {"type": "exit", "code": proc.returncode}

    except asyncio.TimeoutError:
        yield {"type": "error", "line": f"Command timed out after {timeout}s"}
    except FileNotFoundError as e:
        yield {"type": "error", "line": f"Command not found: {command[0]}. Is it installed?"}
    except Exception as e:
        yield {"type": "error", "line": str(e)}


# ─── Safe command builder ──────────────────────────────────────────
BLOCKED_COMMANDS = {
    "rm", "del", "rmdir", "format", "shutdown", "reboot",
    "drop", "truncate", "delete",  # dangerous DB ops
}


def parse_safe_command(raw: str) -> Tuple[List[str], Optional[str]]:
    """
    Parse a user command string into a list of tokens.
    Returns (tokens, error_message). error_message is None if safe.
    """
    import shlex
    try:
        tokens = shlex.split(raw, posix=False)
    except ValueError:
        tokens = raw.split()

    if not tokens:
        return [], "Empty command"

    # Only allow known CLI prefixes
    allowed_prefixes = set(CLI_MAP[k]["cmd"] for k in CLI_MAP)
    allowed_prefixes.update({"python", "pip", "conda", "mlflow", "git"})

    base_cmd = tokens[0].lower().split("/")[-1].split("\\")[-1]  # strip path
    if base_cmd not in allowed_prefixes:
        return [], f"Command '{base_cmd}' is not in the allowlist. Allowed: {', '.join(sorted(allowed_prefixes))}"

    # Block dangerous subcommands
    for token in tokens[1:]:
        if token.lower().strip("-") in BLOCKED_COMMANDS:
            return [], f"Subcommand '{token}' is blocked for safety."

    return tokens, None


# ─── Quick status helpers ───────────────────────────────────────────
async def check_cloud_connections() -> Dict:
    """Quick check: which CLIs are logged in / configured."""
    checks = {}

    # Git
    try:
        r = subprocess.run(["git", "config", "user.email"], capture_output=True, text=True, timeout=3)
        checks["git"] = {"connected": bool(r.stdout.strip()), "identity": r.stdout.strip()}
    except Exception:
        checks["git"] = {"connected": False, "identity": None}

    # Docker
    try:
        r = subprocess.run(["docker", "info", "--format", "{{.ServerVersion}}"], capture_output=True, text=True, timeout=5)
        checks["docker"] = {"connected": r.returncode == 0, "version": r.stdout.strip()}
    except Exception:
        checks["docker"] = {"connected": False, "version": None}

    # AWS
    try:
        r = subprocess.run(["aws", "sts", "get-caller-identity", "--output", "text", "--query", "Account"],
                          capture_output=True, text=True, timeout=8)
        checks["aws"] = {"connected": r.returncode == 0, "account": r.stdout.strip()}
    except Exception:
        checks["aws"] = {"connected": False, "account": None}

    # Azure
    try:
        r = subprocess.run(["az", "account", "show", "--query", "name", "-o", "tsv"],
                          capture_output=True, text=True, timeout=8)
        checks["azure"] = {"connected": r.returncode == 0, "account": r.stdout.strip()}
    except Exception:
        checks["azure"] = {"connected": False, "account": None}

    return checks
