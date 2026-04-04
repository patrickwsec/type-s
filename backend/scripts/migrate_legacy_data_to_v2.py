#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import mimetypes
import os
import shutil
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pymongo import MongoClient
from pymongo.errors import OperationFailure


MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongo:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "typesdb")
TASK_TYPE = "analyze_project"
TASK_STATUS = "completed"
APPROVAL_MODE = "auto"
SYSTEM_ACTOR = "system.migration"
TRIAGE_STATUS = "new"
SEVERITY_RANKS = {
    "info": 0,
    "low": 1,
    "medium": 2,
    "high": 3,
    "critical": 4,
}


@dataclass
class ProjectMigrationSummary:
    project_id: str
    project_name: str
    owner_id: str
    legacy_subdomains: int = 0
    legacy_vulnerabilities: int = 0
    assets_inserted: int = 0
    assets_updated: int = 0
    findings_inserted: int = 0
    findings_updated: int = 0
    screenshot_artifacts_inserted: int = 0
    screenshot_files_copied: int = 0
    screenshots_missing_source: int = 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Import legacy subdomains/vulnerabilities into the v2 assets/findings model. "
            "Dry-run by default."
        )
    )
    parser.add_argument(
        "--project-id",
        action="append",
        dest="project_ids",
        help="Legacy project ObjectId string to migrate. Repeat for multiple projects.",
    )
    parser.add_argument(
        "--all-projects",
        action="store_true",
        help="Migrate every project in the legacy projects collection.",
    )
    parser.add_argument(
        "--include-screenshots",
        action="store_true",
        help="Backfill screenshot artifacts when legacy screenshot files still exist.",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Write changes to MongoDB and the v2 artifact storage. Without this flag the script only reports what it would do.",
    )
    parser.add_argument(
        "--legacy-screenshots-root",
        default=None,
        help="Override the legacy screenshots root. Defaults to backend/screenshots or /app/screenshots when present.",
    )
    parser.add_argument(
        "--v2-artifacts-root",
        default=None,
        help="Override the v2 artifacts root. Defaults to V2_ARTIFACTS_DIR, /app/data/v2_artifacts, or backend/data/v2_artifacts.",
    )
    args = parser.parse_args()
    if not args.all_projects and not args.project_ids:
        parser.error("Pass --project-id or --all-projects.")
    return args


def repo_backend_root() -> Path:
    return Path(__file__).resolve().parent.parent


def resolve_legacy_screenshots_root(value: str | None) -> Path:
    if value:
        return Path(value).expanduser().resolve()
    container_path = Path("/app/screenshots")
    if container_path.exists():
        return container_path
    return (repo_backend_root() / "screenshots").resolve()


def resolve_v2_artifacts_root(value: str | None) -> Path:
    if value:
        return Path(value).expanduser().resolve()
    env_value = os.getenv("V2_ARTIFACTS_DIR")
    if env_value:
        return Path(env_value).expanduser().resolve()
    container_path = Path("/app/data/v2_artifacts")
    if container_path.parent.exists():
        return container_path
    return (repo_backend_root() / "data" / "v2_artifacts").resolve()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def coerce_datetime(value: Any, *, fallback: datetime | None = None) -> datetime:
    if value is None:
        return fallback or utc_now()
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    if isinstance(value, str):
        normalized = value.strip().replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(normalized)
            if parsed.tzinfo is None:
                return parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)
        except ValueError:
            return fallback or utc_now()
    return fallback or utc_now()


def normalize_hostname(value: Any) -> str | None:
    hostname = str(value or "").strip().lower()
    return hostname or None


def unique_list(values: list[Any]) -> list[Any]:
    seen: list[Any] = []
    for value in values:
        if value in (None, "", [], {}):
            continue
        if value not in seen:
            seen.append(value)
    return seen


