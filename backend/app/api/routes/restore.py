import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from celery.result import AsyncResult

from app.db.session import get_db
from app.models.models import DBConnection, Job, JobStatus
from app.core.security import get_current_user
from app.core.config import settings
from app.services.connection_service import decrypt_password
from app.services.restore_service import restore_database_task
from app.core.celery_app import celery_app

router = APIRouter()


@router.post("/{conn_id}")
async def start_restore(
    conn_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(select(DBConnection).where(DBConnection.id == conn_id))
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(404, "Connection not found")

    # Validate file size
    content = await file.read()
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(413, f"File exceeds {settings.MAX_UPLOAD_MB}MB limit")

    # Save upload to disk
    filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, filename)
    with open(file_path, "wb") as f:
        f.write(content)

    password = decrypt_password(conn.password_encrypted)

    # Dispatch Celery task
    task = restore_database_task.delay(
        connection_id=conn_id,
        file_path=file_path,
        db_type=conn.db_type.value,
        host=conn.host,
        port=conn.port,
        database=conn.database,
        username=conn.username,
        password=password,
    )

    # Record job
    job = Job(
        celery_task_id=task.id,
        job_type="restore",
        status=JobStatus.pending,
        connection_id=conn_id,
        meta={"filename": file.filename, "file_size": len(content)},
    )
    db.add(job)
    await db.flush()

    return {"job_id": job.id, "task_id": task.id, "status": "pending"}


@router.get("/job/{task_id}")
async def restore_status(task_id: str, _=Depends(get_current_user)):
    result = AsyncResult(task_id, app=celery_app)
    return {
        "task_id": task_id,
        "status": result.state,
        "info": result.info if isinstance(result.info, dict) else str(result.info),
    }
