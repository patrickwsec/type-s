from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.common import FindingTriageStatus, PaginationMeta, SeverityLevel


class FindingSummary(BaseModel):
    id: str
    project_id: str
    asset_id: str | None = None
    asset_hostname: str | None = None
    category: str
    title: str
    severity: SeverityLevel
    description: str
    evidence_summary: str | None = None
    references: list[str] = Field(default_factory=list)
    source: str
    source_task_id: str | None = None
    triage_status: FindingTriageStatus = FindingTriageStatus.NEW
    template_id: str | None = None
    matcher_name: str | None = None
    matched_at: str | None = None
    tags: list[str] = Field(default_factory=list)
    extracted_results: list[str] = Field(default_factory=list)
    curl_command: str | None = None
    request: str | None = None
    response: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    first_seen_at: datetime
    last_seen_at: datetime


class FindingListResponse(BaseModel):
    items: list[FindingSummary]
    pagination: PaginationMeta


class FindingTriageUpdateRequest(BaseModel):
    triage_status: FindingTriageStatus


class BulkTriageRequest(BaseModel):
    finding_ids: list[str] = Field(..., min_length=1, max_length=500)
    triage_status: FindingTriageStatus


class FindingStatsResponse(BaseModel):
    severity_counts: dict[str, int]
    triage_counts: dict[str, int]
    total: int
