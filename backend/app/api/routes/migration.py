from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from celery.result import AsyncResult

from app.db.session import get_db
from app.models.models import DBConnection, Job, JobStatus
from app.core.security import get_current_user
from app.services.connection_service import decrypt_password
from app.services.migration_service import migrate_database_task
from app.core.celery_app import celery_app

router = APIRouter()


class MigrationRequest(BaseModel):
    source_connection_id: int
    dest_connection_id: int
    migrate_schema: bool = True
    migrate_data: bool = True


@router.post("/")
async def start_migration(
    req: MigrationRequest,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    src_result = await db.execute(select(DBConnection).where(DBConnection.id == req.source_connection_id))
    src = src_result.scalar_one_or_none()
    if not src:
        raise HTTPException(404, "Source connection not found")

    dst_result = await db.execute(select(DBConnection).where(DBConnection.id == req.dest_connection_id))
    dst = dst_result.scalar_one_or_none()
    if not dst:
        raise HTTPException(404, "Destination connection not found")

    src_password = decrypt_password(src.password_encrypted)
    dst_password = decrypt_password(dst.password_encrypted)

    source_params = dict(host=src.host, port=src.port, database=src.database,
                         user=src.username, password=src_password)
    dest_params = dict(host=dst.host, port=dst.port, database=dst.database,
                       user=dst.username, password=dst_password)

    task = migrate_database_task.delay(
        source_params=source_params,
        dest_params=dest_params,
        source_db_type=src.db_type.value,
        dest_db_type=dst.db_type.value,
        options={"migrate_schema": req.migrate_schema, "migrate_data": req.migrate_data},
    )

    job = Job(
        celery_task_id=task.id,
        job_type="migration",
        status=JobStatus.pending,
        meta={
            "source": src.name, "dest": dst.name,
            "source_type": src.db_type.value, "dest_type": dst.db_type.value,
        },
    )
    db.add(job)
    await db.flush()

    return {"job_id": job.id, "task_id": task.id, "status": "pending"}


@router.get("/job/{task_id}")
async def migration_status(task_id: str, _=Depends(get_current_user)):
    result = AsyncResult(task_id, app=celery_app)
    return {
        "task_id": task_id,
        "status": result.state,
        "info": result.info if isinstance(result.info, dict) else str(result.info),
    }


@router.get("/types")
async def supported_migrations(_=Depends(get_current_user)):
    return {
        "supported": [
            {"source": "postgresql", "dest": "mysql"},
            {"source": "mysql", "dest": "postgresql"},
        ]
    }