def normalize_ip_addresses(value: Any) -> list[str]:
    if isinstance(value, list):
        raw_values = value
    elif isinstance(value, str):
        raw_values = [part.strip() for part in value.split(",")]
    else:
        raw_values = []

    normalized = []
    for item in raw_values:
        item_value = str(item).strip()
        if not item_value or item_value.upper() == "N/A":
            continue
        normalized.append(item_value)
    return unique_list(normalized)


def normalize_ports(value: Any) -> list[int]:
    if isinstance(value, list):
        raw_values = value
    elif value in (None, ""):
        raw_values = []
    else:
        raw_values = [value]

    ports: list[int] = []
    for item in raw_values:
        port_value = item.get("port") if isinstance(item, dict) else item
        try:
            port = int(port_value)
        except (TypeError, ValueError):
            continue
        if 0 < port <= 65535 and port not in ports:
            ports.append(port)
    return sorted(ports)


def normalize_string_list(value: Any) -> list[str]:
    if isinstance(value, list):
        raw_values = value
    elif isinstance(value, str):
        raw_values = [value]
    else:
        raw_values = []
    return unique_list([str(item).strip() for item in raw_values if str(item).strip()])


def normalize_severity(value: Any) -> str:
    severity = str(value or "").strip().lower()
    return severity if severity in SEVERITY_RANKS else "info"


def truncate_text(value: Any, limit: int) -> str | None:
    if value in (None, ""):
        return None
    text = str(value)
    if len(text) <= limit:
        return text
    return f"{text[:limit]}\n\n[truncated]"


def canonicalize_location(value: Any) -> str | None:
    from urllib.parse import urlparse

    if not value:
        return None
    parsed_input = str(value)
    parsed = urlparse(parsed_input if "://" in parsed_input else f"https://{parsed_input}")
    hostname = parsed.hostname
    if not hostname:
        return parsed_input

    scheme = parsed.scheme or "https"
    port = parsed.port
    netloc = hostname.lower()
    if port and not ((scheme == "http" and port == 80) or (scheme == "https" and port == 443)):
        netloc = f"{netloc}:{port}"

    path = parsed.path or ""
    query = f"?{parsed.query}" if parsed.query else ""
    fragment = f"#{parsed.fragment}" if parsed.fragment else ""
    return f"{scheme}://{netloc}{path}{query}{fragment}"


def build_finding_dedupe_key(
    *,
    hostname: str,
    template_id: Any,
    matcher_name: Any,
    matched_at: Any,
    extracted_results: list[str],
) -> str:
    dedupe_source = "|".join(
        [
            hostname,
            str(template_id or ""),
            str(matcher_name or ""),
            str(canonicalize_location(matched_at) or ""),
            ",".join(sorted(extracted_results)),
        ]
    )
    return hashlib.sha256(dedupe_source.encode("utf-8")).hexdigest()


def build_evidence_summary(
    *,
    matched_at: Any,
    matcher_name: Any,
    extracted_results: list[str],
) -> str | None:
    if extracted_results:
        return "; ".join(extracted_results[:3])
    if matcher_name and matched_at:
        return f"{matcher_name} matched at {matched_at}"
    if matched_at:
        return f"Matched at {matched_at}"
    if matcher_name:
        return str(matcher_name)
    return None


def deterministic_id(prefix: str, *parts: str) -> str:
    digest = hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()
    return f"{prefix}_{digest[:24]}"


def ensure_v2_indexes(database) -> None:
    try:
        database["v2_assets"].create_index(
            [("project_id", 1), ("hostname", 1)],
            name="project_hostname_unique",
            unique=True,
        )
        database["v2_assets"].create_index(
            [("project_id", 1), ("owner_id", 1), ("last_seen_at", -1)],
            name="project_owner_last_seen_at",
        )
        database["v2_findings"].create_index(
            [("project_id", 1), ("dedupe_key", 1)],
            name="project_dedupe_key_unique",
            unique=True,
        )
        database["v2_findings"].create_index(
            [("project_id", 1), ("owner_id", 1), ("last_seen_at", -1)],
            name="project_owner_last_seen_at",
        )
        database["v2_artifacts"].create_index(
            [("project_id", 1), ("owner_id", 1), ("created_at", -1)],
            name="project_owner_created_at",
        )
        database["v2_tasks"].create_index(
            [("project_id", 1), ("owner_id", 1), ("created_at", -1)],
            name="project_owner_created_at",
        )
        database["v2_task_events"].create_index(
            [("task_id", 1), ("created_at", 1)],
            name="task_created_at",
        )
    except OperationFailure as exc:
        print(f"Warning: unable to ensure one or more v2 indexes: {exc}")


