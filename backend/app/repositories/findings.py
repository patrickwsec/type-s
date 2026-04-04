import asyncio
import re
from math import ceil
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.schemas.common import PaginationMeta
from app.schemas.findings import FindingListResponse, FindingSummary

SORT_FIELD_MAP = {
    "severity": "severity_rank",
    "last_seen_at": "last_seen_at",
    "first_seen_at": "first_seen_at",
    "title": "title",
    "hostname": "asset_hostname",
}


_finding_indexes_ready = False
_finding_indexes_lock = asyncio.Lock()


class FindingRepository:
    def __init__(self, database: AsyncIOMotorDatabase):
        self.findings = database["v2_findings"]

    async def ensure_indexes(self) -> None:
        global _finding_indexes_ready

        if _finding_indexes_ready:
            return

        async with _finding_indexes_lock:
            if _finding_indexes_ready:
                return

            await self.findings.create_index(
                [("project_id", 1), ("dedupe_key", 1)],
                name="project_dedupe_key_unique",
                unique=True,
            )
            await self.findings.create_index(
                [("project_id", 1), ("owner_id", 1), ("last_seen_at", -1)],
                name="project_owner_last_seen_at",
            )
            await self.findings.create_index(
                [("asset_id", 1), ("last_seen_at", -1)],
                name="asset_last_seen_at",
            )
            await self.findings.create_index(
                [("source_task_id", 1), ("last_seen_at", -1)],
                name="source_task_last_seen_at",
            )
            await self.findings.create_index(
                [("severity", 1), ("triage_status", 1), ("last_seen_at", -1)],
                name="severity_triage_last_seen_at",
            )
            _finding_indexes_ready = True

    async def upsert_finding(
        self,
        *,
        project_id: str,
        dedupe_key: str,
        finding_document: dict[str, Any],
        set_on_insert: dict[str, Any],
    ) -> bool:
        await self.ensure_indexes()
        result = await self.findings.update_one(
            {"project_id": project_id, "dedupe_key": dedupe_key},
            {"$set": finding_document, "$setOnInsert": set_on_insert},
            upsert=True,
        )
        return result.upserted_id is not None

    async def list_findings(
        self,
        *,
        project_id: str,
        owner_id: str,
        page: int,
        page_size: int,
        severity: str | None = None,
        severity_list: list[str] | None = None,
        triage_status: str | None = None,
        triage_status_list: list[str] | None = None,
        source_task_id: str | None = None,
        asset_id: str | None = None,
        search: str | None = None,
        hostname: str | None = None,
        template_id: str | None = None,
        tags: list[str] | None = None,
        sort_by: str | None = None,
        sort_order: str | None = None,
    ) -> tuple[list[dict[str, Any]], int]:
        await self.ensure_indexes()

        filters: dict[str, Any] = {
            "project_id": project_id,
            "owner_id": owner_id,
        }

        # Single severity (backward compat) or multi-value
        if severity_list:
            filters["severity"] = {"$in": severity_list}
        elif severity:
            filters["severity"] = severity

        # Single triage (backward compat) or multi-value
        if triage_status_list:
            filters["triage_status"] = {"$in": triage_status_list}
        elif triage_status:
            filters["triage_status"] = triage_status

        if source_task_id:
            filters["source_task_id"] = source_task_id
        if asset_id:
            filters["asset_id"] = asset_id

        # Substring search across key text fields
        if search:
            safe = re.escape(search)
            search_regex = {"$regex": safe, "$options": "i"}
            filters["$or"] = [
                {"title": search_regex},
                {"description": search_regex},
                {"asset_hostname": search_regex},
                {"template_id": search_regex},
            ]

        if hostname:
            safe_host = re.escape(hostname)
            filters["asset_hostname"] = {"$regex": safe_host, "$options": "i"}

        if template_id:
            safe_tmpl = re.escape(template_id)
            filters["template_id"] = {"$regex": safe_tmpl, "$options": "i"}

        if tags:
            filters["tags"] = {"$all": tags}

        # Sorting
        sort_field = SORT_FIELD_MAP.get(sort_by, "severity_rank")
        direction = 1 if sort_order == "asc" else -1
        # For severity default, descending makes sense (critical first)
        sort_spec = [(sort_field, direction)]
        # Secondary sort for stability
        if sort_field != "last_seen_at":
            sort_spec.append(("last_seen_at", -1))

        total = await self.findings.count_documents(filters)
        cursor = (
            self.findings.find(filters)
            .sort(sort_spec)
            .skip((page - 1) * page_size)
            .limit(page_size)
        )
        items = await cursor.to_list(length=page_size)
        return items, total

    async def get_stats(
        self,
        *,
        project_id: str,
        owner_id: str,
    ) -> dict[str, Any]:
        """Aggregate severity and triage counts."""
        await self.ensure_indexes()

        pipeline = [
            {"$match": {"project_id": project_id, "owner_id": owner_id}},
            {
                "$facet": {
                    "severity": [
                        {"$group": {"_id": "$severity", "count": {"$sum": 1}}},
                    ],
                    "triage": [
                        {"$group": {"_id": "$triage_status", "count": {"$sum": 1}}},
                    ],
                    "total": [{"$count": "count"}],
                }
            },
        ]
        result = await self.findings.aggregate(pipeline).to_list(length=1)
        if not result:
            return {"severity_counts": {}, "triage_counts": {}, "total": 0}

        data = result[0]
        severity_counts = {item["_id"]: item["count"] for item in data.get("severity", [])}
        triage_counts = {item["_id"]: item["count"] for item in data.get("triage", [])}
        total = data["total"][0]["count"] if data.get("total") else 0
        return {"severity_counts": severity_counts, "triage_counts": triage_counts, "total": total}

    async def get_distinct_hostnames(
        self, *, project_id: str, owner_id: str
    ) -> list[str]:
        await self.ensure_indexes()
        values = await self.findings.distinct(
            "asset_hostname",
            {"project_id": project_id, "owner_id": owner_id, "asset_hostname": {"$ne": None}},
        )
        return sorted(values)

    async def get_distinct_template_ids(
        self, *, project_id: str, owner_id: str
    ) -> list[str]:
        await self.ensure_indexes()
        values = await self.findings.distinct(
            "template_id",
            {"project_id": project_id, "owner_id": owner_id, "template_id": {"$ne": None}},
        )
        return sorted(values)

    async def get_distinct_tags(
        self, *, project_id: str, owner_id: str
    ) -> list[str]:
        await self.ensure_indexes()
        values = await self.findings.distinct(
            "tags",
            {"project_id": project_id, "owner_id": owner_id},
        )
        return sorted(values)

    async def bulk_update_triage(
        self,
        *,
        project_id: str,
        owner_id: str,
        finding_ids: list[str],
        updates: dict[str, Any],
    ) -> int:
        await self.ensure_indexes()
        result = await self.findings.update_many(
            {
                "_id": {"$in": finding_ids},
                "project_id": project_id,
                "owner_id": owner_id,
            },
            {"$set": updates},
        )
        return result.modified_count

    async def update_finding(
        self,
        *,
        project_id: str,
        finding_id: str,
        owner_id: str,
        updates: dict[str, Any],
    ) -> dict[str, Any] | None:
        await self.ensure_indexes()
        return await self.findings.find_one_and_update(
            {
                "_id": finding_id,
                "project_id": project_id,
                "owner_id": owner_id,
            },
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )

    async def get_finding(
        self,
        *,
        project_id: str,
        finding_id: str,
        owner_id: str,
    ) -> dict[str, Any] | None:
        await self.ensure_indexes()
        return await self.findings.find_one(
            {
                "_id": finding_id,
                "project_id": project_id,
                "owner_id": owner_id,
            }
        )


