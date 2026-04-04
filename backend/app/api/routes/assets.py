from fastapi import APIRouter, Depends, Query

from app.api.dependencies import get_ingest_service
from app.core.security import get_current_user
from app.schemas.assets import (
    AssetDeleteRequest,
    AssetImportRequest,
    AssetListResponse,
    AssetMutationResponse,
    AssetTagUpdateRequest,
)
from app.services.ingest import IngestService


router = APIRouter(prefix="/projects/{project_id}/assets")


@router.get("", response_model=AssetListResponse)
async def list_assets(
    project_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    user_id: str = Depends(get_current_user),
    ingest_service: IngestService = Depends(get_ingest_service),
):
    return await ingest_service.list_assets(
        project_id=project_id,
        owner_id=user_id,
        page=page,
        page_size=page_size,
    )


@router.post("/tags", response_model=AssetMutationResponse)
async def add_asset_tags(
    project_id: str,
    request: AssetTagUpdateRequest,
    user_id: str = Depends(get_current_user),
    ingest_service: IngestService = Depends(get_ingest_service),
):
    updated_count = await ingest_service.add_asset_tags(
        project_id=project_id,
        owner_id=user_id,
        asset_ids=request.asset_ids,
        tags=request.tags,
    )
    return AssetMutationResponse(
        updated_count=updated_count,
        message="Asset tags updated.",
    )


@router.post("/import", response_model=AssetMutationResponse)
async def import_assets(
    project_id: str,
    request: AssetImportRequest,
    user_id: str = Depends(get_current_user),
    ingest_service: IngestService = Depends(get_ingest_service),
):
    imported_count = await ingest_service.import_manual_assets(
        project_id=project_id,
        owner_id=user_id,
        items=[item.model_dump() for item in request.items],
    )
    return AssetMutationResponse(
        updated_count=imported_count,
        message="Assets imported.",
    )


@router.delete("/tags", response_model=AssetMutationResponse)
async def remove_asset_tags(
    project_id: str,
    request: AssetTagUpdateRequest,
    user_id: str = Depends(get_current_user),
    ingest_service: IngestService = Depends(get_ingest_service),
):
    updated_count = await ingest_service.remove_asset_tags(
        project_id=project_id,
        owner_id=user_id,
        asset_ids=request.asset_ids,
        tags=request.tags,
    )
    return AssetMutationResponse(
        updated_count=updated_count,
        message="Asset tags removed.",
    )


@router.post("/delete", response_model=AssetMutationResponse)
async def delete_assets(
    project_id: str,
    request: AssetDeleteRequest,
    user_id: str = Depends(get_current_user),
    ingest_service: IngestService = Depends(get_ingest_service),
):
    deleted_count = await ingest_service.delete_assets(
        project_id=project_id,
        owner_id=user_id,
        asset_ids=request.asset_ids,
    )
    return AssetMutationResponse(
        deleted_count=deleted_count,
        message="Assets deleted.",
    )
