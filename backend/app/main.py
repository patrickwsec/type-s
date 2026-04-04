import logging
import os
import sys

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_redoc_html, get_swagger_ui_html
from fastapi.openapi.utils import get_openapi

from app.api.router import api_router
from app.api.routes import auth as auth_routes
from app.api.routes import nuclei as nuclei_routes
from app.core.database import configure_database
from app.core.security import get_current_user


logger = logging.getLogger(__name__)
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

DEFAULT_CORS_ORIGINS = [
    "http://localhost",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:8000",
]


def _build_allowed_origins() -> list[str]:
    configured_origins = os.getenv("CORS_ALLOW_ORIGINS", "")
    if not configured_origins.strip():
        return DEFAULT_CORS_ORIGINS

    return [
        origin.strip()
        for origin in configured_origins.split(",")
        if origin.strip()
    ]


def _custom_openapi(app: FastAPI):
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title="Type S API",
        version="2.0.0",
        description="Task- and data-driven API for Type-S.",
        routes=app.routes,
    )
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        }
    }
    for path in openapi_schema["paths"].values():
        for method in path.values():
            security = method.get("security", [])
            security.append({"BearerAuth": []})
            method["security"] = security

    app.openapi_schema = openapi_schema
    return app.openapi_schema


def create_app() -> FastAPI:
    logging.basicConfig(
        level=getattr(logging, LOG_LEVEL, logging.INFO),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )

    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    configure_database(app)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_build_allowed_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(auth_routes.router, tags=["auth"])
    app.include_router(nuclei_routes.router, tags=["nuclei"])
    app.include_router(api_router, prefix="/v2")

    app.openapi = lambda: _custom_openapi(app)

    @app.get("/")
    async def read_root():
        return {"message": "Welcome to the API!"}

    @app.get("/health")
    async def healthcheck():
        return {"status": "ok"}

    @app.get("/docs", include_in_schema=False, dependencies=[Depends(get_current_user)])
    async def custom_docs():
        return get_swagger_ui_html(openapi_url="/openapi.json", title="API Docs")

    @app.get("/redoc", include_in_schema=False, dependencies=[Depends(get_current_user)])
    async def custom_redoc():
        return get_redoc_html(openapi_url="/openapi.json", title="ReDoc Documentation")

    @app.get("/openapi.json", include_in_schema=False, dependencies=[Depends(get_current_user)])
    async def get_openapi_schema():
        return app.openapi()

    return app


app = create_app()
