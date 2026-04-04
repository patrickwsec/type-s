from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.common import (
    ApprovalMode,
    PaginationMeta,
    TaskEventType,
    TaskStatus,
    TaskType,
)


class TaskCreateRequest(BaseModel):
    task_type: TaskType
    label: str | None = None
    requested_input: dict[str, Any] = Field(default_factory=dict)
    approval_mode: ApprovalMode = ApprovalMode.AUTO


class TaskDetail(BaseModel):
    id: str
    project_id: str
    task_type: TaskType
    status: TaskStatus
    label: str
    requested_input: dict[str, Any]
    approval_mode: ApprovalMode
    created_by: str
    assigned_agent: str | None = None
    result_summary: dict[str, Any] = Field(default_factory=dict)
    last_error: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class TaskCreateResponse(BaseModel):
    task: TaskDetail


class TaskListResponse(BaseModel):
    items: list[TaskDetail]
    pagination: PaginationMeta


class TaskEvent(BaseModel):
    id: str
    task_id: str
    event_type: TaskEventType
    message: str
    payload: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class TaskEventListResponse(BaseModel):
    items: list[TaskEvent]


class TaskRunResponse(BaseModel):
    task_id: str
    accepted: bool = True
    message: str


class TaskCapabilityField(BaseModel):
    key: str
    label: str
    input_type: str
    required: bool = False
    placeholder: str | None = None
    default: Any | None = None


class TaskCapability(BaseModel):
    task_type: TaskType
    display_name: str
    description: str
    auto_pickup: bool = True
    fields: list[TaskCapabilityField] = Field(default_factory=list)


class TaskCapabilityListResponse(BaseModel):
    items: list[TaskCapability]
