import os

from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.services.auth import AuthService
from app.services.analytics import AnalyticsService
from app.services.artifacts import ArtifactService
from app.services.exports import ExportService
from app.services.findings import FindingService
from app.services.ingest import IngestService
from app.services.projects import ProjectService
from app.services.tasks import TaskService
from app.services.worker import TaskWorkerService


COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax")


def get_task_service(
    database: AsyncIOMotorDatabase = Depends(get_database),
) -> TaskService:
    return TaskService(database)


def get_analytics_service(
    database: AsyncIOMotorDatabase = Depends(get_database),
) -> AnalyticsService:
    return AnalyticsService(database)


def get_ingest_service(
    database: AsyncIOMotorDatabase = Depends(get_database),
) -> IngestService:
    return IngestService(database)


def get_artifact_service(
    database: AsyncIOMotorDatabase = Depends(get_database),
) -> ArtifactService:
    return ArtifactService(database)


def get_project_service(
    database: AsyncIOMotorDatabase = Depends(get_database),
) -> ProjectService:
    return ProjectService(database)


def get_finding_service(
    database: AsyncIOMotorDatabase = Depends(get_database),
) -> FindingService:
    return FindingService(database)


def get_task_worker_service(
    database: AsyncIOMotorDatabase = Depends(get_database),
) -> TaskWorkerService:
    return TaskWorkerService(database)


def get_export_service(
    database: AsyncIOMotorDatabase = Depends(get_database),
) -> ExportService:
    return ExportService(database)


def get_auth_service(
    database: AsyncIOMotorDatabase = Depends(get_database),
) -> AuthService:
    return AuthService(
        database,
        cookie_secure=COOKIE_SECURE,
        cookie_samesite=COOKIE_SAMESITE,
    )
