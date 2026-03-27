from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "dbpilot",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.services.restore_service",
        "app.services.migration_service",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_soft_time_limit=3600,
    task_time_limit=7200,
)