def load_projects(database, project_ids: list[str] | None, all_projects: bool) -> list[dict[str, Any]]:
    query: dict[str, Any] = {}
    if project_ids and not all_projects:
        from bson import ObjectId

        query["_id"] = {"$in": [ObjectId(project_id) for project_id in project_ids]}

    projects = list(database["projects"].find(query).sort("updated_at", -1))
    if project_ids and all_projects:
        selected = {project_id for project_id in project_ids}
        filtered = []
        for project in projects:
            if str(project["_id"]) in selected:
                filtered.append(project)
        return filtered
    return projects


def build_import_task(task_id: str, project: dict[str, Any], include_screenshots: bool) -> dict[str, Any]:
    created_at = coerce_datetime(project.get("created_at"))
    completed_at = coerce_datetime(project.get("updated_at"), fallback=created_at)
    owner_id = str(project.get("user_id"))
    project_id = str(project["_id"])
    return {
        "_id": task_id,
        "project_id": project_id,
        "owner_id": owner_id,
        "task_type": TASK_TYPE,
        "status": TASK_STATUS,
        "label": "Legacy Data Import",
        "requested_input": {
            "source": "legacy_subdomains",
            "include_screenshots": include_screenshots,
        },
        "approval_mode": APPROVAL_MODE,
        "created_by": SYSTEM_ACTOR,
        "assigned_agent": SYSTEM_ACTOR,
        "result_summary": {},
        "last_error": None,
        "started_at": created_at,
        "completed_at": completed_at,
        "created_at": created_at,
        "updated_at": completed_at,
    }


def upsert_import_task(database, task_document: dict[str, Any], execute: bool) -> None:
    if not execute:
        return
    database["v2_tasks"].update_one(
        {"_id": task_document["_id"]},
        {"$set": task_document},
        upsert=True,
    )

    created_event = {
        "_id": f"{task_document['_id']}_created",
        "task_id": task_document["_id"],
        "owner_id": task_document["owner_id"],
        "event_type": "task.created",
        "message": "Created synthetic task to anchor legacy data import provenance.",
        "payload": {"source": "legacy_subdomains"},
        "created_at": task_document["created_at"],
    }
    completed_event = {
        "_id": f"{task_document['_id']}_completed",
        "task_id": task_document["_id"],
        "owner_id": task_document["owner_id"],
        "event_type": "task.completed",
        "message": "Imported legacy assets and findings into the v2 model.",
        "payload": {},
        "created_at": task_document["completed_at"],
    }
    for event in (created_event, completed_event):
        database["v2_task_events"].update_one(
            {"_id": event["_id"]},
            {"$set": event},
            upsert=True,
        )


def update_import_task_summary(
    database,
    task_id: str,
    summary: ProjectMigrationSummary,
    *,
    execute: bool,
) -> None:
    if not execute:
        return
    result_summary = {
        "legacy_subdomains_seen": summary.legacy_subdomains,
        "legacy_vulnerabilities_seen": summary.legacy_vulnerabilities,
        "assets_inserted": summary.assets_inserted,
        "assets_updated": summary.assets_updated,
        "findings_inserted": summary.findings_inserted,
        "findings_updated": summary.findings_updated,
        "screenshot_artifacts_inserted": summary.screenshot_artifacts_inserted,
        "screenshot_files_copied": summary.screenshot_files_copied,
        "screenshots_missing_source": summary.screenshots_missing_source,
    }
    database["v2_tasks"].update_one(
        {"_id": task_id},
        {
            "$set": {
                "result_summary": result_summary,
                "updated_at": utc_now(),
                "completed_at": utc_now(),
            }
        },
    )
    database["v2_task_events"].update_one(
        {"_id": f"{task_id}_completed"},
        {
            "$set": {
                "payload": result_summary,
                "created_at": utc_now(),
            }
        },
    )


