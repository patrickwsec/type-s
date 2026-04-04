from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import PaginationMeta


class AssetSummary(BaseModel):
    id: str
    project_id: str
    hostname: str
    primary_url: str | None = None
    status_code: int | None = None
    title: str | None = None
    webserver: str | None = None
    screenshot_storage_key: str | None = None
    ip_addresses: list[str] = Field(default_factory=list)
    ports: list[int] = Field(default_factory=list)
    technologies: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    port_details: list[dict] = Field(default_factory=list)
    source_task_id: str | None = None
    first_seen_at: datetime
    last_seen_at: datetime


class AssetListResponse(BaseModel):
    items: list[AssetSummary]
    pagination: PaginationMeta


class AssetTagUpdateRequest(BaseModel):
    asset_ids: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


class AssetImportItem(BaseModel):
    hostname: str | None = None
    ip_address: str | None = None


class AssetImportRequest(BaseModel):
    items: list[AssetImportItem] = Field(default_factory=list)


class AssetDeleteRequest(BaseModel):
    asset_ids: list[str] = Field(default_factory=list)


class AssetMutationResponse(BaseModel):
    updated_count: int = 0
    deleted_count: int = 0
    message: str
