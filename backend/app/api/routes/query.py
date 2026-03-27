from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.db.session import get_db
from app.models.models import DBConnection
from app.core.security import get_current_user
from app.services.connection_service import decrypt_password, execute_query

router = APIRouter()


class QueryRequest(BaseModel):
    sql: str
    limit: int = 1000


@router.post("/{conn_id}")
async def run_query(conn_id: int, req: QueryRequest,
                    db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(DBConnection).where(DBConnection.id == conn_id))
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(404, "Connection not found")
    password = decrypt_password(conn.password_encrypted)
    return await execute_query(
        conn.db_type.value, conn.host, conn.port,
        conn.database, conn.username, password,
        req.sql, req.limit,
    )
