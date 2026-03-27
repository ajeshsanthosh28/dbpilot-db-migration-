"""
One-click restore service.
Detects file type (.sql, .dump), selects correct tool (psql / mysql),
and runs the restore as a background Celery task.
"""
import os
import subprocess
import asyncio
from pathlib import Path
from typing import Optional

from app.core.celery_app import celery_app
from app.core.config import settings


def detect_restore_type(filename: str) -> str:
    """Detect restore method from file extension."""
    ext = Path(filename).suffix.lower()
    if ext in (".sql",):
        return "sql"
    elif ext in (".dump", ".pgdump"):
        return "pgdump"
    elif ext in (".gz",):
        return "gzip"
    return "sql"


@celery_app.task(bind=True, name="restore_database")
def restore_database_task(self, connection_id: int, file_path: str, db_type: str,
                           host: str, port: int, database: str,
                           username: str, password: str):
    """Celery task: restore a database from uploaded backup file."""
    self.update_state(state="PROGRESS", meta={"progress": 5, "step": "Validating file"})

    if not os.path.exists(file_path):
        return {"success": False, "error": "Uploaded file not found"}

    restore_type = detect_restore_type(file_path)
    env = os.environ.copy()

    try:
        self.update_state(state="PROGRESS", meta={"progress": 20, "step": "Starting restore"})

        if db_type == "postgresql":
            env["PGPASSWORD"] = password
            if restore_type == "pgdump":
                cmd = ["pg_restore", "--no-owner", "--no-privileges",
                       "-h", host, "-p", str(port), "-U", username, "-d", database,
                       "-v", file_path]
            else:
                cmd = ["psql", "-h", host, "-p", str(port), "-U", username,
                       "-d", database, "-f", file_path]

        elif db_type == "mysql":
            if restore_type in ("sql",):
                cmd = ["mysql", "-h", host, "-P", str(port),
                       f"-u{username}", f"-p{password}", database]
                with open(file_path, "r") as f:
                    proc = subprocess.run(cmd, stdin=f, capture_output=True, text=True, timeout=3600, env=env)
                    if proc.returncode != 0:
                        return {"success": False, "error": proc.stderr}
                    return {"success": True, "message": "Restore completed successfully"}
            else:
                return {"success": False, "error": "MySQL only supports .sql files"}
        else:
            return {"success": False, "error": f"Restore not supported for {db_type}"}

        self.update_state(state="PROGRESS", meta={"progress": 50, "step": "Executing restore"})
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=3600, env=env)

        if proc.returncode != 0:
            return {"success": False, "error": proc.stderr or "Restore failed"}

        self.update_state(state="PROGRESS", meta={"progress": 100, "step": "Complete"})
        return {"success": True, "message": "Restore completed successfully", "output": proc.stdout[-500:]}

    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Restore timed out after 1 hour"}
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        try:
            os.remove(file_path)
        except Exception:
            pass
