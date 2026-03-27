from sqlalchemy import Column, Integer, String, Boolean, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
import enum

from app.db.base import Base, TimestampMixin


class DBType(str, enum.Enum):
    postgresql = "postgresql"
    mysql = "mysql"
    clickhouse = "clickhouse"


class JobStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    success = "success"
    failed = "failed"


class User(Base, TimestampMixin):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)


class DBConnection(Base, TimestampMixin):
    __tablename__ = "db_connections"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    db_type = Column(SAEnum(DBType), nullable=False)
    host = Column(String(255), nullable=False)
    port = Column(Integer, nullable=False)
    database = Column(String(255), nullable=False)
    username = Column(String(255), nullable=False)
    password_encrypted = Column(Text, nullable=False)
    ssl_enabled = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)


class Job(Base, TimestampMixin):
    __tablename__ = "jobs"
    id = Column(Integer, primary_key=True)
    celery_task_id = Column(String(255), nullable=True, index=True)
    job_type = Column(String(50), nullable=False)
    status = Column(SAEnum(JobStatus), default=JobStatus.pending, nullable=False)
    connection_id = Column(Integer, nullable=True)
    meta = Column(JSONB, nullable=True)
    result = Column(JSONB, nullable=True)
    error = Column(Text, nullable=True)
    progress = Column(Integer, default=0)
