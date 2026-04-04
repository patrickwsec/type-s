import asyncio
import json

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from app.api.dependencies import get_task_service, get_task_worker_service
from app.core.security import get_current_user
from app.schemas.common import TaskStatus, TaskType
from app.schemas.tasks import (
    TaskCapabilityListResponse,
    TaskCreateRequest,
    TaskCreateResponse,
    TaskDetail,
    TaskEventListResponse,
    TaskListResponse,
    TaskRunResponse,
)
from app.services.tasks import TaskService
from app.services.worker import TaskWorkerService


router = APIRouter()
TERMINAL_TASK_STATUSES = {
    TaskStatus.COMPLETED,
    TaskStatus.FAILED,
    TaskStatus.CANCELLED,
}


@router.get("/task-capabilities", response_model=TaskCapabilityListResponse)
async def list_task_capabilities(
    user_id: str = Depends(get_current_user),
    task_service: TaskService = Depends(get_task_service),
):
    return await task_service.list_task_capabilities()


@router.post("/projects/{project_id}/tasks", response_model=TaskCreateResponse)
async def create_task(
    project_id: str,
    request: TaskCreateRequest,
    user_id: str = Depends(get_current_user),
    task_service: TaskService = Depends(get_task_service),
):
    return await task_service.create_task(
        project_id=project_id,
        user_id=user_id,
        request=request,
    )


@router.get("/projects/{project_id}/tasks", response_model=TaskListResponse)
async def list_tasks(
    project_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    status: TaskStatus | None = Query(default=None),
    task_type: TaskType | None = Query(default=None),
    user_id: str = Depends(get_current_user),
    task_service: TaskService = Depends(get_task_service),
):
    return await task_service.list_tasks(
        project_id=project_id,
        user_id=user_id,
        page=page,
        page_size=page_size,
        status=status,
        task_type=task_type,
    )


@router.get("/tasks/{task_id}", response_model=TaskDetail)
async def get_task(
    task_id: str,
    user_id: str = Depends(get_current_user),
    task_service: TaskService = Depends(get_task_service),
):
    return await task_service.get_task(task_id=task_id, user_id=user_id)


@router.get("/tasks/{task_id}/events", response_model=TaskEventListResponse)
async def list_task_events(
    task_id: str,
    user_id: str = Depends(get_current_user),
    task_service: TaskService = Depends(get_task_service),
):
    return await task_service.list_task_events(task_id=task_id, user_id=user_id)


@router.get("/tasks/{task_id}/events/stream")
async def stream_task_events(
    task_id: str,
    request: Request,
    user_id: str = Depends(get_current_user),
    task_service: TaskService = Depends(get_task_service),
):
    await task_service.get_task(task_id=task_id, user_id=user_id)

    async def event_stream():
        seen_event_ids: set[str] = set()

        while True:
            if await request.is_disconnected():
                break

            task_detail = await task_service.get_task(task_id=task_id, user_id=user_id)
            task_events = await task_service.list_task_events(task_id=task_id, user_id=user_id)

            for event in task_events.items:
                if event.id in seen_event_ids:
                    continue
                seen_event_ids.add(event.id)
                yield (
                    "event: task_event\n"
                    f"data: {json.dumps(event.model_dump(mode='json'))}\n\n"
                )

            if task_detail.status in TERMINAL_TASK_STATUSES:
                yield (
                    "event: task_terminal\n"
                    f"data: {json.dumps(task_detail.model_dump(mode='json'))}\n\n"
                )
                break

            yield ": keep-alive\n\n"
            await asyncio.sleep(1)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/tasks/{task_id}/run", response_model=TaskRunResponse)
async def run_task(
    task_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
    task_service: TaskService = Depends(get_task_service),
    task_worker_service: TaskWorkerService = Depends(get_task_worker_service),
):
    task_document = await task_service.get_task_document(task_id=task_id, user_id=user_id)
    if task_document["status"] != TaskStatus.QUEUED.value:
        raise HTTPException(status_code=409, detail="Only queued tasks can be started.")

    background_tasks.add_task(task_worker_service.run_task, task_id)
    return TaskRunResponse(
        task_id=task_id,
        message="Task accepted for background execution.",
    )


@router.post("/tasks/{task_id}/cancel", response_model=TaskDetail)
async def cancel_task(
    task_id: str,
    user_id: str = Depends(get_current_user),
    task_service: TaskService = Depends(get_task_service),
):
    return await task_service.cancel_task(task_id=task_id, user_id=user_id)


@router.post("/tasks/{task_id}/retry", response_model=TaskCreateResponse)
async def retry_task(
    task_id: str,
    user_id: str = Depends(get_current_user),
    task_service: TaskService = Depends(get_task_service),
):
    return await task_service.retry_task(task_id=task_id, user_id=user_id)
