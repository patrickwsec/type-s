from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.api.dependencies import get_export_service
from app.core.security import get_current_user
from app.services.exports import ExportService


router = APIRouter(prefix="/projects/{project_id}/exports")


@router.get("/results.csv")
async def export_results_csv(
    project_id: str,
    user_id: str = Depends(get_current_user),
    export_service: ExportService = Depends(get_export_service),
):
    content = await export_service.build_results_csv(
        project_id=project_id,
        owner_id=user_id,
    )
    return StreamingResponse(
        iter([content]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="results_{project_id}.csv"'},
    )


@router.get("/results.md")
async def export_results_markdown(
    project_id: str,
    user_id: str = Depends(get_current_user),
    export_service: ExportService = Depends(get_export_service),
):
    content = await export_service.build_results_markdown(
        project_id=project_id,
        owner_id=user_id,
    )
    return StreamingResponse(
        iter([content]),
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="results_{project_id}.md"'},
    )
