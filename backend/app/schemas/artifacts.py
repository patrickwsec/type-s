from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.common import ArtifactType, PaginationMeta


class ArtifactSummary(BaseModel):
    id: str
    project_id: str
    asset_id: str | None = None
    task_id: str
    artifact_type: ArtifactType
    storage_key: str
    content_type: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class ArtifactListResponse(BaseModel):
    items: list[ArtifactSummary]
    pagination: PaginationMeta
