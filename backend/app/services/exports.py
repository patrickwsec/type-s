import csv
from collections import defaultdict
from datetime import datetime, timezone
from io import StringIO

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.common import SeverityLevel
from app.services.project_access import get_project_for_user


class ExportService:
    def __init__(self, database: AsyncIOMotorDatabase):
        self.database = database
        self.projects = database["projects"]
        self.assets = database["v2_assets"]
        self.findings = database["v2_findings"]

    async def build_results_csv(
        self,
        *,
        project_id: str,
        owner_id: str,
    ) -> str:
        assets, orphan_hostnames, findings_by_asset_id, findings_by_hostname = await self._load_export_context(
            project_id=project_id,
            owner_id=owner_id,
        )

        fieldnames = [
            "Subdomain",
            "IP Address",
            "URL",
            "Status Code",
            "Web Server",
            "Vulnerabilities",
            "Title",
            "Ports",
            "CDN Name",
            "CDN Type",
            "Tech",
        ]

        rows = [
            self._build_csv_row(
                asset=asset,
                findings=self._findings_for_asset(
                    asset,
                    findings_by_asset_id=findings_by_asset_id,
                    findings_by_hostname=findings_by_hostname,
                ),
            )
            for asset in assets
        ]
        rows.extend(
            self._build_csv_row(
                asset={"hostname": hostname},
                findings=findings_by_hostname.get(hostname, []),
            )
            for hostname in orphan_hostnames
        )

        buffer = StringIO()
        writer = csv.DictWriter(buffer, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)

        return "\ufeff" + buffer.getvalue()

    async def build_results_markdown(
        self,
        *,
        project_id: str,
        owner_id: str,
    ) -> str:
        assets, orphan_hostnames, findings_by_asset_id, findings_by_hostname = await self._load_export_context(
            project_id=project_id,
            owner_id=owner_id,
        )

        all_findings = []
        sections = []
        for asset in assets:
            asset_findings = self._findings_for_asset(
                asset,
                findings_by_asset_id=findings_by_asset_id,
                findings_by_hostname=findings_by_hostname,
            )
            all_findings.extend(asset_findings)
            sections.append(self._build_markdown_section(asset, asset_findings))

        for hostname in orphan_hostnames:
            hostname_findings = findings_by_hostname.get(hostname, [])
            all_findings.extend(hostname_findings)
            sections.append(
                self._build_markdown_section({"hostname": hostname}, hostname_findings)
            )

        severity_counts = {severity.value: 0 for severity in SeverityLevel}
        for finding in all_findings:
            severity = str(finding.get("severity") or "").lower()
            if severity in severity_counts:
                severity_counts[severity] += 1

        generated_at = datetime.now(timezone.utc).isoformat()
        total_assets = len(assets) + len(orphan_hostnames)
        body = "\n\n".join(section for section in sections if section)
        if not body:
            body = "No assets or findings available."

        return (
            "# Vulnerability Report\n"
            f"### Project ID: {project_id}\n"
            f"### Total Assets: {total_assets}\n"
            f"### Report Generated: {generated_at}\n"
            "---\n"
            "### Vulnerability Summary\n"
            f"**Critical**: {severity_counts['critical']} | "
            f"**High**: {severity_counts['high']} | "
            f"**Medium**: {severity_counts['medium']} | "
            f"**Low**: {severity_counts['low']} | "
            f"**Info**: {severity_counts['info']}\n"
            "---\n\n"
            f"{body}\n"
        )

    async def _load_export_context(
        self,
        *,
        project_id: str,
        owner_id: str,
    ):
        await get_project_for_user(self.projects, project_id, owner_id)

        assets = await self.assets.find(
            {"project_id": project_id, "owner_id": owner_id}
        ).sort("hostname", 1).to_list(length=None)
        findings = await self.findings.find(
            {"project_id": project_id, "owner_id": owner_id}
        ).sort([("severity_rank", -1), ("title", 1)]).to_list(length=None)

        findings_by_asset_id: dict[str, list[dict]] = defaultdict(list)
        findings_by_hostname: dict[str, list[dict]] = defaultdict(list)
        for finding in findings:
            asset_id = finding.get("asset_id")
            hostname = finding.get("asset_hostname")
            if asset_id:
                findings_by_asset_id[asset_id].append(finding)
            elif hostname:
                findings_by_hostname[hostname].append(finding)

        asset_hostnames = {asset.get("hostname") for asset in assets if asset.get("hostname")}
        orphan_hostnames = sorted(
            hostname for hostname in findings_by_hostname.keys() if hostname not in asset_hostnames
        )
        return assets, orphan_hostnames, findings_by_asset_id, findings_by_hostname

    @staticmethod
    def _findings_for_asset(
        asset: dict,
        *,
        findings_by_asset_id: dict[str, list[dict]],
        findings_by_hostname: dict[str, list[dict]],
    ) -> list[dict]:
        asset_id = asset.get("_id")
        hostname = asset.get("hostname")
        findings = []
        if asset_id:
            findings.extend(findings_by_asset_id.get(asset_id, []))
        if hostname:
            findings.extend(findings_by_hostname.get(hostname, []))
        return findings

    @staticmethod
    def _build_csv_row(asset: dict, findings: list[dict]) -> dict[str, str]:
        ip_addresses = asset.get("ip_addresses") or []
        if isinstance(ip_addresses, str):
            ip_addresses = [ip_addresses]
        ports = asset.get("ports") or []
        technologies = asset.get("technologies") or []

        return {
            "Subdomain": asset.get("hostname", "N/A"),
            "IP Address": ", ".join(str(value) for value in ip_addresses) or "N/A",
            "URL": asset.get("primary_url") or "N/A",
            "Status Code": str(asset.get("status_code") or "N/A"),
            "Web Server": asset.get("webserver") or "N/A",
            "Vulnerabilities": "; ".join(
                f"Name: {finding.get('title', 'N/A')}, Severity: {finding.get('severity', 'N/A')}"
                for finding in findings
            ) or "None",
            "Title": asset.get("title") or "N/A",
            "Ports": ", ".join(str(value) for value in ports) or "N/A",
            "CDN Name": "N/A",
            "CDN Type": "N/A",
            "Tech": ", ".join(str(value) for value in technologies) or "N/A",
        }

    @staticmethod
    def _build_markdown_section(asset: dict, findings: list[dict]) -> str:
        hostname = asset.get("hostname", "N/A")
        ip_addresses = asset.get("ip_addresses") or []
        if isinstance(ip_addresses, str):
            ip_addresses = [ip_addresses]
        ports = asset.get("ports") or []
        technologies = asset.get("technologies") or []

        formatted_findings = "\n".join(
            (
                f"- **Name**: {finding.get('title', 'N/A')}\n"
                f"- **Severity**: {finding.get('severity', 'N/A')}\n"
                f"- **Evidence**: {finding.get('evidence_summary') or 'N/A'}\n"
                f"- **References**: {', '.join(finding.get('references', [])) or 'N/A'}\n"
                f"- **Triage**: {finding.get('triage_status', 'new')}"
            )
            for finding in findings
        ) or "No vulnerabilities found."

        return (
            f"### Asset: {hostname}\n"
            f"- **IP Address**: {', '.join(str(value) for value in ip_addresses) or 'N/A'}\n"
            f"- **URL**: {asset.get('primary_url') or 'N/A'}\n"
            f"- **Status Code**: {asset.get('status_code') or 'N/A'}\n"
            f"- **Web Server**: {asset.get('webserver') or 'N/A'}\n"
            f"- **Title**: {asset.get('title') or 'N/A'}\n"
            f"- **Ports**: {', '.join(str(value) for value in ports) or 'N/A'}\n"
            f"- **Tech**: {', '.join(str(value) for value in technologies) or 'N/A'}\n\n"
            "#### Vulnerabilities:\n"
            f"{formatted_findings}"
        )
