import shutil
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.projects import (
    ProjectCreateRequest,
    ProjectDetail,
    ProjectListResponse,
    ProjectOverviewActivityItem,
    ProjectOverviewResponse,
    ProjectOverviewStats,
    ProjectSummary,
)
from app.services.artifacts import ARTIFACTS_ROOT
from app.services.project_access import get_project_for_user


def serialize_project(project_document: dict) -> ProjectSummary:
    return ProjectSummary(
        id=str(project_document["_id"]),
        name=project_document.get("name", "N/A"),
        description=project_document.get("description", "N/A"),
        owner_id=project_document["user_id"],
        created_at=project_document["created_at"],
        updated_at=project_document["updated_at"],
    )


class ProjectService:
    def __init__(self, database: AsyncIOMotorDatabase):
        self.database = database
        self.projects = database["projects"]
        self.assets = database["v2_assets"]
        self.findings = database["v2_findings"]
        self.artifacts = database["v2_artifacts"]
        self.tasks = database["v2_tasks"]
        self.task_events = database["v2_task_events"]

    async def list_projects(self, owner_id: str) -> ProjectListResponse:
        cursor = self.projects.find({"user_id": owner_id}).sort("updated_at", -1)
        projects = await cursor.to_list(length=None)
        items = [serialize_project(project) for project in projects]
        return ProjectListResponse(items=items, total=len(items))

    async def create_project(
        self,
        *,
        owner_id: str,
        request: ProjectCreateRequest,
    ) -> ProjectDetail:
        name = request.name.strip()
        description = request.description.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Project name cannot be empty.")

        now = datetime.now(timezone.utc)
        project_document = {
            "_id": ObjectId(),
            "name": name,
            "description": description,
            "user_id": owner_id,
            "created_at": now,
            "updated_at": now,
        }
        await self.projects.insert_one(project_document)
        summary = serialize_project(project_document)
        return ProjectDetail(**summary.model_dump())

    async def get_project(self, project_id: str, owner_id: str) -> ProjectDetail:
        project = await get_project_for_user(self.projects, project_id, owner_id)
        summary = serialize_project(project)
        return ProjectDetail(**summary.model_dump())

    async def delete_project(self, project_id: str, owner_id: str) -> None:
        project = await get_project_for_user(self.projects, project_id, owner_id)
        await self.projects.delete_one({"_id": project["_id"], "user_id": owner_id})
        await self.assets.delete_many({"project_id": project_id, "owner_id": owner_id})
        await self.findings.delete_many({"project_id": project_id, "owner_id": owner_id})
        await self.artifacts.delete_many({"project_id": project_id, "owner_id": owner_id})
        await self.tasks.delete_many({"project_id": project_id, "owner_id": owner_id})
        await self.task_events.delete_many({"project_id": project_id, "owner_id": owner_id})

        artifact_dir = ARTIFACTS_ROOT / project_id
        if artifact_dir.exists():
            shutil.rmtree(artifact_dir, ignore_errors=True)

    async def get_project_overview(self, project_id: str, owner_id: str) -> ProjectOverviewResponse:
        await get_project_for_user(self.projects, project_id, owner_id)

        asset_count = await self.assets.count_documents(
            {"project_id": project_id, "owner_id": owner_id}
        )
        vulnerability_count = await self.findings.count_documents(
            {
                "project_id": project_id,
                "owner_id": owner_id,
                "severity": {"$in": ["low", "medium", "high", "critical"]},
            }
        )
        info_finding_count = await self.findings.count_documents(
            {
                "project_id": project_id,
                "owner_id": owner_id,
                "severity": "info",
            }
        )
        task_count = await self.tasks.count_documents(
            {"project_id": project_id, "owner_id": owner_id}
        )

        recent_tasks_cursor = (
            self.tasks.find({"project_id": project_id, "owner_id": owner_id})
            .sort("created_at", -1)
            .limit(5)
        )
        recent_tasks = await recent_tasks_cursor.to_list(length=5)

        recent_activity = [
            ProjectOverviewActivityItem(
                id=task["_id"],
                item_type=task["task_type"],
                status=task["status"],
                label=task.get("label") or task["task_type"],
                target=(
                    task.get("requested_input", {}).get("scope_value")
                    or task.get("requested_input", {}).get("hostname")
                    or (task.get("requested_input", {}).get("hostnames") or [None])[0]
                ),
                created_at=task["created_at"],
            )
            for task in recent_tasks
        ]

        return ProjectOverviewResponse(
            stats=ProjectOverviewStats(
                asset_count=asset_count,
                vulnerability_count=vulnerability_count,
                info_finding_count=info_finding_count,
                task_count=task_count,
            ),
            recent_activity=recent_activity,
        )