def migrate_screenshot_artifact(
    *,
    database,
    project_id: str,
    owner_id: str,
    task_id: str,
    asset_id: str,
    hostname: str,
    screenshot_path: str,
    observed_at: datetime,
    legacy_screenshots_root: Path,
    v2_artifacts_root: Path,
    execute: bool,
    summary: ProjectMigrationSummary,
) -> str | None:
    relative_legacy_path = Path(screenshot_path)
    source_path = legacy_screenshots_root / project_id / "screenshot" / relative_legacy_path
    if not source_path.exists():
        summary.screenshots_missing_source += 1
        return None

    storage_key = str(Path(project_id) / task_id / "screenshot" / relative_legacy_path)
    destination_path = v2_artifacts_root / storage_key
    if execute:
        destination_path.parent.mkdir(parents=True, exist_ok=True)
        if not destination_path.exists():
            shutil.copy2(source_path, destination_path)
            summary.screenshot_files_copied += 1

    existing_artifact = database["v2_artifacts"].find_one(
        {
            "project_id": project_id,
            "owner_id": owner_id,
            "task_id": task_id,
            "asset_id": asset_id,
            "artifact_type": "screenshot",
            "storage_key": storage_key,
        },
        {"_id": 1},
    )
    if existing_artifact:
        return storage_key

    artifact_document = {
        "_id": deterministic_id("artifact", project_id, asset_id, storage_key),
        "project_id": project_id,
        "owner_id": owner_id,
        "asset_id": asset_id,
        "task_id": task_id,
        "artifact_type": "screenshot",
        "storage_key": storage_key,
        "content_type": mimetypes.guess_type(source_path.name)[0] or "image/png",
        "metadata": {
            "hostname": hostname,
            "legacy_screenshot_path": screenshot_path,
            "imported_from": "legacy_subdomains",
        },
        "created_at": observed_at,
    }
    if execute:
        database["v2_artifacts"].insert_one(artifact_document)
    summary.screenshot_artifacts_inserted += 1
    return storage_key


