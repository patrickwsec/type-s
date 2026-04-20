import asyncio
import json
import logging
import os
import socket
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.assets import AssetRepository
from app.repositories.tasks import TaskRepository
from app.schemas.common import ArtifactType, TaskEventType, TaskStatus, TaskType
from app.services.artifacts import ARTIFACTS_ROOT, ArtifactService
from app.services.findings import FindingService
from app.services.ingest import IngestService
from app.services.task_catalog import SUPPORTED_TASK_TYPES


WORKER_NAME = "fastapi-background-worker"
logger = logging.getLogger(__name__)
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
HTTPX_SCREENSHOT_THREADS = int(os.getenv("V2_HTTPX_SCREENSHOT_THREADS", "5"))
HTTPX_SCREENSHOT_TIMEOUT = int(os.getenv("V2_HTTPX_SCREENSHOT_TIMEOUT", "30"))
HTTPX_SCREENSHOT_IDLE = int(os.getenv("V2_HTTPX_SCREENSHOT_IDLE", "2"))

# Mapping from nmap service names → nuclei template tags.
# Used to auto-select templates based on discovered services.
_SERVICE_TAG_MAP: dict[str, list[str]] = {
    # Web
    "http":            ["http"],
    "http-alt":        ["http"],
    "http-proxy":      ["http"],
    "https":           ["http", "ssl"],
    "https-alt":       ["http", "ssl"],
    # SSL/TLS
    "ssl":             ["ssl"],
    # Remote access
    "ssh":             ["ssh", "network"],
    "telnet":          ["telnet", "network"],
    "rdp":             ["rdp", "network"],
    "ms-wbt-server":   ["rdp", "network"],
    "vnc":             ["vnc", "network"],
    # File transfer
    "ftp":             ["ftp", "network"],
    "sftp":            ["ftp", "network"],
    # Email
    "smtp":            ["smtp", "network"],
    "smtps":           ["smtp", "ssl", "network"],
    "submission":      ["smtp", "network"],
    "pop3":            ["pop3", "network"],
    "pop3s":           ["pop3", "ssl", "network"],
    "imap":            ["imap", "network"],
    "imaps":           ["imap", "ssl", "network"],
    # Databases
    "mysql":           ["mysql", "database"],
    "postgresql":      ["postgresql", "database"],
    "ms-sql-s":        ["mssql", "database"],
    "microsoft-ds":    ["smb", "network"],
    "netbios-ssn":     ["smb", "network"],
    "redis":           ["redis", "database"],
    "mongodb":         ["mongodb", "database"],
    "mongod":          ["mongodb", "database"],
    "oracle-tns":      ["oracle", "database"],
    "memcache":        ["network"],
    "cassandra":       ["network"],
    "elasticsearch":   ["elasticsearch", "database"],
    # Directory / infra
    "ldap":            ["ldap", "network"],
    "ldaps":           ["ldap", "ssl", "network"],
    "dns":             ["dns", "network"],
    "snmp":            ["snmp", "network"],
    "docker":          ["docker", "network"],
    "kubernetes":      ["network"],
}

# Services whose ports should be accessed with HTTPS even if not on the standard 443/8443.
_SSL_SERVICES = frozenset({"https", "https-alt", "ssl", "smtps", "pop3s", "imaps", "ldaps"})
# Services that speak plain HTTP.
_HTTP_SERVICES = frozenset({"http", "http-alt", "http-proxy", "https", "https-alt"})


def _is_valid_screenshot_file(path: Path) -> bool:
    try:
        if not path.is_file() or path.stat().st_size <= len(PNG_SIGNATURE):
            return False
        with path.open("rb") as screenshot_file:
            return screenshot_file.read(len(PNG_SIGNATURE)) == PNG_SIGNATURE
    except OSError:
        return False


class TaskCancelledError(RuntimeError):
    pass


