from fastapi import APIRouter

from app.api.routes import analytics, assets, artifacts, exports, findings, projects, tasks, tools


api_router = APIRouter()
api_router.include_router(projects.router, tags=["projects"])
api_router.include_router(analytics.router, tags=["analytics"])
api_router.include_router(exports.router, tags=["exports"])
api_router.include_router(assets.router, tags=["assets"])
api_router.include_router(findings.router, tags=["findings"])
api_router.include_router(artifacts.router, tags=["artifacts"])
api_router.include_router(tasks.router, tags=["tasks"])
api_router.include_router(tools.router, tags=["tools"])
