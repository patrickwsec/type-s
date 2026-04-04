from datetime import datetime

from pydantic import BaseModel, Field


class ProjectSummary(BaseModel):
    id: str
    name: str
    description: str
    owner_id: str
    created_at: datetime
    updated_at: datetime


class ProjectDetail(ProjectSummary):
    pass


class ProjectListResponse(BaseModel):
    items: list[ProjectSummary]
    total: int


class ProjectCreateRequest(BaseModel):
    name: str = Field(min_length=1)
    description: str = ""


class ProjectDeleteResponse(BaseModel):
    message: str


class ProjectOverviewStats(BaseModel):
    asset_count: int
    vulnerability_count: int
    info_finding_count: int
    task_count: int


class ProjectOverviewActivityItem(BaseModel):
    id: str
    item_type: str
    status: str
    label: str
    target: str | None = None
    created_at: datetime


class ProjectOverviewResponse(BaseModel):
    stats: ProjectOverviewStats
    recent_activity: list[ProjectOverviewActivityItem]