class TaskWorkerService:
    def __init__(self, database: AsyncIOMotorDatabase, worker_name: str = WORKER_NAME):
        self.database = database
        self.task_repository = TaskRepository(database)
        self.asset_repository = AssetRepository(database)
        self.ingest_service = IngestService(database)
        self.finding_service = FindingService(database)
        self.artifact_service = ArtifactService(database)
        self.worker_name = worker_name

    async def recover_interrupted_tasks(self) -> None:
        """Mark tasks left in-flight by a previously crashed worker as failed."""
        count = await self.task_repository.recover_interrupted_tasks()
        if count:
            logger.warning(
                "Startup recovery: marked %d interrupted task(s) as failed.", count
            )

    async def run_next_task(self) -> bool:
        task_document = await self.task_repository.claim_next_task(
            assigned_agent=self.worker_name,
            supported_task_types=SUPPORTED_TASK_TYPES,
        )
        if not task_document:
            return False

        logger.info(
            "Claimed queued task %s (%s) for project %s",
            task_document["_id"],
            task_document["task_type"],
            task_document["project_id"],
        )
        await self._run_claimed_task(task_document)
        return True

    async def run_task(self, task_id: str) -> None:
        task_document = await self.task_repository.claim_task(
            task_id=task_id,
            assigned_agent=self.worker_name,
        )
        if not task_document:
            return

        logger.info(
            "Claimed explicit task %s (%s) for project %s",
            task_document["_id"],
            task_document["task_type"],
            task_document["project_id"],
        )
        await self._run_claimed_task(task_document)

    async def _run_claimed_task(self, task_document: dict) -> None:
        task_id = task_document["_id"]
        try:
            task_type = task_document["task_type"]
            await self._raise_if_cancellation_requested(
                task_id,
                "Task was cancelled before execution started.",
            )
            await self._append_event(
                task_document,
                TaskEventType.TASK_PLANNING_STARTED,
                "Task claimed by the background worker.",
                {"assigned_agent": self.worker_name},
            )

            if task_type == TaskType.ENUMERATE_SCOPE.value:
                result_summary = await self._run_enumerate_scope_task(task_document)
            elif task_type == TaskType.RUN_FINDINGS_SCAN.value:
                result_summary = await self._run_findings_scan_task(task_document)
            elif task_type == TaskType.PORT_SCAN.value:
                result_summary = await self._run_port_scan_task(task_document)
            elif task_type == TaskType.SERVICE_DISCOVERY.value:
                result_summary = await self._run_service_discovery_task(task_document)
            else:
                raise ValueError(f"Unsupported task type: {task_type}")

            await self._raise_if_cancellation_requested(
                task_id,
                "Task cancelled before completion.",
            )
            completed_at = datetime.now(timezone.utc)
            await self.task_repository.update_task(
                task_id,
                {
                    "status": TaskStatus.COMPLETED.value,
                    "updated_at": completed_at,
                    "completed_at": completed_at,
                    "result_summary": result_summary,
                },
            )
            logger.info(
                "Completed task %s with summary: %s",
                task_id,
                result_summary,
            )
            await self._append_event(
                task_document,
                TaskEventType.TASK_COMPLETED,
                "Task completed successfully.",
                result_summary,
            )
        except TaskCancelledError as exc:
            cancelled_at = datetime.now(timezone.utc)
            await self.task_repository.update_task(
                task_id,
                {
                    "status": TaskStatus.CANCELLED.value,
                    "updated_at": cancelled_at,
                    "completed_at": cancelled_at,
                    "last_error": str(exc),
                },
            )
            logger.info("Task %s cancelled: %s", task_id, exc)
            await self._append_event(
                task_document,
                TaskEventType.TASK_CANCELLED,
                "Task cancelled during execution.",
                {"reason": str(exc)},
            )
        except Exception as exc:
            failed_at = datetime.now(timezone.utc)
            await self.task_repository.update_task(
                task_id,
                {
                    "status": TaskStatus.FAILED.value,
                    "updated_at": failed_at,
                    "completed_at": failed_at,
                    "last_error": str(exc),
                },
            )
            logger.exception("Task %s failed", task_id)
            await self._append_event(
                task_document,
                TaskEventType.TASK_FAILED,
                "Task execution failed.",
                {"error": str(exc)},
            )

    async def _run_enumerate_scope_task(self, task_document: dict) -> dict:
        task_id = task_document["_id"]
        project_id = task_document["project_id"]
        owner_id = task_document["owner_id"]
        requested_input = task_document.get("requested_input", {})

        if requested_input.get("scope_type", "domain") != "domain":
            raise ValueError("Only domain scope is supported in Phase 1.")

        scope_value = (requested_input.get("scope_value") or "").strip().lower()
        if not scope_value:
            raise ValueError("requested_input.scope_value is required.")

        await self.task_repository.update_task(
            task_id,
            {
                "status": TaskStatus.RUNNING.value,
                "updated_at": datetime.now(timezone.utc),
            },
        )
        await self._append_event(
            task_document,
            TaskEventType.TASK_ENUMERATION_STARTED,
            f"Starting enumeration for {scope_value}.",
            {"scope_value": scope_value},
        )
        await self._raise_if_cancellation_requested(
            task_id,
            "Task cancelled before enumeration started.",
        )

        enumeration_warning = None
        try:
            discovered_hosts = await self._run_subfinder(scope_value, task_id=task_id)
        except TaskCancelledError:
            raise
        except Exception as exc:
            enumeration_warning = str(exc)
            discovered_hosts = []

        await self._raise_if_cancellation_requested(
            task_id,
            "Task cancelled after enumeration completed.",
        )
        discovered_hostnames = {host["hostname"] for host in discovered_hosts}
        if scope_value not in discovered_hostnames:
            discovered_hosts.insert(
                0,
                {
                    "hostname": scope_value,
                    "ip_addresses": [],
                },
            )

        discovered_hosts = self._dedupe_hosts(discovered_hosts)
        await self._append_event(
            task_document,
            TaskEventType.TASK_ENUMERATION_COMPLETED,
            f"Enumeration completed with {len(discovered_hosts)} discovered hosts.",
            {
                "discovered_hosts": len(discovered_hosts),
                "warning": enumeration_warning,
            },
        )

        include_http_enrichment = requested_input.get("include_http_enrichment", True)
        include_screenshots = requested_input.get("include_screenshots", False)
        enrichment_by_hostname: dict[str, dict] = {}
        enrichment_warning = None

        if include_http_enrichment and discovered_hosts:
            await self._append_event(
                task_document,
                TaskEventType.TASK_ENRICHMENT_STARTED,
                f"Starting HTTP enrichment for {len(discovered_hosts)} hosts.",
                {"candidate_hosts": len(discovered_hosts)},
            )
            await self._raise_if_cancellation_requested(
                task_id,
                "Task cancelled before HTTP enrichment started.",
            )
            try:
                enrichment_by_hostname = await self._run_httpx(
                    [host["hostname"] for host in discovered_hosts],
                    project_id=project_id,
                    task_id=task_id,
                    capture_screenshots=include_screenshots,
                )
            except TaskCancelledError:
                raise
            except Exception as exc:
                enrichment_warning = str(exc)
                enrichment_by_hostname = {}

            await self._append_event(
                task_document,
                TaskEventType.TASK_ENRICHMENT_COMPLETED,
                "HTTP enrichment completed.",
                {
                    "enriched_hosts": len(enrichment_by_hostname),
                    "warning": enrichment_warning,
                },
            )
            await self._raise_if_cancellation_requested(
                task_id,
                "Task cancelled after HTTP enrichment completed.",
            )

        await self.task_repository.update_task(
            task_id,
            {
                "status": TaskStatus.INGESTING.value,
                "updated_at": datetime.now(timezone.utc),
            },
        )
        await self._append_event(
            task_document,
            TaskEventType.TASK_INGEST_STARTED,
            "Ingesting normalized assets.",
            {"discovered_hosts": len(discovered_hosts)},
        )
        await self._raise_if_cancellation_requested(
            task_id,
            "Task cancelled before asset ingest started.",
        )

        ingest_summary = await self.ingest_service.upsert_enumerated_assets(
            project_id=project_id,
            owner_id=owner_id,
            task_id=task_id,
            discovered_hosts=discovered_hosts,
            enrichment_by_hostname=enrichment_by_hostname,
        )

        result_summary = {
            "scope_value": scope_value,
            "discovered_hosts": len(discovered_hosts),
            "enriched_hosts": len(enrichment_by_hostname),
            **ingest_summary,
            "enumeration_warning": enumeration_warning,
            "enrichment_warning": enrichment_warning,
        }
        artifact_count = await self._persist_workflow_artifacts(
            project_id=project_id,
            owner_id=owner_id,
            task_id=task_id,
            discovered_hosts=discovered_hosts,
            enrichment_by_hostname=enrichment_by_hostname,
            result_summary=result_summary,
        )
        result_summary["artifacts_created"] = artifact_count
        result_summary["screenshot_artifacts"] = len(
            [item for item in enrichment_by_hostname.values() if item.get("screenshot_storage_key")]
        )
        return result_summary

    async def _run_findings_scan_task(self, task_document: dict) -> dict:
        task_id = task_document["_id"]
        project_id = task_document["project_id"]
        owner_id = task_document["owner_id"]
        requested_input = task_document.get("requested_input", {})

        await self._raise_if_cancellation_requested(
            task_id,
            "Task cancelled before findings target resolution started.",
        )
        target_assets, target_urls = await self._resolve_findings_targets(
            project_id=project_id,
            owner_id=owner_id,
            requested_input=requested_input,
        )
        if not target_assets or not target_urls:
            raise ValueError("No v2 assets are available for a findings scan.")

        await self.task_repository.update_task(
            task_id,
            {
                "status": TaskStatus.RUNNING.value,
                "updated_at": datetime.now(timezone.utc),
            },
        )
        await self._append_event(
            task_document,
            TaskEventType.TASK_FINDINGS_SCAN_STARTED,
            f"Starting nuclei scan for {len(target_assets)} assets.",
            {
                "target_assets": len(target_assets),
                "target_urls": len(target_urls),
            },
        )
        await self._raise_if_cancellation_requested(
            task_id,
            "Task cancelled before nuclei execution started.",
        )

        # Auto-derive template tags from nmap-discovered services when the user
        # hasn't explicitly specified tags, templates, or run_all_templates.
        effective_input = requested_input
        if (
            not requested_input.get("tags")
            and not requested_input.get("templates")
            and not requested_input.get("run_all_templates")
        ):
            derived_tags = self._derive_tags_from_assets(target_assets)
            if derived_tags:
                logger.info(
                    "Smart scan: auto-derived nuclei tags from services: %s",
                    derived_tags,
                )
                effective_input = {**requested_input, "tags": derived_tags}

        nuclei_findings = await self._run_nuclei(target_urls, effective_input, task_id=task_id)
        await self._append_event(
            task_document,
            TaskEventType.TASK_FINDINGS_SCAN_COMPLETED,
            "Nuclei scan completed.",
            {
                "raw_findings": len(nuclei_findings),
                "target_assets": len(target_assets),
                "target_urls": len(target_urls),
            },
        )
        await self._raise_if_cancellation_requested(
            task_id,
            "Task cancelled after nuclei execution completed.",
        )

        await self.task_repository.update_task(
            task_id,
            {
                "status": TaskStatus.INGESTING.value,
                "updated_at": datetime.now(timezone.utc),
            },
        )
        await self._append_event(
            task_document,
            TaskEventType.TASK_INGEST_STARTED,
            "Ingesting normalized findings.",
            {"raw_findings": len(nuclei_findings)},
        )
        await self._raise_if_cancellation_requested(
            task_id,
            "Task cancelled before findings ingest started.",
        )

        ingest_summary = await self.finding_service.upsert_nuclei_findings(
            project_id=project_id,
            owner_id=owner_id,
            task_id=task_id,
            findings=nuclei_findings,
        )
        await self._append_event(
            task_document,
            TaskEventType.TASK_FINDINGS_INGEST_COMPLETED,
            "Findings ingested successfully.",
            ingest_summary,
        )

        result_summary = {
            "target_assets": len(target_assets),
            "target_urls": len(target_urls),
            **ingest_summary,
        }
        artifact_count = await self._persist_findings_artifacts(
            project_id=project_id,
            owner_id=owner_id,
            task_id=task_id,
            target_assets=target_assets,
            target_urls=target_urls,
            nuclei_findings=nuclei_findings,
            result_summary=result_summary,
        )
        result_summary["artifacts_created"] = artifact_count
        return result_summary

    async def _run_port_scan_task(self, task_document: dict) -> dict:
        task_id = task_document["_id"]
        project_id = task_document["project_id"]
        owner_id = task_document["owner_id"]
        requested_input = task_document.get("requested_input", {})

        targets = requested_input.get("targets", [])
        if not targets:
            raise ValueError("requested_input.targets is required.")

        await self.task_repository.update_task(
            task_id,
            {
                "status": TaskStatus.RUNNING.value,
                "updated_at": datetime.now(timezone.utc),
            },
        )
        await self._append_event(
            task_document,
            TaskEventType.TASK_PORT_SCAN_STARTED,
            f"Starting port scan for {len(targets)} target(s).",
            {"targets": targets},
        )
        await self._raise_if_cancellation_requested(
            task_id,
            "Task cancelled before port scan started.",
        )

        scan_results = await self._run_nmap(targets, requested_input, task_id=task_id)
        await self._append_event(
            task_document,
            TaskEventType.TASK_PORT_SCAN_COMPLETED,
            f"Port scan completed. Found {len(scan_results)} host/port combinations.",
            {"results_count": len(scan_results)},
        )
        await self._raise_if_cancellation_requested(
            task_id,
            "Task cancelled after port scan completed.",
        )

        # Group results by host — track both plain port list and full port details
        hosts_by_ip: dict[str, list[int]] = {}
        port_details_by_ip: dict[str, list[dict]] = {}
        for entry in scan_results:
            ip = entry.get("ip") or entry.get("host", "")
            port = entry.get("port")
            if ip and port:
                hosts_by_ip.setdefault(ip, [])
                port_details_by_ip.setdefault(ip, [])
                if port not in hosts_by_ip[ip]:
                    hosts_by_ip[ip].append(port)
                port_details_by_ip[ip].append({
                    "port": port,
                    "protocol": entry.get("protocol", "tcp"),
                    "service": entry.get("service"),
                    "product": entry.get("product"),
                    "version": entry.get("version"),
                    "extrainfo": entry.get("extrainfo"),
                    "scripts": entry.get("scripts", []),
                })

        create_assets = requested_input.get("create_assets", True)
        assets_upserted = 0
        if create_assets and hosts_by_ip:
            await self.task_repository.update_task(
                task_id,
                {
                    "status": TaskStatus.INGESTING.value,
                    "updated_at": datetime.now(timezone.utc),
                },
            )
            await self._append_event(
                task_document,
                TaskEventType.TASK_INGEST_STARTED,
                f"Creating assets for {len(hosts_by_ip)} discovered hosts.",
                {"hosts_count": len(hosts_by_ip)},
            )
            now = datetime.now(timezone.utc)
            for ip, ports in hosts_by_ip.items():
                await self.asset_repository.upsert_asset(
                    project_id=project_id,
                    owner_id=owner_id,
                    hostname=ip,
                    asset_document={
                        "project_id": project_id,
                        "owner_id": owner_id,
                        "hostname": ip,
                        "ip_addresses": [ip],
                        "ports": sorted(ports),
                        "port_details": sorted(
                            port_details_by_ip.get(ip, []),
                            key=lambda d: d["port"],
                        ),
                        "source_task_id": task_id,
                        "last_seen_at": now,
                        "updated_at": now,
                    },
                    set_on_insert={
                        "_id": f"asset_{uuid4()}",
                        "first_seen_at": now,
                        "created_at": now,
                        "primary_url": None,
                        "status_code": None,
                        "title": None,
                        "webserver": None,
                        "screenshot_storage_key": None,
                        "technologies": [],
                        "tags": ["port-scan"],
                    },
                )
                assets_upserted += 1

        result_summary = {
            "targets": targets,
            "active_hosts": len(hosts_by_ip),
            "total_open_ports": sum(len(p) for p in hosts_by_ip.values()),
            "host_ports": {ip: ports for ip, ports in hosts_by_ip.items()},
            "assets_upserted": assets_upserted,
        }
        return result_summary

    async def _run_service_discovery_task(self, task_document: dict) -> dict:
        task_id = task_document["_id"]
        project_id = task_document["project_id"]
        owner_id = task_document["owner_id"]
        requested_input = task_document.get("requested_input", {})

        await self._raise_if_cancellation_requested(
            task_id,
            "Task cancelled before service discovery target resolution started.",
        )

        # Resolve targets from hostnames/asset_ids
        asset_ids = self._normalize_string_list(requested_input.get("asset_ids"))
        hostnames = [v.lower() for v in self._normalize_string_list(requested_input.get("hostnames"))]
        max_assets = requested_input.get("max_assets")
        try:
            max_assets = int(max_assets) if max_assets is not None else None
        except (TypeError, ValueError):
            max_assets = None

        target_assets = await self.asset_repository.list_target_assets(
            project_id=project_id,
            owner_id=owner_id,
            asset_ids=asset_ids or None,
            hostnames=hostnames or None,
            limit=max_assets,
        )

        # Build httpx target list with ports
        httpx_targets = []
        requested_ports = self._normalize_ports(requested_input.get("ports"))
        for asset in target_assets:
            hostname = asset.get("hostname", "")
            if not hostname:
                continue
            if requested_ports:
                for port in requested_ports:
                    httpx_targets.append(f"{hostname}:{port}")
            else:
                asset_ports = self._normalize_ports(asset.get("ports"))
                if asset_ports:
                    for port in asset_ports:
                        httpx_targets.append(f"{hostname}:{port}")
                else:
                    httpx_targets.append(hostname)

        if not httpx_targets:
            # Fall back to raw hostnames
            httpx_targets = hostnames if hostnames else [a.get("hostname") for a in target_assets if a.get("hostname")]

        if not httpx_targets:
            raise ValueError("No targets available for service discovery.")

        await self.task_repository.update_task(
            task_id,
            {
                "status": TaskStatus.RUNNING.value,
                "updated_at": datetime.now(timezone.utc),
            },
        )
        include_screenshots = requested_input.get("include_screenshots", False)
        await self._append_event(
            task_document,
            TaskEventType.TASK_SERVICE_DISCOVERY_STARTED,
            f"Starting service discovery for {len(httpx_targets)} target(s).",
            {"target_count": len(httpx_targets), "include_screenshots": include_screenshots},
        )
        await self._raise_if_cancellation_requested(
            task_id,
            "Task cancelled before httpx execution started.",
        )

        enrichment_by_hostname = await self._run_httpx(
            httpx_targets,
            project_id=project_id,
            task_id=task_id,
            capture_screenshots=include_screenshots,
        )

        # DNS fallback: for assets that httpx didn't enrich (no HTTP response),
        # resolve their IP via DNS so the IP column is still populated.
        all_target_hostnames = {a.get("hostname", "").lower() for a in target_assets if a.get("hostname")}
        unenriched = all_target_hostnames - set(enrichment_by_hostname.keys())
        dns_resolved: dict[str, list[str]] = {}
        loop = asyncio.get_event_loop()
        for hostname in unenriched:
            try:
                infos = await loop.getaddrinfo(hostname, None, family=socket.AF_INET)
                ips = list({info[4][0] for info in infos if info[4]})
                if ips:
                    dns_resolved[hostname] = ips
                    await self.asset_repository.merge_asset_ips(
                        project_id=project_id,
                        owner_id=owner_id,
                        hostname=hostname,
                        ip_addresses=ips,
                    )
            except Exception:
                pass

        # Collect screenshots saved to disk by httpx (httpx embeds screenshot as base64 in JSON
        # but does NOT emit a screenshot_path field, so we scan the directory directly).
        if include_screenshots:
            screenshot_scan_dir = ARTIFACTS_ROOT / project_id / task_id / "screenshot"
            asset_id_by_hostname = {
                a.get("hostname", "").lower(): a.get("_id")
                for a in target_assets
                if a.get("hostname")
            }
            if screenshot_scan_dir.exists():
                for hostname_dir in screenshot_scan_dir.iterdir():
                    if not hostname_dir.is_dir():
                        continue
                    # Directory name is "<hostname>_<port>"; strip trailing _<digits> to get hostname
                    dir_name = hostname_dir.name
                    parts = dir_name.rsplit("_", 1)
                    hostname = parts[0] if len(parts) == 2 and parts[1].isdigit() else dir_name

                    for png_file in hostname_dir.glob("*.png"):
                        if not _is_valid_screenshot_file(png_file):
                            continue

                        # storage_key is relative to ARTIFACTS_ROOT
                        storage_key = str(png_file.relative_to(ARTIFACTS_ROOT))
                        asset_id = asset_id_by_hostname.get(hostname)

                        # Create the artifact DB record so the Screenshots tab can list it
                        await self.artifact_service.create_file_artifact(
                            project_id=project_id,
                            owner_id=owner_id,
                            task_id=task_id,
                            artifact_type=ArtifactType.SCREENSHOT,
                            storage_key=storage_key,
                            content_type="image/png",
                            metadata={"hostname": hostname},
                            asset_id=asset_id,
                        )

                        # Also store the key on the enrichment so upsert_enumerated_assets
                        # updates the asset document's screenshot_storage_key field.
                        if hostname in enrichment_by_hostname:
                            enrichment_by_hostname[hostname]["screenshot_storage_key"] = storage_key
                        else:
                            # Asset wasn't enriched by httpx (no HTTP response) — update directly
                            await self.asset_repository.assets.update_one(
                                {
                                    "project_id": project_id,
                                    "owner_id": owner_id,
                                    "hostname": hostname,
                                },
                                {"$set": {"screenshot_storage_key": storage_key}},
                            )

        await self._append_event(
            task_document,
            TaskEventType.TASK_SERVICE_DISCOVERY_COMPLETED,
            f"Service discovery completed. Enriched {len(enrichment_by_hostname)} hosts via HTTP, resolved {len(dns_resolved)} additional hosts via DNS.",
            {"enriched_hosts": len(enrichment_by_hostname), "dns_resolved": len(dns_resolved)},
        )
        await self._raise_if_cancellation_requested(
            task_id,
            "Task cancelled after service discovery completed.",
        )

        # Ingest enriched data into assets
        await self.task_repository.update_task(
            task_id,
            {
                "status": TaskStatus.INGESTING.value,
                "updated_at": datetime.now(timezone.utc),
            },
        )
        await self._append_event(
            task_document,
            TaskEventType.TASK_INGEST_STARTED,
            "Updating assets with service discovery data.",
            {"enriched_hosts": len(enrichment_by_hostname)},
        )

        ingest_summary = await self.ingest_service.upsert_enumerated_assets(
            project_id=project_id,
            owner_id=owner_id,
            task_id=task_id,
            discovered_hosts=[
                {"hostname": hostname, "ip_addresses": data.get("ip_addresses", [])}
                for hostname, data in enrichment_by_hostname.items()
            ],
            enrichment_by_hostname=enrichment_by_hostname,
        )

        result_summary = {
            "targets_scanned": len(httpx_targets),
            "enriched_hosts": len(enrichment_by_hostname),
            **ingest_summary,
        }
        return result_summary

    async def _append_event(
        self,
        task_document: dict,
        event_type: TaskEventType,
        message: str,
        payload: dict | None = None,
    ) -> None:
        await self.task_repository.insert_task_event(
            {
                "_id": f"task_event_{uuid4()}",
                "task_id": task_document["_id"],
                "project_id": task_document["project_id"],
                "owner_id": task_document["owner_id"],
                "event_type": event_type.value,
                "message": message,
                "payload": payload or {},
                "created_at": datetime.now(timezone.utc),
            }
        )

    async def _raise_if_cancellation_requested(
        self,
        task_id: str,
        message: str,
    ) -> None:
        latest_task = await self.task_repository.get_task_by_id(task_id)
        if not latest_task:
            raise TaskCancelledError(message)
        if latest_task.get("status") in {
            TaskStatus.CANCELLING.value,
            TaskStatus.CANCELLED.value,
        }:
            raise TaskCancelledError(message)

    async def _communicate_with_process(
        self,
        *,
        task_id: str,
        process: asyncio.subprocess.Process,
        timeout_seconds: int,
        timeout_message: str,
    ) -> tuple[bytes, bytes]:
        communicate_task = asyncio.create_task(process.communicate())
        deadline = asyncio.get_running_loop().time() + timeout_seconds

        try:
            while True:
                remaining = deadline - asyncio.get_running_loop().time()
                if remaining <= 0:
                    process.kill()
                    await communicate_task
                    raise RuntimeError(timeout_message)

                try:
                    return await asyncio.wait_for(
                        asyncio.shield(communicate_task),
                        timeout=min(1, remaining),
                    )
                except asyncio.TimeoutError:
                    await self._raise_if_cancellation_requested(
                        task_id,
                        "Task cancelled during external command execution.",
                    )
        except TaskCancelledError:
            process.kill()
            await communicate_task
            raise

    async def _run_subfinder(self, domain: str, *, task_id: str) -> list[dict]:
        command = ["/root/go/bin/subfinder", "-d", domain, "-active", "-ip", "-json"]
        process = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await self._communicate_with_process(
            task_id=task_id,
            process=process,
            timeout_seconds=20,
            timeout_message="Subfinder timed out after 20 seconds.",
        )

        if process.returncode != 0:
            raise RuntimeError(f"Subfinder failed: {stderr.decode().strip()}")

        hosts: list[dict] = []
        for line in stdout.decode().splitlines():
            if not line.strip():
                continue
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue

            hostname = (data.get("host") or "").strip().lower()
            if not hostname:
                continue

            ip_values = data.get("ip")
            if isinstance(ip_values, list):
                ip_addresses = [str(value) for value in ip_values if value]
            elif ip_values:
                ip_addresses = [str(ip_values)]
            else:
                ip_addresses = []

            hosts.append({"hostname": hostname, "ip_addresses": ip_addresses})

        return self._dedupe_hosts(hosts)

    async def _run_nmap(
        self,
        targets: list[str],
        requested_input: dict,
        *,
        task_id: str,
    ) -> list[dict]:
        from app.services.nmap_tool import run_nmap

        return await run_nmap(
            targets,
            ports=requested_input.get("ports") or None,
            top_ports=int(requested_input.get("top_ports") or 100),
            scan_type=requested_input.get("scan_type", "sT"),
            timing=requested_input.get("timing", 4),
            max_rate=requested_input.get("max_rate") or None,
            version_scan=bool(requested_input.get("version_scan", False)),
            default_scripts=bool(requested_input.get("default_scripts", False)),
            command_timeout=int(requested_input.get("command_timeout") or 300),
        )

    async def _run_httpx(
        self,
        hostnames: list[str],
        *,
        project_id: str,
        task_id: str,
        capture_screenshots: bool,
    ) -> dict[str, dict]:
        temp_path = None
        try:
            with tempfile.NamedTemporaryFile("w", delete=False) as temp_file:
                temp_file.write("\n".join(hostnames))
                temp_path = temp_file.name

            command = [
                "/root/go/bin/httpx",
                "-json",
                "-l",
                temp_path,
                "-status-code",
                "-tech-detect",
                "-follow-redirects",
                "-timeout",
                "5",
                "-silent",
            ]
            if capture_screenshots:
                screenshot_root = ARTIFACTS_ROOT / project_id / task_id
                screenshot_root.mkdir(parents=True, exist_ok=True)
                command.extend(
                    [
                        "-screenshot",
                        "-system-chrome",
                        "-screenshot-timeout",
                        str(HTTPX_SCREENSHOT_TIMEOUT),
                        "-screenshot-idle",
                        str(HTTPX_SCREENSHOT_IDLE),
                        "-exclude-screenshot-bytes",
                        "-exclude-headless-body",
                        "-threads",
                        str(HTTPX_SCREENSHOT_THREADS),
                        "-srd",
                        str(screenshot_root),
                    ]
                )
            process = await asyncio.create_subprocess_exec(
                *command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            screenshot_timeout = max(120, len(hostnames) * 8)
            stdout, stderr = await self._communicate_with_process(
                task_id=task_id,
                process=process,
                timeout_seconds=screenshot_timeout if capture_screenshots else 30,
                timeout_message=f"HTTPx timed out after {screenshot_timeout if capture_screenshots else 30} seconds.",
            )

            if process.returncode != 0:
                raise RuntimeError(f"HTTPx failed: {stderr.decode().strip()}")

            results: dict[str, dict] = {}
            for line in stdout.decode().splitlines():
                if not line.strip():
                    continue
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue

                hostname = self._extract_hostname(
                    data.get("input")
                    or data.get("host")
                    or data.get("url")
                    or data.get("final_url")
                )
                if not hostname:
                    continue

                ip_values = data.get("a", [])
                if isinstance(ip_values, str):
                    ip_values = [ip_values]

                tech_values = data.get("tech", [])
                if isinstance(tech_values, str):
                    tech_values = [tech_values]

                results[hostname] = {
                    "primary_url": data.get("final_url") or data.get("url"),
                    "ip_addresses": [str(value) for value in ip_values if value],
                    "technologies": [str(value) for value in tech_values if value],
                    "status_code": data.get("status_code"),
                    "title": data.get("title"),
                    "webserver": data.get("webserver"),
                    "screenshot_storage_key": self._extract_screenshot_storage_key(
                        data,
                        project_id=project_id,
                        task_id=task_id,
                    ),
                }

            return results
        finally:
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)

    async def _run_nuclei(
        self,
        target_urls: list[str],
        requested_input: dict,
        *,
        task_id: str,
    ) -> list[dict]:
        temp_path = None
        try:
            with tempfile.NamedTemporaryFile("w", delete=False) as temp_file:
                temp_file.write("\n".join(target_urls))
                temp_path = temp_file.name

            command = [
                "/root/go/bin/nuclei",
                "-l",
                temp_path,
                "-jsonl",
                "-rate-limit",
                str(requested_input.get("rate_limit") or 150),
                "-timeout",
                str(requested_input.get("timeout") or 10),
                "-retries",
                str(requested_input.get("retries") or 2),
            ]

            tags = self._normalize_string_list(requested_input.get("tags"))
            templates = self._normalize_string_list(requested_input.get("templates"))
            severity = self._normalize_string_list(requested_input.get("severity"))
            exclude_tags = self._normalize_string_list(requested_input.get("exclude_tags"))
            exclude_severity = self._normalize_string_list(requested_input.get("exclude_severity"))

            if tags:
                command.extend(["-tags", ",".join(tags)])
            elif templates:
                command.extend(["-t", ",".join(templates)])
            elif not requested_input.get("run_all_templates"):
                command.extend(["-tags", "cve,exposure,default-login"])

            if severity:
                command.extend(["-severity", ",".join(severity)])
            else:
                command.extend(["-severity", "medium,high,critical"])

            if exclude_tags:
                command.extend(["-exclude-tags", ",".join(exclude_tags)])
            if exclude_severity:
                command.extend(["-exclude-severity", ",".join(exclude_severity)])

            process = await asyncio.create_subprocess_exec(
                *command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await self._communicate_with_process(
                task_id=task_id,
                process=process,
                timeout_seconds=int(requested_input.get("command_timeout") or 300),
                timeout_message="Nuclei timed out before completion.",
            )

            if process.returncode != 0:
                raise RuntimeError(f"Nuclei failed: {stderr.decode().strip()}")

            findings: list[dict] = []
            for line in stdout.decode().splitlines():
                if not line.strip():
                    continue
                try:
                    findings.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
            return findings
        finally:
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)

    @staticmethod
    def _extract_hostname(value: str | None) -> str | None:
        if not value:
            return None

        parsed_value = value
        if "://" not in parsed_value:
            parsed_value = f"https://{parsed_value}"

        return urlparse(parsed_value).hostname

    @staticmethod
    def _dedupe_hosts(hosts: list[dict]) -> list[dict]:
        deduped: dict[str, dict] = {}
        for host in hosts:
            hostname = host["hostname"]
            current = deduped.setdefault(
                hostname,
                {
                    "hostname": hostname,
                    "ip_addresses": [],
                },
            )
            for ip_address in host.get("ip_addresses", []):
                if ip_address and ip_address not in current["ip_addresses"]:
                    current["ip_addresses"].append(ip_address)
        return list(deduped.values())

    async def _resolve_findings_targets(
        self,
        *,
        project_id: str,
        owner_id: str,
        requested_input: dict,
    ) -> tuple[list[dict], list[str]]:
        asset_ids = self._normalize_string_list(requested_input.get("asset_ids"))
        hostnames = [value.lower() for value in self._normalize_string_list(requested_input.get("hostnames"))]
        max_assets = requested_input.get("max_assets")
        try:
            max_assets = int(max_assets) if max_assets is not None else None
        except (TypeError, ValueError):
            max_assets = None

        target_assets = await self.asset_repository.list_target_assets(
            project_id=project_id,
            owner_id=owner_id,
            asset_ids=asset_ids or None,
            hostnames=hostnames or None,
            limit=max_assets,
        )

        target_urls: list[str] = []
        for asset in target_assets:
            target_urls.extend(self._build_nuclei_targets(asset, requested_input))

        return target_assets, self._dedupe_strings(target_urls)

    def _build_nuclei_targets(self, asset: dict, requested_input: dict) -> list[str]:
        hostname = asset.get("hostname")
        if not hostname:
            return []

        targets: list[str] = []
        primary_url = asset.get("primary_url")
        requested_ports = self._normalize_ports(requested_input.get("ports"))

        # Build a service-lookup map from port_details (set by nmap -sV)
        port_detail_map: dict[int, dict] = {
            pd["port"]: pd
            for pd in asset.get("port_details", [])
            if pd.get("port")
        }
        asset_ports = self._normalize_ports(asset.get("ports"))

        if requested_input.get("use_primary_url", True) and primary_url:
            targets.append(self._normalize_target_url(primary_url))

        ports = requested_ports or asset_ports
        if ports:
            for port in ports:
                detail = port_detail_map.get(port, {})
                service = (detail.get("service") or "").lower()
                extrainfo = (detail.get("extrainfo") or "").lower()

                # Use service name for accurate scheme detection.
                if service in _SSL_SERVICES or "ssl" in extrainfo or "tls" in extrainfo:
                    scheme = "https"
                elif service in _HTTP_SERVICES or port in {80, 8000, 8080, 8888, 3000, 5000}:
                    scheme = "http"
                elif port in {443, 8443}:
                    scheme = "https"
                else:
                    # Non-HTTP service — generate both schemes so nuclei can probe
                    scheme = "http"

                targets.append(self._normalize_target_url(f"{scheme}://{hostname}:{port}"))
        elif not primary_url:
            targets.extend(
                [
                    self._normalize_target_url(f"http://{hostname}"),
                    self._normalize_target_url(f"https://{hostname}"),
                ]
            )

        return self._dedupe_strings(targets)

    def _derive_tags_from_assets(self, assets: list[dict]) -> list[str]:
        """Derive nuclei template tags from services discovered by nmap."""
        service_names: set[str] = set()
        for asset in assets:
            for pd in asset.get("port_details", []):
                service = (pd.get("service") or "").lower().strip()
                if service:
                    service_names.add(service)
            # Fallback: infer from bare port numbers when port_details unavailable
            if not service_names:
                for port in asset.get("ports", []):
                    if port in {80, 8080, 8000, 8888, 3000, 5000}:
                        service_names.add("http")
                    elif port in {443, 8443}:
                        service_names.add("https")

        tags: list[str] = []
        for service in sorted(service_names):
            for tag in _SERVICE_TAG_MAP.get(service, []):
                if tag not in tags:
                    tags.append(tag)

        # Always include base vulnerability tags
        for base_tag in ("cve", "exposure", "default-login", "misconfig"):
            if base_tag not in tags:
                tags.append(base_tag)

        return tags

    @staticmethod
    def _normalize_ports(values) -> list[int]:
        if values is None:
            return []
        if not isinstance(values, list):
            values = [values]

        normalized: list[int] = []
        for value in values:
            try:
                port = int(value)
            except (TypeError, ValueError):
                continue
            if port > 0 and port not in normalized:
                normalized.append(port)
        return normalized

    @staticmethod
    def _normalize_string_list(values) -> list[str]:
        if values is None:
            return []
        if isinstance(values, str):
            values = [values]
        if not isinstance(values, list):
            return []

        normalized: list[str] = []
        for value in values:
            string_value = str(value).strip()
            if string_value and string_value not in normalized:
                normalized.append(string_value)
        return normalized

    @staticmethod
    def _dedupe_strings(values: list[str]) -> list[str]:
        normalized: list[str] = []
        for value in values:
            if value and value not in normalized:
                normalized.append(value)
        return normalized

    @staticmethod
    def _normalize_target_url(value: str) -> str:
        parsed = urlparse(value)
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

    @staticmethod
    def _extract_screenshot_storage_key(
        data: dict,
        *,
        project_id: str,
        task_id: str,
    ) -> str | None:
        screenshot_path = data.get("screenshot_path_rel") or data.get("screenshot_path")
        if not screenshot_path:
            return None

        screenshot_path = str(screenshot_path).strip().replace("\\", "/")
        if not screenshot_path:
            return None

        artifact_task_root = (ARTIFACTS_ROOT / project_id / task_id).resolve()
        try:
            path = Path(screenshot_path)
            if path.is_absolute():
                screenshot_path = path.resolve().relative_to(artifact_task_root).as_posix()
        except (OSError, ValueError):
            pass

        artifact_root = str(ARTIFACTS_ROOT / project_id / task_id).replace("\\", "/")
        if screenshot_path.startswith(f"{artifact_root}/"):
            screenshot_path = screenshot_path.replace(f"{artifact_root}/", "", 1)
        if screenshot_path.startswith("./"):
            screenshot_path = screenshot_path[2:]
        if f"{project_id}/{task_id}/" in screenshot_path:
            screenshot_path = screenshot_path.split(f"{project_id}/{task_id}/", 1)[-1]

        if screenshot_path.startswith("screenshot/"):
            relative_path = screenshot_path
        elif "/screenshot/" in screenshot_path:
            relative_path = f"screenshot/{screenshot_path.split('/screenshot/', 1)[-1]}"
        else:
            # httpx's screenshot_path_rel is relative to the screenshot directory.
            relative_path = f"screenshot/{screenshot_path}"

        storage_key = f"{project_id}/{task_id}/{relative_path}"
        return storage_key if _is_valid_screenshot_file(ARTIFACTS_ROOT / storage_key) else None

    async def _persist_workflow_artifacts(
        self,
        *,
        project_id: str,
        owner_id: str,
        task_id: str,
        discovered_hosts: list[dict],
        enrichment_by_hostname: dict[str, dict],
        result_summary: dict,
    ) -> int:
        artifact_count = 0

        await self.artifact_service.create_json_artifact(
            project_id=project_id,
            owner_id=owner_id,
            task_id=task_id,
            artifact_type=ArtifactType.RAW_OUTPUT,
            filename="discovered_hosts.json",
            payload=discovered_hosts,
            metadata={
                "record_count": len(discovered_hosts),
                "kind": "enumeration_output",
            },
        )
        artifact_count += 1

        if enrichment_by_hostname:
            await self.artifact_service.create_json_artifact(
                project_id=project_id,
                owner_id=owner_id,
                task_id=task_id,
                artifact_type=ArtifactType.RAW_OUTPUT,
                filename="http_enrichment.json",
                payload=enrichment_by_hostname,
                metadata={
                    "record_count": len(enrichment_by_hostname),
                    "kind": "http_enrichment_output",
                },
            )
            artifact_count += 1

        for hostname, enrichment in enrichment_by_hostname.items():
            screenshot_storage_key = enrichment.get("screenshot_storage_key")
            if not screenshot_storage_key:
                continue

            await self.artifact_service.create_file_artifact(
                project_id=project_id,
                owner_id=owner_id,
                task_id=task_id,
                artifact_type=ArtifactType.SCREENSHOT,
                storage_key=screenshot_storage_key,
                content_type="image/png",
                metadata={
                    "hostname": hostname,
                    "kind": "http_screenshot",
                },
            )
            artifact_count += 1

        await self.artifact_service.create_json_artifact(
            project_id=project_id,
            owner_id=owner_id,
            task_id=task_id,
            artifact_type=ArtifactType.REPORT,
            filename="task_summary.json",
            payload=result_summary,
            metadata={"kind": "task_summary"},
        )
        artifact_count += 1

        return artifact_count

    async def _persist_findings_artifacts(
        self,
        *,
        project_id: str,
        owner_id: str,
        task_id: str,
        target_assets: list[dict],
        target_urls: list[str],
        nuclei_findings: list[dict],
        result_summary: dict,
    ) -> int:
        artifact_count = 0

        await self.artifact_service.create_json_artifact(
            project_id=project_id,
            owner_id=owner_id,
            task_id=task_id,
            artifact_type=ArtifactType.RAW_OUTPUT,
            filename="nuclei_targets.json",
            payload=target_urls,
            metadata={
                "record_count": len(target_urls),
                "kind": "findings_scan_targets",
                "asset_count": len(target_assets),
            },
        )
        artifact_count += 1

        await self.artifact_service.create_json_artifact(
            project_id=project_id,
            owner_id=owner_id,
            task_id=task_id,
            artifact_type=ArtifactType.RAW_OUTPUT,
            filename="nuclei_findings.json",
            payload=nuclei_findings,
            metadata={
                "record_count": len(nuclei_findings),
                "kind": "nuclei_raw_findings",
            },
        )
        artifact_count += 1

        await self.artifact_service.create_json_artifact(
            project_id=project_id,
            owner_id=owner_id,
            task_id=task_id,
            artifact_type=ArtifactType.REPORT,
            filename="task_summary.json",
            payload=result_summary,
            metadata={"kind": "task_summary"},
        )
        artifact_count += 1

        return artifact_count