def migrate_project(
    *,
    database,
    project: dict[str, Any],
    include_screenshots: bool,
    legacy_screenshots_root: Path,
    v2_artifacts_root: Path,
    execute: bool,
) -> ProjectMigrationSummary:
    project_id = str(project["_id"])
    owner_id = str(project.get("user_id"))
    project_name = project.get("name", project_id)
    summary = ProjectMigrationSummary(
        project_id=project_id,
        project_name=project_name,
        owner_id=owner_id,
    )
    task_id = f"task_legacy_import_{project_id}"
    task_document = build_import_task(task_id, project, include_screenshots)
    upsert_import_task(database, task_document, execute)

    cursor = database["subdomains"].find({"project_id": project_id}).sort("updated_at", 1)
    for subdomain in cursor:
        summary.legacy_subdomains += 1
        hostname = normalize_hostname(subdomain.get("domain"))
        if not hostname:
            continue

        observed_at = coerce_datetime(
            subdomain.get("updated_at") or subdomain.get("created_at"),
            fallback=coerce_datetime(project.get("updated_at")),
        )
        existing_asset = database["v2_assets"].find_one(
            {"project_id": project_id, "hostname": hostname},
            {"_id": 1},
        )
        asset_id = existing_asset["_id"] if existing_asset else deterministic_id("asset", project_id, hostname)

        screenshot_storage_key = None
        legacy_screenshot_path = str(subdomain.get("screenshot_path") or "").strip()
        if include_screenshots and legacy_screenshot_path:
            screenshot_storage_key = migrate_screenshot_artifact(
                database=database,
                project_id=project_id,
                owner_id=owner_id,
                task_id=task_id,
                asset_id=asset_id,
                hostname=hostname,
                screenshot_path=legacy_screenshot_path,
                observed_at=observed_at,
                legacy_screenshots_root=legacy_screenshots_root,
                v2_artifacts_root=v2_artifacts_root,
                execute=execute,
                summary=summary,
            )

        asset_set_document = {
            "project_id": project_id,
            "owner_id": owner_id,
            "hostname": hostname,
            "ip_addresses": normalize_ip_addresses(subdomain.get("ip_address")),
            "ports": normalize_ports(subdomain.get("ports")),
            "technologies": normalize_string_list(subdomain.get("tech")),
            "tags": normalize_string_list(subdomain.get("tags")),
            "last_seen_at": observed_at,
            "updated_at": observed_at,
        }
        primary_url = str(subdomain.get("url") or "").strip()
        title = str(subdomain.get("title") or "").strip()
        webserver = str(subdomain.get("webserver") or "").strip()
        if primary_url:
            asset_set_document["primary_url"] = primary_url
        if subdomain.get("status_code") is not None:
            try:
                asset_set_document["status_code"] = int(subdomain.get("status_code"))
            except (TypeError, ValueError):
                pass
        if title:
            asset_set_document["title"] = title
        if webserver:
            asset_set_document["webserver"] = webserver
        if screenshot_storage_key:
            asset_set_document["screenshot_storage_key"] = screenshot_storage_key

        if execute:
            database["v2_assets"].update_one(
                {"project_id": project_id, "hostname": hostname},
                {
                    "$set": asset_set_document,
                    "$setOnInsert": {
                        "_id": asset_id,
                        "first_seen_at": observed_at,
                        "created_at": observed_at,
                        "source_task_id": task_id,
                    },
                },
                upsert=True,
            )
        if existing_asset:
            summary.assets_updated += 1
        else:
            summary.assets_inserted += 1

        for vulnerability in subdomain.get("vulnerabilities", []):
            summary.legacy_vulnerabilities += 1
            severity = normalize_severity(vulnerability.get("severity"))
            extracted_results = normalize_string_list(vulnerability.get("extracted_results"))
            matched_at = (
                vulnerability.get("matched_at")
                or vulnerability.get("url")
                or vulnerability.get("host")
            )
            template_id = vulnerability.get("template_id")
            matcher_name = vulnerability.get("matcher_name")
            dedupe_key = build_finding_dedupe_key(
                hostname=hostname,
                template_id=template_id,
                matcher_name=matcher_name,
                matched_at=matched_at,
                extracted_results=extracted_results,
            )
            finding_observed_at = coerce_datetime(
                vulnerability.get("timestamp"),
                fallback=observed_at,
            )
            existing_finding = database["v2_findings"].find_one(
                {"project_id": project_id, "dedupe_key": dedupe_key},
                {"_id": 1},
            )
            finding_document = {
                "project_id": project_id,
                "owner_id": owner_id,
                "asset_id": asset_id,
                "asset_hostname": hostname,
                "category": "nuclei",
                "title": str(vulnerability.get("name") or template_id or "Untitled finding").strip(),
                "severity": severity,
                "severity_rank": SEVERITY_RANKS[severity],
                "description": str(vulnerability.get("description") or "").strip(),
                "evidence_summary": build_evidence_summary(
                    matched_at=matched_at,
                    matcher_name=matcher_name,
                    extracted_results=extracted_results,
                ),
                "references": normalize_string_list(vulnerability.get("reference")),
                "source": "legacy_nuclei",
                "template_id": template_id,
                "matcher_name": matcher_name,
                "matched_at": matched_at,
                "tags": normalize_string_list(vulnerability.get("tags")),
                "extracted_results": extracted_results,
                "curl_command": truncate_text(vulnerability.get("curl_command"), 4000),
                "request": truncate_text(vulnerability.get("request"), 20000),
                "response": truncate_text(vulnerability.get("response"), 20000),
                "metadata": {
                    "classification": vulnerability.get("classification", {}),
                    "legacy_scan_id": vulnerability.get("scan_id"),
                    "legacy_host": vulnerability.get("host"),
                    "legacy_url": vulnerability.get("url"),
                    "imported_from": "legacy_subdomains",
                },
                "dedupe_key": dedupe_key,
                "last_seen_at": finding_observed_at,
                "updated_at": finding_observed_at,
            }
            if execute:
                database["v2_findings"].update_one(
                    {"project_id": project_id, "dedupe_key": dedupe_key},
                    {
                        "$set": finding_document,
                        "$setOnInsert": {
                            "_id": existing_finding["_id"] if existing_finding else deterministic_id("finding", project_id, dedupe_key),
                            "first_seen_at": finding_observed_at,
                            "created_at": finding_observed_at,
                            "source_task_id": task_id,
                            "triage_status": TRIAGE_STATUS,
                        },
                    },
                    upsert=True,
                )
            if existing_finding:
                summary.findings_updated += 1
            else:
                summary.findings_inserted += 1

    update_import_task_summary(database, task_id, summary, execute=execute)
    return summary


