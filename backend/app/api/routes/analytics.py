from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.dependencies import get_analytics_service
from app.core.security import get_current_user
from app.schemas.analytics import GraphDataResponse
from app.services.analytics import AnalyticsService


router = APIRouter(prefix="/projects/{project_id}")


@router.get("/graph-data", response_model=GraphDataResponse)
async def get_graph_data(
    project_id: str,
    graph_type: str = Query(...),
    user_id: str = Depends(get_current_user),
    analytics_service: AnalyticsService = Depends(get_analytics_service),
):
    try:
        data = await analytics_service.get_graph_data(
            project_id=project_id,
            owner_id=user_id,
            graph_type=graph_type,
        )
        return GraphDataResponse(graph_type=graph_type, data=data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
