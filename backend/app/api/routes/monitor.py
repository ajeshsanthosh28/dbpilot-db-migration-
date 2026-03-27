from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.models import DBConnection
from app.core.security import get_current_user
from app.services.connection_service import decrypt_password
from app.services.monitor_service import (
    get_system_metrics, get_pg_metrics, get_mysql_metrics, get_clickhouse_metrics
)

router = APIRouter()


@router.get("/system")
async def system_metrics(_=Depends(get_current_user)):
    return get_system_metrics()


@router.get("/{conn_id}")
async def db_metrics(conn_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(DBConnection).where(DBConnection.id == conn_id))
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(404, "Connection not found")
    password = decrypt_password(conn.password_encrypted)
    db_type = conn.db_type.value

    if db_type == "postgresql":
        metrics = await get_pg_metrics(conn.host, conn.port, conn.database, conn.username, password)
    elif db_type == "mysql":
        metrics = await get_mysql_metrics(conn.host, conn.port, conn.database, conn.username, password)
    elif db_type == "clickhouse":
        metrics = await get_clickhouse_metrics(conn.host, conn.port, conn.database, conn.username, password)
    else:
        raise HTTPException(400, f"Unsupported db type: {db_type}")

    return {"connection_id": conn_id, "name": conn.name, "db_type": db_type, **metrics}
