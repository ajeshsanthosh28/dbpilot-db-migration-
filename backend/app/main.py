from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.db.session import engine
from app.db.base import Base
from app.api.routes import auth, connections, query, monitor, restore, migration


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="DBPilot",
    description="DevOps Database Control Panel",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(connections.router, prefix="/api/connections", tags=["connections"])
app.include_router(query.router, prefix="/api/query", tags=["query"])
app.include_router(monitor.router, prefix="/api/monitor", tags=["monitor"])
app.include_router(restore.router, prefix="/api/restore", tags=["restore"])
app.include_router(migration.router, prefix="/api/migration", tags=["migration"])


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
