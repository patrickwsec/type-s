import asyncio
from math import ceil
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.assets import AssetListResponse, AssetSummary
from app.schemas.common import PaginationMeta


_asset_indexes_ready = False
_asset_indexes_lock = asyncio.Lock()


class AssetRepository:
    def __init__(self, database: AsyncIOMotorDatabase):
        self.assets = database["v2_assets"]

    async def ensure_indexes(self) -> None:
        global _asset_indexes_ready

        if _asset_indexes_ready:
            return

        async with _asset_indexes_lock:
            if _asset_indexes_ready:
                return

            await self.assets.create_index(
                [("project_id", 1), ("hostname", 1)],
                name="project_hostname_unique",
                unique=True,
            )
            await self.assets.create_index(
                [("project_id", 1), ("owner_id", 1), ("last_seen_at", -1)],
                name="project_owner_last_seen_at",
            )
            await self.assets.create_index(
                [("source_task_id", 1), ("project_id", 1)],
                name="source_task_project",
            )
            _asset_indexes_ready = True

    async def upsert_asset(
        self,
        *,
        project_id: str,
        owner_id: str,
        hostname: str,
        asset_document: dict[str, Any],
        set_on_insert: dict[str, Any],
    ) -> None:
        await self.ensure_indexes()
        await self.assets.update_one(
            {"project_id": project_id, "hostname": hostname},
            {"$set": asset_document, "$setOnInsert": set_on_insert},
            upsert=True,
        )

    async def merge_asset_ips(
        self,
        *,
        project_id: str,
        owner_id: str,
        hostname: str,
        ip_addresses: list[str],
    ) -> None:
        """Add new IP addresses to an existing asset without overwriting other fields."""
        await self.ensure_indexes()
        await self.assets.update_one(
            {"project_id": project_id, "owner_id": owner_id, "hostname": hostname},
            {"$addToSet": {"ip_addresses": {"$each": ip_addresses}}},
        )

    async def list_assets(
        self,
        *,
        project_id: str,
        owner_id: str,
        page: int,
        page_size: int,
    ) -> tuple[list[dict[str, Any]], int]:
        await self.ensure_indexes()

        filters = {"project_id": project_id, "owner_id": owner_id}
        total = await self.assets.count_documents(filters)
        cursor = (
            self.assets.find(filters)
            .sort("last_seen_at", -1)
            .skip((page - 1) * page_size)
            .limit(page_size)
        )
        items = await cursor.to_list(length=page_size)
        return items, total

    async def list_target_assets(
        self,
        *,
        project_id: str,
        owner_id: str,
        asset_ids: list[str] | None = None,
        hostnames: list[str] | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        await self.ensure_indexes()

        filters: dict[str, Any] = {
            "project_id": project_id,
            "owner_id": owner_id,
        }
        if asset_ids:
            filters["_id"] = {"$in": asset_ids}
        if hostnames:
            filters["hostname"] = {"$in": hostnames}

        cursor = self.assets.find(filters).sort("hostname", 1)
        if limit:
            cursor = cursor.limit(limit)
        return await cursor.to_list(length=limit or None)

    async def add_tags(
        self,
        *,
        project_id: str,
        owner_id: str,
        asset_ids: list[str],
        tags: list[str],
    ) -> int:
        await self.ensure_indexes()
        result = await self.assets.update_many(
            {
                "_id": {"$in": asset_ids},
                "project_id": project_id,
                "owner_id": owner_id,
            },
            {
                "$addToSet": {"tags": {"$each": tags}},
            },
        )
        return result.modified_count

    async def remove_tags(
        self,
        *,
        project_id: str,
        owner_id: str,
        asset_ids: list[str],
        tags: list[str],
    ) -> int:
        await self.ensure_indexes()
        result = await self.assets.update_many(
            {
                "_id": {"$in": asset_ids},
                "project_id": project_id,
                "owner_id": owner_id,
            },
            {
                "$pullAll": {"tags": tags},
            },
        )
        return result.modified_count

    async def delete_assets(
        self,
        *,
        project_id: str,
        owner_id: str,
        asset_ids: list[str],
    ) -> tuple[int, list[dict[str, Any]]]:
        await self.ensure_indexes()
        assets_to_delete = await self.assets.find(
            {
                "_id": {"$in": asset_ids},
                "project_id": project_id,
                "owner_id": owner_id,
            }
        ).to_list(length=None)
        result = await self.assets.delete_many(
            {
                "_id": {"$in": asset_ids},
                "project_id": project_id,
                "owner_id": owner_id,
            }
        )
        return result.deleted_count, assets_to_delete


def serialize_asset(asset_document: dict[str, Any]) -> AssetSummary:
    return AssetSummary(
        id=asset_document["_id"],
        project_id=asset_document["project_id"],
        hostname=asset_document["hostname"],
        primary_url=asset_document.get("primary_url"),
        status_code=asset_document.get("status_code"),
        title=asset_document.get("title"),
        webserver=asset_document.get("webserver"),
        screenshot_storage_key=asset_document.get("screenshot_storage_key"),
        ip_addresses=asset_document.get("ip_addresses", []),
        ports=asset_document.get("ports", []),
        technologies=asset_document.get("technologies", []),
        tags=asset_document.get("tags", []),
        port_details=asset_document.get("port_details", []),
        source_task_id=asset_document.get("source_task_id"),
        first_seen_at=asset_document["first_seen_at"],
        last_seen_at=asset_document["last_seen_at"],
    )


def build_asset_list_response(
    items: list[dict[str, Any]],
    *,
    page: int,
    page_size: int,
    total: int,
) -> AssetListResponse:
    return AssetListResponse(
        items=[serialize_asset(item) for item in items],
        pagination=PaginationMeta(
            page=page,
            page_size=page_size,
            total=total,
            total_pages=ceil(total / page_size) if total else 0,
        ),
    )
