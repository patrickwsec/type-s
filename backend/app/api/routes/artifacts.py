from pathlib import Path

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse

from app.api.dependencies import get_artifact_service
from app.core.security import get_current_user
from app.schemas.artifacts import ArtifactListResponse
from app.schemas.common import ArtifactType
from app.services.artifacts import ArtifactService


router = APIRouter(prefix="/projects/{project_id}/artifacts")


@router.get("", response_model=ArtifactListResponse)
async def list_artifacts(
    project_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    artifact_type: ArtifactType | None = Query(default=None),
    task_id: str | None = Query(default=None),
    user_id: str = Depends(get_current_user),
    artifact_service: ArtifactService = Depends(get_artifact_service),
):
    return await artifact_service.list_artifacts(
        project_id=project_id,
        owner_id=user_id,
        page=page,
        page_size=page_size,
        artifact_type=artifact_type,
        task_id=task_id,
    )


@router.get("/by-id/{artifact_id}/content")
async def get_artifact_content(
    project_id: str,
    artifact_id: str,
    user_id: str = Depends(get_current_user),
    artifact_service: ArtifactService = Depends(get_artifact_service),
):
    artifact, artifact_path = await artifact_service.get_artifact_file_path(artifact_id, user_id)
    return FileResponse(
        path=str(artifact_path),
        media_type=artifact["content_type"],
        filename=Path(artifact["storage_key"]).name,
    )