def serialize_finding(finding_document: dict[str, Any]) -> FindingSummary:
    return FindingSummary(
        id=finding_document["_id"],
        project_id=finding_document["project_id"],
        asset_id=finding_document.get("asset_id"),
        asset_hostname=finding_document.get("asset_hostname"),
        category=finding_document.get("category", "nuclei"),
        title=finding_document.get("title", "Untitled finding"),
        severity=finding_document["severity"],
        description=finding_document.get("description", ""),
        evidence_summary=finding_document.get("evidence_summary"),
        references=finding_document.get("references", []),
        source=finding_document.get("source", "nuclei"),
        source_task_id=finding_document.get("source_task_id"),
        triage_status=finding_document.get("triage_status", "new"),
        template_id=finding_document.get("template_id"),
        matcher_name=finding_document.get("matcher_name"),
        matched_at=finding_document.get("matched_at"),
        tags=finding_document.get("tags", []),
        extracted_results=finding_document.get("extracted_results", []),
        curl_command=finding_document.get("curl_command"),
        request=finding_document.get("request"),
        response=finding_document.get("response"),
        metadata=finding_document.get("metadata", {}),
        first_seen_at=finding_document["first_seen_at"],
        last_seen_at=finding_document["last_seen_at"],
    )


def build_finding_list_response(
    items: list[dict[str, Any]],
    *,
    page: int,
    page_size: int,
    total: int,
) -> FindingListResponse:
    return FindingListResponse(
        items=[serialize_finding(item) for item in items],
        pagination=PaginationMeta(
            page=page,
            page_size=page_size,
            total=total,
            total_pages=ceil(total / page_size) if total else 0,
        ),
    )
