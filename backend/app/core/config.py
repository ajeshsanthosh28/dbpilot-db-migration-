from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    APP_ENV: str = "development"
    SECRET_KEY: str = "change_me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    DATABASE_URL: str
    REDIS_URL: str = "redis://redis:6379/0"
    CELERY_BROKER_URL: str = "redis://redis:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/1"

    UPLOAD_DIR: str = "/app/uploads"
    MAX_UPLOAD_MB: int = 500

    CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    class Config:
        env_file = ".env"

    def model_post_init(self, __context):
        import os
        os.makedirs(self.UPLOAD_DIR, exist_ok=True)


settings = Settings()
