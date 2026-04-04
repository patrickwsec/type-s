from fastapi import APIRouter, Depends, Query

from app.api.dependencies import get_finding_service
from app.core.security import get_current_user
from app.schemas.common import FindingTriageStatus, SeverityLevel
from app.schemas.common import PaginationMeta
from app.schemas.findings import (
    BulkTriageRequest,
    FindingListResponse,
    FindingStatsResponse,
    FindingSummary,
    FindingTriageUpdateRequest,
)
from app.services.findings import FindingService


router = APIRouter(prefix="/projects/{project_id}/findings")


@router.get("/stats", response_model=FindingStatsResponse)
async def get_finding_stats(
    project_id: str,
    user_id: str = Depends(get_current_user),
    finding_service: FindingService = Depends(get_finding_service),
):
    return await finding_service.get_stats(project_id=project_id, owner_id=user_id)


@router.get("/hostnames", response_model=list[str])
async def get_distinct_hostnames(
    project_id: str,
    user_id: str = Depends(get_current_user),
    finding_service: FindingService = Depends(get_finding_service),
):
    return await finding_service.get_distinct_hostnames(
        project_id=project_id, owner_id=user_id
    )


@router.get("/template-ids", response_model=list[str])
async def get_distinct_template_ids(
    project_id: str,
    user_id: str = Depends(get_current_user),
    finding_service: FindingService = Depends(get_finding_service),
):
    return await finding_service.get_distinct_template_ids(
        project_id=project_id, owner_id=user_id
    )


@router.get("/tags", response_model=list[str])
async def get_distinct_tags(
    project_id: str,
    user_id: str = Depends(get_current_user),
    finding_service: FindingService = Depends(get_finding_service),
):
    return await finding_service.get_distinct_tags(
        project_id=project_id, owner_id=user_id
    )


@router.get("", response_model=FindingListResponse)
async def list_findings(
    project_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    severity: SeverityLevel | None = Query(default=None),
    severities: str | None = Query(default=None, description="Comma-separated severity values"),
    triage_status: FindingTriageStatus | None = Query(default=None),
    triage_statuses: str | None = Query(default=None, description="Comma-separated triage statuses"),
    source_task_id: str | None = Query(default=None),
    asset_id: str | None = Query(default=None),
    search: str | None = Query(default=None, max_length=200),
    hostname: str | None = Query(default=None, max_length=200),
    template_id: str | None = Query(default=None, max_length=200),
    tags: str | None = Query(default=None, description="Comma-separated tags"),
    sort_by: str | None = Query(default=None),
    sort_order: str | None = Query(default=None, pattern="^(asc|desc)$"),
    user_id: str = Depends(get_current_user),
    finding_service: FindingService = Depends(get_finding_service),
):
    severity_list = None
    if severities:
        severity_list = [s.strip() for s in severities.split(",") if s.strip()]

    triage_status_list = None
    if triage_statuses:
        triage_status_list = [s.strip() for s in triage_statuses.split(",") if s.strip()]

    tags_list = None
    if tags:
        tags_list = [t.strip() for t in tags.split(",") if t.strip()]

    return await finding_service.list_findings(
        project_id=project_id,
        owner_id=user_id,
        page=page,
        page_size=page_size,
        severity=severity,
        severity_list=severity_list,
        triage_status=triage_status,
        triage_status_list=triage_status_list,
        source_task_id=source_task_id,
        asset_id=asset_id,
        search=search,
        hostname=hostname,
        template_id=template_id,
        tags=tags_list,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.patch("/bulk-triage")
async def bulk_update_triage(
    project_id: str,
    request: BulkTriageRequest,
    user_id: str = Depends(get_current_user),
    finding_service: FindingService = Depends(get_finding_service),
):
    count = await finding_service.bulk_update_triage(
        project_id=project_id,
        owner_id=user_id,
        finding_ids=request.finding_ids,
        triage_status=request.triage_status,
    )
    return {"updated": count}


@router.patch("/{finding_id}", response_model=FindingSummary)
async def update_finding_triage(
    project_id: str,
    finding_id: str,
    request: FindingTriageUpdateRequest,
    user_id: str = Depends(get_current_user),
    finding_service: FindingService = Depends(get_finding_service),
):
    return await finding_service.update_finding_triage(
        project_id=project_id,
        finding_id=finding_id,
        owner_id=user_id,
        triage_status=request.triage_status,
    )
