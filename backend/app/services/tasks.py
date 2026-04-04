from datetime import datetime, timezone
from math import ceil
from uuid import uuid4

from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.tasks import TaskRepository, serialize_task, serialize_task_event
from app.schemas.common import PaginationMeta, TaskEventType, TaskStatus, TaskType
from app.services.task_catalog import list_task_capabilities, normalize_task_request
from app.services.project_access import get_project_for_user
from app.schemas.tasks import (
    TaskCapabilityListResponse,
    TaskCreateRequest,
    TaskCreateResponse,
    TaskDetail,
    TaskEventListResponse,
    TaskListResponse,
)


class TaskService:
    def __init__(self, database: AsyncIOMotorDatabase):
        self.database = database
        self.projects = database["projects"]
        self.repository = TaskRepository(database)

    async def create_task(
        self,
        project_id: str,
        user_id: str,
        request: TaskCreateRequest,
    ) -> TaskCreateResponse:
        await self._get_project_for_user(project_id, user_id)
        normalized_label, normalized_requested_input = normalize_task_request(
            task_type=request.task_type,
            label=request.label,
            requested_input=request.requested_input,
        )

        now = datetime.now(timezone.utc)
        task_id = f"task_{uuid4()}"
        task_document = {
            "_id": task_id,
            "project_id": project_id,
            "owner_id": user_id,
            "task_type": request.task_type.value,
            "status": TaskStatus.QUEUED.value,
            "label": normalized_label,
            "requested_input": normalized_requested_input,
            "approval_mode": request.approval_mode.value,
            "created_by": user_id,
            "assigned_agent": None,
            "result_summary": {},
            "last_error": None,
            "started_at": None,
            "completed_at": None,
            "created_at": now,
            "updated_at": now,
        }
        event_document = {
            "_id": f"task_event_{uuid4()}",
            "task_id": task_id,
            "project_id": project_id,
            "owner_id": user_id,
            "event_type": TaskEventType.TASK_CREATED.value,
            "message": "Task queued for agent pickup.",
            "payload": {
                "task_type": request.task_type.value,
                "approval_mode": request.approval_mode.value,
            },
            "created_at": now,
        }

        await self.repository.insert_task(task_document)
        await self.repository.insert_task_event(event_document)

        return TaskCreateResponse(task=serialize_task(task_document))

    async def list_task_capabilities(self) -> TaskCapabilityListResponse:
        return TaskCapabilityListResponse(items=list_task_capabilities())

    async def cancel_task(self, task_id: str, user_id: str) -> TaskDetail:
        task_document = await self.repository.get_task(task_id, user_id)
        if not task_document:
            raise HTTPException(status_code=404, detail="Task not found")

        if task_document["status"] in {
            TaskStatus.QUEUED.value,
            TaskStatus.AWAITING_APPROVAL.value,
        }:
            now = datetime.now(timezone.utc)
            await self.repository.update_task(
                task_id,
                {
                    "status": TaskStatus.CANCELLED.value,
                    "updated_at": now,
                    "completed_at": now,
                    "last_error": "Task cancelled before execution.",
                },
            )
            await self.repository.insert_task_event(
                {
                    "_id": f"task_event_{uuid4()}",
                    "task_id": task_id,
                    "project_id": task_document["project_id"],
                    "owner_id": user_id,
                    "event_type": TaskEventType.TASK_CANCELLED.value,
                    "message": "Task cancelled by the user before execution.",
                    "payload": {"cancelled_by": user_id},
                    "created_at": now,
                }
            )

            updated_task = await self.repository.get_task(task_id, user_id)
            return serialize_task(updated_task)

        if task_document["status"] in {
            TaskStatus.PLANNING.value,
            TaskStatus.RUNNING.value,
            TaskStatus.INGESTING.value,
        }:
            now = datetime.now(timezone.utc)
            await self.repository.update_task(
                task_id,
                {
                    "status": TaskStatus.CANCELLING.value,
                    "updated_at": now,
                    "last_error": "Cancellation requested; waiting for the worker to stop.",
                },
            )
            await self.repository.insert_task_event(
                {
                    "_id": f"task_event_{uuid4()}",
                    "task_id": task_id,
                    "project_id": task_document["project_id"],
                    "owner_id": user_id,
                    "event_type": TaskEventType.TASK_CANCELLATION_REQUESTED.value,
                    "message": "Cancellation requested for a running task.",
                    "payload": {"cancelled_by": user_id},
                    "created_at": now,
                }
            )

            updated_task = await self.repository.get_task(task_id, user_id)
            return serialize_task(updated_task)

        raise HTTPException(
            status_code=409,
            detail="Only queued, awaiting-approval, planning, running, or ingesting tasks can be cancelled in Phase 1.",
        )

    async def retry_task(self, task_id: str, user_id: str) -> TaskCreateResponse:
        task_document = await self.repository.get_task(task_id, user_id)
        if not task_document:
            raise HTTPException(status_code=404, detail="Task not found")

        if task_document["status"] not in {
            TaskStatus.COMPLETED.value,
            TaskStatus.FAILED.value,
            TaskStatus.CANCELLED.value,
        }:
            raise HTTPException(
                status_code=409,
                detail="Only completed, failed, or cancelled tasks can be retried.",
            )

        now = datetime.now(timezone.utc)
        new_task_id = f"task_{uuid4()}"
        retry_document = {
            "_id": new_task_id,
            "project_id": task_document["project_id"],
            "owner_id": user_id,
            "task_type": task_document["task_type"],
            "status": TaskStatus.QUEUED.value,
            "label": task_document["label"],
            "requested_input": task_document.get("requested_input", {}),
            "approval_mode": task_document["approval_mode"],
            "created_by": user_id,
            "assigned_agent": None,
            "result_summary": {},
            "last_error": None,
            "started_at": None,
            "completed_at": None,
            "retry_of_task_id": task_id,
            "created_at": now,
            "updated_at": now,
        }
        retry_event = {
            "_id": f"task_event_{uuid4()}",
            "task_id": new_task_id,
            "project_id": task_document["project_id"],
            "owner_id": user_id,
            "event_type": TaskEventType.TASK_CREATED.value,
            "message": "Task re-queued from a previous run.",
            "payload": {
                "task_type": task_document["task_type"],
                "approval_mode": task_document["approval_mode"],
                "retry_of_task_id": task_id,
            },
            "created_at": now,
        }

        await self.repository.insert_task(retry_document)
        await self.repository.insert_task_event(retry_event)

        return TaskCreateResponse(task=serialize_task(retry_document))

    async def list_tasks(
        self,
        project_id: str,
        user_id: str,
        page: int,
        page_size: int,
        status: TaskStatus | None = None,
        task_type: TaskType | None = None,
    ) -> TaskListResponse:
        await self._get_project_for_user(project_id, user_id)
        items, total = await self.repository.list_tasks(
            project_id=project_id,
            owner_id=user_id,
            page=page,
            page_size=page_size,
            status=status.value if status else None,
            task_type=task_type.value if task_type else None,
        )

        return TaskListResponse(
            items=[serialize_task(item) for item in items],
            pagination=PaginationMeta(
                page=page,
                page_size=page_size,
                total=total,
                total_pages=ceil(total / page_size) if total else 0,
            ),
        )

    async def get_task(self, task_id: str, user_id: str) -> TaskDetail:
        task_document = await self.repository.get_task(task_id, user_id)
        if not task_document:
            raise HTTPException(status_code=404, detail="Task not found")

        return serialize_task(task_document)

    async def get_task_document(self, task_id: str, user_id: str) -> dict:
        task_document = await self.repository.get_task(task_id, user_id)
        if not task_document:
            raise HTTPException(status_code=404, detail="Task not found")

        return task_document

    async def list_task_events(self, task_id: str, user_id: str) -> TaskEventListResponse:
        task_document = await self.repository.get_task(task_id, user_id)
        if not task_document:
            raise HTTPException(status_code=404, detail="Task not found")

        events = await self.repository.list_task_events(task_id, user_id)
        return TaskEventListResponse(items=[serialize_task_event(event) for event in events])

    async def _get_project_for_user(self, project_id: str, user_id: str) -> dict:
        return await get_project_for_user(self.projects, project_id, user_id)
