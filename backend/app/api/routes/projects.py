from fastapi import APIRouter, Depends

from app.api.dependencies import get_project_service
from app.core.security import get_current_user
from app.schemas.projects import (
    ProjectCreateRequest,
    ProjectDeleteResponse,
    ProjectDetail,
    ProjectListResponse,
    ProjectOverviewResponse,
)
from app.services.projects import ProjectService


router = APIRouter(prefix="/projects")


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    user_id: str = Depends(get_current_user),
    project_service: ProjectService = Depends(get_project_service),
):
    return await project_service.list_projects(owner_id=user_id)


@router.post("", response_model=ProjectDetail)
async def create_project(
    request: ProjectCreateRequest,
    user_id: str = Depends(get_current_user),
    project_service: ProjectService = Depends(get_project_service),
):
    return await project_service.create_project(owner_id=user_id, request=request)


@router.get("/{project_id}", response_model=ProjectDetail)
async def get_project(
    project_id: str,
    user_id: str = Depends(get_current_user),
    project_service: ProjectService = Depends(get_project_service),
):
    return await project_service.get_project(project_id=project_id, owner_id=user_id)


@router.delete("/{project_id}", response_model=ProjectDeleteResponse)
async def delete_project(
    project_id: str,
    user_id: str = Depends(get_current_user),
    project_service: ProjectService = Depends(get_project_service),
):
    await project_service.delete_project(project_id=project_id, owner_id=user_id)
    return ProjectDeleteResponse(message="Project and associated data deleted.")


@router.get("/{project_id}/overview", response_model=ProjectOverviewResponse)
async def get_project_overview(
    project_id: str,
    user_id: str = Depends(get_current_user),
    project_service: ProjectService = Depends(get_project_service),
):
    return await project_service.get_project_overview(project_id=project_id, owner_id=user_id)
