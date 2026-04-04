from datetime import datetime, timezone
import ipaddress
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4

from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.assets import AssetRepository, build_asset_list_response
from app.services.artifacts import ARTIFACTS_ROOT
from app.services.project_access import get_project_for_user


class IngestService:
    def __init__(self, database: AsyncIOMotorDatabase):
        self.database = database
        self.projects = database["projects"]
        self.repository = AssetRepository(database)

    async def upsert_enumerated_assets(
        self,
        *,
        project_id: str,
        owner_id: str,
        task_id: str,
        discovered_hosts: list[dict],
        enrichment_by_hostname: dict[str, dict],
    ) -> dict:
        now = datetime.now(timezone.utc)
        assets_upserted = 0
        live_http_assets = 0

        for host in discovered_hosts:
            hostname = host["hostname"]
            enrichment = enrichment_by_hostname.get(hostname, {})
            primary_url = enrichment.get("primary_url")
            ports = self._extract_ports(primary_url)
            ip_addresses = self._unique_list(
                [*host.get("ip_addresses", []), *enrichment.get("ip_addresses", [])]
            )
            technologies = self._unique_list(enrichment.get("technologies", []))

            if primary_url:
                live_http_assets += 1

            await self.repository.upsert_asset(
                project_id=project_id,
                owner_id=owner_id,
                hostname=hostname,
                asset_document={
                    "project_id": project_id,
                    "owner_id": owner_id,
                    "hostname": hostname,
                    "primary_url": primary_url,
                    "status_code": enrichment.get("status_code"),
                    "title": enrichment.get("title"),
                    "webserver": enrichment.get("webserver"),
                    "screenshot_storage_key": enrichment.get("screenshot_storage_key"),
                    "ip_addresses": ip_addresses,
                    "ports": ports,
                    "technologies": technologies,
                    "tags": [],
                    "source_task_id": task_id,
                    "last_seen_at": now,
                    "updated_at": now,
                },
                set_on_insert={
                    "_id": f"asset_{uuid4()}",
                    "first_seen_at": now,
                    "created_at": now,
                },
            )
            assets_upserted += 1

        return {
            "assets_upserted": assets_upserted,
            "live_http_assets": live_http_assets,
        }

    async def list_assets(
        self,
        *,
        project_id: str,
        owner_id: str,
        page: int,
        page_size: int,
    ):
        await get_project_for_user(self.projects, project_id, owner_id)
        items, total = await self.repository.list_assets(
            project_id=project_id,
            owner_id=owner_id,
            page=page,
            page_size=page_size,
        )
        return build_asset_list_response(
            items,
            page=page,
            page_size=page_size,
            total=total,
        )

    async def add_asset_tags(
        self,
        *,
        project_id: str,
        owner_id: str,
        asset_ids: list[str],
        tags: list[str],
    ) -> int:
        await get_project_for_user(self.projects, project_id, owner_id)
        if not asset_ids:
            raise HTTPException(status_code=400, detail="asset_ids is required")
        normalized_tags = self._unique_list([tag.strip() for tag in tags if str(tag).strip()])
        if not normalized_tags:
            raise HTTPException(status_code=400, detail="tags is required")

        return await self.repository.add_tags(
            project_id=project_id,
            owner_id=owner_id,
            asset_ids=asset_ids,
            tags=normalized_tags,
        )

    async def remove_asset_tags(
        self,
        *,
        project_id: str,
        owner_id: str,
        asset_ids: list[str],
        tags: list[str],
    ) -> int:
        await get_project_for_user(self.projects, project_id, owner_id)
        if not asset_ids:
            raise HTTPException(status_code=400, detail="asset_ids is required")
        normalized_tags = self._unique_list([tag.strip() for tag in tags if str(tag).strip()])
        if not normalized_tags:
            raise HTTPException(status_code=400, detail="tags is required")

        return await self.repository.remove_tags(
            project_id=project_id,
            owner_id=owner_id,
            asset_ids=asset_ids,
            tags=normalized_tags,
        )

    async def delete_assets(
        self,
        *,
        project_id: str,
        owner_id: str,
        asset_ids: list[str],
    ) -> int:
        await get_project_for_user(self.projects, project_id, owner_id)
        if not asset_ids:
            raise HTTPException(status_code=400, detail="asset_ids is required")

        deleted_count, assets_to_delete = await self.repository.delete_assets(
            project_id=project_id,
            owner_id=owner_id,
            asset_ids=asset_ids,
        )
        deleted_asset_ids = [asset["_id"] for asset in assets_to_delete]
        deleted_hostnames = [asset["hostname"] for asset in assets_to_delete if asset.get("hostname")]

        if deleted_asset_ids:
            await self.database["v2_findings"].delete_many(
                {
                    "project_id": project_id,
                    "owner_id": owner_id,
                    "asset_id": {"$in": deleted_asset_ids},
                }
            )
            await self.database["v2_artifacts"].delete_many(
                {
                    "project_id": project_id,
                    "owner_id": owner_id,
                    "$or": [
                        {"asset_id": {"$in": deleted_asset_ids}},
                        {"metadata.hostname": {"$in": deleted_hostnames}},
                    ],
                }
            )

        for asset in assets_to_delete:
            screenshot_storage_key = asset.get("screenshot_storage_key")
            if not screenshot_storage_key:
                continue
            artifact_path = ARTIFACTS_ROOT / screenshot_storage_key
            if artifact_path.exists():
                artifact_path.unlink(missing_ok=True)

        return deleted_count

    async def import_manual_assets(
        self,
        *,
        project_id: str,
        owner_id: str,
        items: list[dict],
    ) -> int:
        await get_project_for_user(self.projects, project_id, owner_id)
        if not items:
            raise HTTPException(status_code=400, detail="items is required")

        now = datetime.now(timezone.utc)
        imported_count = 0

        for item in items:
            hostname = str(item.get("hostname") or "").strip().lower()
            ip_address = str(item.get("ip_address") or "").strip()

            if not hostname and ip_address:
                hostname = ip_address.lower()
            if not hostname:
                continue

            ip_addresses = []
            if ip_address:
                ip_addresses.append(ip_address)
            elif self._looks_like_ip_address(hostname):
                ip_addresses.append(hostname)

            existing_asset = await self.database["v2_assets"].find_one(
                {
                    "project_id": project_id,
                    "owner_id": owner_id,
                    "hostname": hostname,
                }
            )

            merged_ip_addresses = self._unique_list(
                [
                    *(existing_asset or {}).get("ip_addresses", []),
                    *ip_addresses,
                ]
            )

            await self.repository.upsert_asset(
                project_id=project_id,
                owner_id=owner_id,
                hostname=hostname,
                asset_document={
                    "project_id": project_id,
                    "owner_id": owner_id,
                    "hostname": hostname,
                    "primary_url": (existing_asset or {}).get("primary_url"),
                    "status_code": (existing_asset or {}).get("status_code"),
                    "title": (existing_asset or {}).get("title"),
                    "webserver": (existing_asset or {}).get("webserver"),
                    "screenshot_storage_key": (existing_asset or {}).get("screenshot_storage_key"),
                    "ip_addresses": merged_ip_addresses,
                    "ports": list((existing_asset or {}).get("ports", [])),
                    "technologies": list((existing_asset or {}).get("technologies", [])),
                    "tags": list((existing_asset or {}).get("tags", [])),
                    "source_task_id": (existing_asset or {}).get("source_task_id"),
                    "last_seen_at": now,
                    "updated_at": now,
                },
                set_on_insert={
                    "_id": f"asset_{uuid4()}",
                    "first_seen_at": now,
                    "created_at": now,
                },
            )
            imported_count += 1

        if imported_count == 0:
            raise HTTPException(
                status_code=400,
                detail="At least one item with a hostname or IP address is required.",
            )

        return imported_count

    @staticmethod
    def _extract_ports(primary_url: str | None) -> list[int]:
        if not primary_url:
            return []

        parsed = urlparse(primary_url)
        if parsed.port:
            return [parsed.port]
        if parsed.scheme == "https":
            return [443]
        if parsed.scheme == "http":
            return [80]
        return []

    @staticmethod
    def _unique_list(values: list) -> list:
        seen = []
        for value in values:
            if value in (None, "", []):
                continue
            if value not in seen:
                seen.append(value)
        return seen

    @staticmethod
    def _looks_like_ip_address(value: str) -> bool:
        try:
            ipaddress.ip_address(value)
            return True
        except ValueError:
            return False
