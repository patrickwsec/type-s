from datetime import datetime, timezone
import hashlib
from urllib.parse import urlparse
from uuid import uuid4

from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.findings import (
    FindingRepository,
    build_finding_list_response,
    serialize_finding,
)
from app.schemas.common import FindingTriageStatus, SeverityLevel
from app.schemas.findings import FindingStatsResponse, FindingSummary
from app.services.project_access import get_project_for_user


SEVERITY_RANKS = {
    SeverityLevel.INFO.value: 0,
    SeverityLevel.LOW.value: 1,
    SeverityLevel.MEDIUM.value: 2,
    SeverityLevel.HIGH.value: 3,
    SeverityLevel.CRITICAL.value: 4,
}


class FindingService:
    def __init__(self, database: AsyncIOMotorDatabase):
        self.database = database
        self.projects = database["projects"]
        self.assets = database["v2_assets"]
        self.repository = FindingRepository(database)

    async def list_findings(
        self,
        *,
        project_id: str,
        owner_id: str,
        page: int,
        page_size: int,
        severity: SeverityLevel | None = None,
        severity_list: list[str] | None = None,
        triage_status: FindingTriageStatus | None = None,
        triage_status_list: list[str] | None = None,
        source_task_id: str | None = None,
        asset_id: str | None = None,
        search: str | None = None,
        hostname: str | None = None,
        template_id: str | None = None,
        tags: list[str] | None = None,
        sort_by: str | None = None,
        sort_order: str | None = None,
    ):
        await get_project_for_user(self.projects, project_id, owner_id)
        items, total = await self.repository.list_findings(
            project_id=project_id,
            owner_id=owner_id,
            page=page,
            page_size=page_size,
            severity=severity.value if severity else None,
            severity_list=severity_list,
            triage_status=triage_status.value if triage_status else None,
            triage_status_list=triage_status_list,
            source_task_id=source_task_id,
            asset_id=asset_id,
            search=search,
            hostname=hostname,
            template_id=template_id,
            tags=tags,
            sort_by=sort_by,
            sort_order=sort_order,
        )
        return build_finding_list_response(
            items,
            page=page,
            page_size=page_size,
            total=total,
        )

    async def get_stats(self, *, project_id: str, owner_id: str) -> FindingStatsResponse:
        await get_project_for_user(self.projects, project_id, owner_id)
        data = await self.repository.get_stats(project_id=project_id, owner_id=owner_id)
        return FindingStatsResponse(**data)

    async def get_distinct_hostnames(self, *, project_id: str, owner_id: str) -> list[str]:
        await get_project_for_user(self.projects, project_id, owner_id)
        return await self.repository.get_distinct_hostnames(project_id=project_id, owner_id=owner_id)

    async def get_distinct_template_ids(self, *, project_id: str, owner_id: str) -> list[str]:
        await get_project_for_user(self.projects, project_id, owner_id)
        return await self.repository.get_distinct_template_ids(project_id=project_id, owner_id=owner_id)

    async def get_distinct_tags(self, *, project_id: str, owner_id: str) -> list[str]:
        await get_project_for_user(self.projects, project_id, owner_id)
        return await self.repository.get_distinct_tags(project_id=project_id, owner_id=owner_id)

    async def bulk_update_triage(
        self,
        *,
        project_id: str,
        owner_id: str,
        finding_ids: list[str],
        triage_status: FindingTriageStatus,
    ) -> int:
        await get_project_for_user(self.projects, project_id, owner_id)
        count = await self.repository.bulk_update_triage(
            project_id=project_id,
            owner_id=owner_id,
            finding_ids=finding_ids,
            updates={
                "triage_status": triage_status.value,
                "updated_at": datetime.now(timezone.utc),
            },
        )
        return count

    async def upsert_nuclei_findings(
        self,
        *,
        project_id: str,
        owner_id: str,
        task_id: str,
        findings: list[dict],
    ) -> dict:
        now = datetime.now(timezone.utc)
        hostnames = sorted(
            {
                hostname
                for hostname in (
                    self._extract_hostname(item.get("host") or item.get("matched-at"))
                    for item in findings
                )
                if hostname
            }
        )

        assets_by_hostname = {}
        if hostnames:
            cursor = self.assets.find(
                {
                    "project_id": project_id,
                    "owner_id": owner_id,
                    "hostname": {"$in": hostnames},
                }
            )
            assets = await cursor.to_list(length=None)
            assets_by_hostname = {asset["hostname"]: asset for asset in assets}

        findings_upserted = 0
        new_findings = 0
        impacted_assets: set[str] = set()
        impacted_hosts: set[str] = set()
        severity_counts = {
            SeverityLevel.INFO.value: 0,
            SeverityLevel.LOW.value: 0,
            SeverityLevel.MEDIUM.value: 0,
            SeverityLevel.HIGH.value: 0,
            SeverityLevel.CRITICAL.value: 0,
        }

        for finding in findings:
            normalized = self._normalize_nuclei_finding(
                project_id=project_id,
                owner_id=owner_id,
                task_id=task_id,
                finding=finding,
                assets_by_hostname=assets_by_hostname,
                observed_at=now,
            )
            was_created = await self.repository.upsert_finding(
                project_id=project_id,
                dedupe_key=normalized["dedupe_key"],
                finding_document=normalized["document"],
                set_on_insert=normalized["set_on_insert"],
            )
            findings_upserted += 1
            if was_created:
                new_findings += 1

            asset_id = normalized["document"].get("asset_id")
            asset_hostname = normalized["document"].get("asset_hostname")
            severity = normalized["document"]["severity"]
            if asset_id:
                impacted_assets.add(asset_id)
            if asset_hostname:
                impacted_hosts.add(asset_hostname)
            severity_counts[severity] = severity_counts.get(severity, 0) + 1

        return {
            "findings_upserted": findings_upserted,
            "new_findings": new_findings,
            "existing_findings_seen": findings_upserted - new_findings,
            "assets_with_findings": len(impacted_assets),
            "hosts_with_findings": len(impacted_hosts),
            "severity_counts": severity_counts,
        }

    async def update_finding_triage(
        self,
        *,
        project_id: str,
        finding_id: str,
        owner_id: str,
        triage_status: FindingTriageStatus,
    ) -> FindingSummary:
        await get_project_for_user(self.projects, project_id, owner_id)
        updated_finding = await self.repository.update_finding(
            project_id=project_id,
            finding_id=finding_id,
            owner_id=owner_id,
            updates={
                "triage_status": triage_status.value,
                "updated_at": datetime.now(timezone.utc),
            },
        )
        if not updated_finding:
            raise HTTPException(status_code=404, detail="Finding not found")

        return serialize_finding(updated_finding)

    def _normalize_nuclei_finding(
        self,
        *,
        project_id: str,
        owner_id: str,
        task_id: str,
        finding: dict,
        assets_by_hostname: dict[str, dict],
        observed_at: datetime,
    ) -> dict:
        info = finding.get("info", {})
        hostname = self._extract_hostname(finding.get("host") or finding.get("matched-at"))
        asset = assets_by_hostname.get(hostname) if hostname else None

        severity = self._normalize_severity(info.get("severity"))
        title = (info.get("name") or finding.get("template-id") or "Untitled finding").strip()
        description = (info.get("description") or "").strip()
        references = self._normalize_string_list(info.get("reference"))
        tags = self._normalize_string_list(info.get("tags"))
        extracted_results = self._normalize_string_list(finding.get("extracted-results"))
        matched_at = finding.get("matched-at") or finding.get("host")
        matcher_name = finding.get("matcher-name")
        evidence_summary = self._build_evidence_summary(
            matched_at=matched_at,
            matcher_name=matcher_name,
            extracted_results=extracted_results,
        )
        classification = info.get("classification") if isinstance(info.get("classification"), dict) else {}
        metadata = {
            "classification": classification,
            "host": finding.get("host"),
            "matcher_status": finding.get("matcher-status"),
            "template_type": finding.get("type"),
        }

        dedupe_key = self._build_dedupe_key(
            hostname=hostname or "",
            template_id=finding.get("template-id"),
            matcher_name=matcher_name,
            matched_at=matched_at,
            extracted_results=extracted_results,
        )

        document = {
            "project_id": project_id,
            "owner_id": owner_id,
            "asset_id": asset["_id"] if asset else None,
            "asset_hostname": hostname,
            "category": "nuclei",
            "title": title,
            "severity": severity,
            "severity_rank": SEVERITY_RANKS[severity],
            "description": description,
            "evidence_summary": evidence_summary,
            "references": references,
            "source": "nuclei",
            "source_task_id": task_id,
            "triage_status": FindingTriageStatus.NEW.value,
            "template_id": finding.get("template-id"),
            "matcher_name": matcher_name,
            "matched_at": matched_at,
            "tags": tags,
            "extracted_results": extracted_results,
            "curl_command": self._truncate_text(finding.get("curl-command"), 4000),
            "request": self._truncate_text(finding.get("request"), 20000),
            "response": self._truncate_text(finding.get("response"), 20000),
            "metadata": metadata,
            "dedupe_key": dedupe_key,
            "last_seen_at": observed_at,
            "updated_at": observed_at,
        }
        set_on_insert = {
            "_id": f"finding_{uuid4()}",
            "first_seen_at": observed_at,
            "created_at": observed_at,
        }
        return {
            "dedupe_key": dedupe_key,
            "document": document,
            "set_on_insert": set_on_insert,
        }

    @staticmethod
    def _normalize_severity(value: str | None) -> str:
        normalized = (value or "").strip().lower()
        if normalized in SEVERITY_RANKS:
            return normalized
        return SeverityLevel.INFO.value

    @staticmethod
    def _normalize_string_list(value) -> list[str]:
        if isinstance(value, str):
            values = [value]
        elif isinstance(value, list):
            values = value
        else:
            values = []

        normalized: list[str] = []
        for item in values:
            string_value = str(item).strip()
            if string_value and string_value not in normalized:
                normalized.append(string_value)
        return normalized

    @staticmethod
    def _extract_hostname(value: str | None) -> str | None:
        if not value:
            return None

        parsed_value = value if "://" in value else f"https://{value}"
        hostname = urlparse(parsed_value).hostname
        return hostname.lower() if hostname else None

    @staticmethod
    def _build_dedupe_key(
        *,
        hostname: str,
        template_id: str | None,
        matcher_name: str | None,
        matched_at: str | None,
        extracted_results: list[str],
    ) -> str:
        canonical_location = FindingService._canonicalize_location(matched_at)
        dedupe_source = "|".join(
            [
                hostname,
                template_id or "",
                matcher_name or "",
                canonical_location or "",
                ",".join(sorted(extracted_results)),
            ]
        )
        return hashlib.sha256(dedupe_source.encode("utf-8")).hexdigest()

    @staticmethod
    def _build_evidence_summary(
        *,
        matched_at: str | None,
        matcher_name: str | None,
        extracted_results: list[str],
    ) -> str | None:
        if extracted_results:
            return "; ".join(extracted_results[:3])
        if matcher_name and matched_at:
            return f"{matcher_name} matched at {matched_at}"
        if matched_at:
            return f"Matched at {matched_at}"
        return matcher_name

    @staticmethod
    def _truncate_text(value: str | None, limit: int) -> str | None:
        if value is None:
            return None
        if len(value) <= limit:
            return value
        return f"{value[:limit]}\n\n[truncated]"

    @staticmethod
    def _canonicalize_location(value: str | None) -> str | None:
        if not value:
            return value

        parsed_input = value if "://" in value else f"https://{value}"
        parsed = urlparse(parsed_input)
        hostname = parsed.hostname
        if not hostname:
            return value

        scheme = parsed.scheme or "https"
        port = parsed.port
        netloc = hostname
        if port and not ((scheme == "http" and port == 80) or (scheme == "https" and port == 443)):
            netloc = f"{hostname}:{port}"

        path = parsed.path or ""
        query = f"?{parsed.query}" if parsed.query else ""
        fragment = f"#{parsed.fragment}" if parsed.fragment else ""
        return f"{scheme}://{netloc}{path}{query}{fragment}"
