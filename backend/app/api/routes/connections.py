from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.db.session import get_db
from app.models.models import DBConnection, DBType
from app.core.security import get_current_user
from app.services.connection_service import (
    encrypt_password, decrypt_password, test_connection, get_schema
)

router = APIRouter()


class ConnectionCreate(BaseModel):
    name: str
    db_type: DBType
    host: str
    port: int
    database: str
    username: str
    password: str
    ssl_enabled: bool = False
    notes: Optional[str] = None


@router.get("/")
async def list_connections(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(DBConnection).where(DBConnection.is_active == True))
    conns = result.scalars().all()
    return [{"id": c.id, "name": c.name, "db_type": c.db_type, "host": c.host,
             "port": c.port, "database": c.database, "username": c.username,
             "ssl_enabled": c.ssl_enabled, "notes": c.notes} for c in conns]


@router.post("/", status_code=201)
async def create_connection(req: ConnectionCreate, db: AsyncSession = Depends(get_db),
                             _=Depends(get_current_user)):
    conn = DBConnection(
        name=req.name, db_type=req.db_type, host=req.host, port=req.port,
        database=req.database, username=req.username,
        password_encrypted=encrypt_password(req.password),
        ssl_enabled=req.ssl_enabled, notes=req.notes,
    )
    db.add(conn)
    await db.flush()
    return {"id": conn.id, "name": conn.name, "db_type": conn.db_type.value}


@router.post("/{conn_id}/test")
async def test_conn(conn_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(DBConnection).where(DBConnection.id == conn_id))
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(404, "Connection not found")
    password = decrypt_password(conn.password_encrypted)
    return await test_connection(conn.db_type.value, conn.host, conn.port,
                                  conn.database, conn.username, password)


@router.get("/{conn_id}/schema")
async def schema(conn_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(DBConnection).where(DBConnection.id == conn_id))
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(404, "Connection not found")
    password = decrypt_password(conn.password_encrypted)
    return await get_schema(conn.db_type.value, conn.host, conn.port,
                             conn.database, conn.username, password)


@router.delete("/{conn_id}", status_code=204)
async def delete_connection(conn_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(DBConnection).where(DBConnection.id == conn_id))
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(404, "Connection not found")
    conn.is_active = False
