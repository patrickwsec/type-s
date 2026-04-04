import json
import os
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.artifacts import ArtifactRepository, build_artifact_list_response
from app.schemas.common import ArtifactType
from app.services.project_access import get_project_for_user


ARTIFACTS_ROOT = Path(os.getenv("V2_ARTIFACTS_DIR", "/app/data/v2_artifacts"))


class ArtifactService:
    def __init__(self, database: AsyncIOMotorDatabase):
        self.database = database
        self.projects = database["projects"]
        self.repository = ArtifactRepository(database)

    async def create_json_artifact(
        self,
        *,
        project_id: str,
        owner_id: str,
        task_id: str,
        artifact_type: ArtifactType,
        filename: str,
        payload: dict | list,
        metadata: dict | None = None,
        asset_id: str | None = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        artifact_id = f"artifact_{uuid4()}"
        relative_dir = Path(project_id) / task_id
        relative_path = relative_dir / filename
        absolute_path = ARTIFACTS_ROOT / relative_path
        absolute_path.parent.mkdir(parents=True, exist_ok=True)
        absolute_path.write_text(
            json.dumps(payload, indent=2, sort_keys=True),
            encoding="utf-8",
        )

        artifact_document = {
            "_id": artifact_id,
            "project_id": project_id,
            "owner_id": owner_id,
            "asset_id": asset_id,
            "task_id": task_id,
            "artifact_type": artifact_type.value,
            "storage_key": str(relative_path),
            "content_type": "application/json",
            "metadata": metadata or {},
            "created_at": now,
        }
        await self.repository.insert_artifact(artifact_document)
        return artifact_document

    async def create_file_artifact(
        self,
        *,
        project_id: str,
        owner_id: str,
        task_id: str,
        artifact_type: ArtifactType,
        storage_key: str,
        content_type: str,
        metadata: dict | None = None,
        asset_id: str | None = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        artifact_document = {
            "_id": f"artifact_{uuid4()}",
            "project_id": project_id,
            "owner_id": owner_id,
            "asset_id": asset_id,
            "task_id": task_id,
            "artifact_type": artifact_type.value,
            "storage_key": storage_key,
            "content_type": content_type,
            "metadata": metadata or {},
            "created_at": now,
        }
        await self.repository.insert_artifact(artifact_document)
        return artifact_document

    async def list_artifacts(
        self,
        *,
        project_id: str,
        owner_id: str,
        page: int,
        page_size: int,
        artifact_type: ArtifactType | None = None,
        task_id: str | None = None,
    ):
        await get_project_for_user(self.projects, project_id, owner_id)
        items, total = await self.repository.list_artifacts(
            project_id=project_id,
            owner_id=owner_id,
            page=page,
            page_size=page_size,
            artifact_type=artifact_type.value if artifact_type else None,
            task_id=task_id,
        )
        return build_artifact_list_response(
            items,
            page=page,
            page_size=page_size,
            total=total,
        )

    async def get_artifact_for_user(self, artifact_id: str, owner_id: str) -> dict:
        artifact = await self.repository.get_artifact(artifact_id, owner_id)
        if not artifact:
            raise HTTPException(status_code=404, detail="Artifact not found")

        return artifact

    async def get_artifact_file_path(self, artifact_id: str, owner_id: str) -> tuple[dict, Path]:
        artifact = await self.get_artifact_for_user(artifact_id, owner_id)
        artifact_path = (ARTIFACTS_ROOT / artifact["storage_key"]).resolve()
        artifacts_root = ARTIFACTS_ROOT.resolve()

        if artifacts_root not in artifact_path.parents and artifact_path != artifacts_root:
            raise HTTPException(status_code=400, detail="Invalid artifact path")

        if not artifact_path.exists():
            raise HTTPException(status_code=404, detail="Artifact file not found")

        return artifact, artifact_path
