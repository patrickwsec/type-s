import asyncio
from math import ceil
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.artifacts import ArtifactListResponse, ArtifactSummary
from app.schemas.common import ArtifactType, PaginationMeta


_artifact_indexes_ready = False
_artifact_indexes_lock = asyncio.Lock()


class ArtifactRepository:
    def __init__(self, database: AsyncIOMotorDatabase):
        self.artifacts = database["v2_artifacts"]

    async def ensure_indexes(self) -> None:
        global _artifact_indexes_ready

        if _artifact_indexes_ready:
            return

        async with _artifact_indexes_lock:
            if _artifact_indexes_ready:
                return

            await self.artifacts.create_index(
                [("project_id", 1), ("owner_id", 1), ("created_at", -1)],
                name="project_owner_created_at",
            )
            await self.artifacts.create_index(
                [("task_id", 1), ("created_at", 1)],
                name="task_created_at",
            )
            await self.artifacts.create_index(
                [("artifact_type", 1), ("created_at", -1)],
                name="artifact_type_created_at",
            )
            _artifact_indexes_ready = True

    async def insert_artifact(self, artifact_document: dict[str, Any]) -> None:
        await self.ensure_indexes()
        await self.artifacts.insert_one(artifact_document)

    async def list_artifacts(
        self,
        *,
        project_id: str,
        owner_id: str,
        page: int,
        page_size: int,
        artifact_type: str | None = None,
        task_id: str | None = None,
    ) -> tuple[list[dict[str, Any]], int]:
        await self.ensure_indexes()

        filters: dict[str, Any] = {
            "project_id": project_id,
            "owner_id": owner_id,
        }
        if artifact_type:
            filters["artifact_type"] = artifact_type
        if task_id:
            filters["task_id"] = task_id

        total = await self.artifacts.count_documents(filters)
        cursor = (
            self.artifacts.find(filters)
            .sort("created_at", -1)
            .skip((page - 1) * page_size)
            .limit(page_size)
        )
        items = await cursor.to_list(length=page_size)
        return items, total

    async def get_artifact(self, artifact_id: str, owner_id: str) -> dict[str, Any] | None:
        await self.ensure_indexes()
        return await self.artifacts.find_one({"_id": artifact_id, "owner_id": owner_id})


def serialize_artifact(artifact_document: dict[str, Any]) -> ArtifactSummary:
    return ArtifactSummary(
        id=artifact_document["_id"],
        project_id=artifact_document["project_id"],
        asset_id=artifact_document.get("asset_id"),
        task_id=artifact_document["task_id"],
        artifact_type=artifact_document["artifact_type"],
        storage_key=artifact_document["storage_key"],
        content_type=artifact_document["content_type"],
        metadata=artifact_document.get("metadata", {}),
        created_at=artifact_document["created_at"],
    )


def build_artifact_list_response(
    items: list[dict[str, Any]],
    *,
    page: int,
    page_size: int,
    total: int,
) -> ArtifactListResponse:
    return ArtifactListResponse(
        items=[serialize_artifact(item) for item in items],
        pagination=PaginationMeta(
            page=page,
            page_size=page_size,
            total=total,
            total_pages=ceil(total / page_size) if total else 0,
        ),
    )