def print_project_summary(summary: ProjectMigrationSummary) -> None:
    print(
        f"[{summary.project_id}] {summary.project_name}: "
        f"legacy_subdomains={summary.legacy_subdomains}, "
        f"legacy_vulnerabilities={summary.legacy_vulnerabilities}, "
        f"assets(inserted={summary.assets_inserted}, updated={summary.assets_updated}), "
        f"findings(inserted={summary.findings_inserted}, updated={summary.findings_updated}), "
        f"screenshots(inserted={summary.screenshot_artifacts_inserted}, copied={summary.screenshot_files_copied}, missing={summary.screenshots_missing_source})"
    )


def print_totals(summaries: list[ProjectMigrationSummary], execute: bool) -> None:
    totals = ProjectMigrationSummary(project_id="TOTAL", project_name="TOTAL", owner_id="")
    for summary in summaries:
        totals.legacy_subdomains += summary.legacy_subdomains
        totals.legacy_vulnerabilities += summary.legacy_vulnerabilities
        totals.assets_inserted += summary.assets_inserted
        totals.assets_updated += summary.assets_updated
        totals.findings_inserted += summary.findings_inserted
        totals.findings_updated += summary.findings_updated
        totals.screenshot_artifacts_inserted += summary.screenshot_artifacts_inserted
        totals.screenshot_files_copied += summary.screenshot_files_copied
        totals.screenshots_missing_source += summary.screenshots_missing_source

    print("")
    print("Totals:")
    print_project_summary(totals)
    print("")
    if execute:
        print("Migration completed.")
    else:
        print("Dry run only. Re-run with --execute to write the transformed data.")


def main() -> int:
    args = parse_args()
    legacy_screenshots_root = resolve_legacy_screenshots_root(args.legacy_screenshots_root)
    v2_artifacts_root = resolve_v2_artifacts_root(args.v2_artifacts_root)
    client = MongoClient(MONGO_URI)
    database = client[DATABASE_NAME]
    ensure_v2_indexes(database)

    projects = load_projects(database, args.project_ids, args.all_projects)
    if not projects:
        print("No matching projects found.")
        return 1

    if args.execute:
        v2_artifacts_root.mkdir(parents=True, exist_ok=True)

    summaries = []
    print(
        f"Using legacy screenshots root: {legacy_screenshots_root}\n"
        f"Using v2 artifacts root: {v2_artifacts_root}\n"
        f"Mode: {'execute' if args.execute else 'dry-run'}\n"
    )
    for project in projects:
        summary = migrate_project(
            database=database,
            project=project,
            include_screenshots=args.include_screenshots,
            legacy_screenshots_root=legacy_screenshots_root,
            v2_artifacts_root=v2_artifacts_root,
            execute=args.execute,
        )
        summaries.append(summary)
        print_project_summary(summary)

    print_totals(summaries, execute=args.execute)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
