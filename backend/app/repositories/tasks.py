import asyncio
from datetime import datetime, timezone
from typing import Any

from pymongo import ReturnDocument
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.tasks import TaskDetail, TaskEvent


_indexes_ready = False
_indexes_lock = asyncio.Lock()


class TaskRepository:
    def __init__(self, database: AsyncIOMotorDatabase):
        self.tasks = database["v2_tasks"]
        self.task_events = database["v2_task_events"]

    async def ensure_indexes(self) -> None:
        global _indexes_ready

        if _indexes_ready:
            return

        async with _indexes_lock:
            if _indexes_ready:
                return

            await self.tasks.create_index(
                [("project_id", 1), ("owner_id", 1), ("created_at", -1)],
                name="project_owner_created_at",
            )
            await self.tasks.create_index(
                [("owner_id", 1), ("status", 1), ("created_at", -1)],
                name="owner_status_created_at",
            )
            await self.tasks.create_index(
                [("status", 1), ("task_type", 1), ("created_at", 1)],
                name="status_task_type_created_at",
            )
            await self.task_events.create_index(
                [("task_id", 1), ("created_at", 1)],
                name="task_created_at",
            )
            await self.task_events.create_index(
                [("owner_id", 1), ("created_at", -1)],
                name="owner_created_at",
            )
            _indexes_ready = True

    async def insert_task(self, task_document: dict[str, Any]) -> None:
        await self.ensure_indexes()
        await self.tasks.insert_one(task_document)

    async def insert_task_event(self, event_document: dict[str, Any]) -> None:
        await self.ensure_indexes()
        await self.task_events.insert_one(event_document)

    async def claim_task(
        self,
        task_id: str,
        assigned_agent: str,
    ) -> dict[str, Any] | None:
        await self.ensure_indexes()
        now = datetime.now(timezone.utc)
        return await self.tasks.find_one_and_update(
            {"_id": task_id, "status": "queued"},
            {
                "$set": {
                    "status": "planning",
                    "assigned_agent": assigned_agent,
                    "started_at": now,
                    "updated_at": now,
                    "last_error": None,
                }
            },
            return_document=ReturnDocument.AFTER,
        )

    async def claim_next_task(
        self,
        *,
        assigned_agent: str,
        supported_task_types: list[str] | None = None,
    ) -> dict[str, Any] | None:
        await self.ensure_indexes()
        now = datetime.now(timezone.utc)

        query: dict[str, Any] = {"status": "queued"}
        if supported_task_types:
            query["task_type"] = {"$in": supported_task_types}

        return await self.tasks.find_one_and_update(
            query,
            {
                "$set": {
                    "status": "planning",
                    "assigned_agent": assigned_agent,
                    "started_at": now,
                    "updated_at": now,
                    "last_error": None,
                }
            },
            sort=[("created_at", 1)],
            return_document=ReturnDocument.AFTER,
        )

    async def update_task(
        self,
        task_id: str,
        updates: dict[str, Any],
    ) -> None:
        await self.ensure_indexes()
        await self.tasks.update_one({"_id": task_id}, {"$set": updates})

    async def recover_interrupted_tasks(self) -> int:
        """Mark any tasks stuck in planning/running/ingesting as failed.

        Returns the number of tasks that were recovered.
        """
        await self.ensure_indexes()
        now = datetime.now(timezone.utc)
        result = await self.tasks.update_many(
            {"status": {"$in": ["planning", "running", "ingesting"]}},
            {
                "$set": {
                    "status": "failed",
                    "completed_at": now,
                    "updated_at": now,
                    "last_error": "Task interrupted: worker process restarted before completion.",
                }
            },
        )
        return result.modified_count

    async def get_task(self, task_id: str, owner_id: str) -> dict[str, Any] | None:
        await self.ensure_indexes()
        return await self.tasks.find_one({"_id": task_id, "owner_id": owner_id})

    async def get_task_by_id(self, task_id: str) -> dict[str, Any] | None:
        await self.ensure_indexes()
        return await self.tasks.find_one({"_id": task_id})

    async def list_tasks(
        self,
        project_id: str,
        owner_id: str,
        page: int,
        page_size: int,
        status: str | None = None,
        task_type: str | None = None,
    ) -> tuple[list[dict[str, Any]], int]:
        await self.ensure_indexes()

        filters: dict[str, Any] = {
            "project_id": project_id,
            "owner_id": owner_id,
        }
        if status:
            filters["status"] = status
        if task_type:
            filters["task_type"] = task_type

        total = await self.tasks.count_documents(filters)
        cursor = (
            self.tasks.find(filters)
            .sort("created_at", -1)
            .skip((page - 1) * page_size)
            .limit(page_size)
        )
        items = await cursor.to_list(length=page_size)
        return items, total

    async def list_task_events(self, task_id: str, owner_id: str) -> list[dict[str, Any]]:
        await self.ensure_indexes()

        cursor = self.task_events.find(
            {"task_id": task_id, "owner_id": owner_id}
        ).sort("created_at", 1)
        return await cursor.to_list(length=None)


def serialize_task(task_document: dict[str, Any]) -> TaskDetail:
    return TaskDetail(
        id=task_document["_id"],
        project_id=task_document["project_id"],
        task_type=task_document["task_type"],
        status=task_document["status"],
        label=task_document["label"],
        requested_input=task_document.get("requested_input", {}),
        approval_mode=task_document["approval_mode"],
        created_by=task_document["created_by"],
        assigned_agent=task_document.get("assigned_agent"),
        result_summary=task_document.get("result_summary", {}),
        last_error=task_document.get("last_error"),
        started_at=task_document.get("started_at"),
        completed_at=task_document.get("completed_at"),
        created_at=task_document["created_at"],
        updated_at=task_document["updated_at"],
    )


def serialize_task_event(event_document: dict[str, Any]) -> TaskEvent:
    return TaskEvent(
        id=event_document["_id"],
        task_id=event_document["task_id"],
        event_type=event_document["event_type"],
        message=event_document["message"],
        payload=event_document.get("payload", {}),
        created_at=event_document["created_at"],
    )
