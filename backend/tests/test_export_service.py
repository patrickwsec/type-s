import csv
from datetime import datetime, timezone
from io import StringIO

from app.services.exports import ExportService
from tests.base import AsyncMongoTestCase


class ExportServiceTests(AsyncMongoTestCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        self.service = ExportService(self.database)
        now = datetime.now(timezone.utc)

        await self.database["v2_assets"].insert_one(
            {
                "_id": "asset_export_1",
                "project_id": self.project_id,
                "owner_id": self.owner_id,
                "hostname": "app.example.com",
                "primary_url": "https://app.example.com",
                "status_code": 200,
                "webserver": "nginx",
                "title": "App",
                "ip_addresses": ["10.0.0.1"],
                "ports": [443],
                "technologies": ["nginx", "react"],
                "created_at": now,
                "updated_at": now,
                "first_seen_at": now,
                "last_seen_at": now,
            }
        )
        await self.database["v2_findings"].insert_many(
            [
                {
                    "_id": "finding_export_1",
                    "project_id": self.project_id,
                    "owner_id": self.owner_id,
                    "asset_id": "asset_export_1",
                    "asset_hostname": "app.example.com",
                    "title": "Exposed Dashboard",
                    "severity": "high",
                    "severity_rank": 3,
                    "triage_status": "new",
                    "references": ["https://example.com/advisory"],
                    "evidence_summary": "dashboard visible",
                    "dedupe_key": "export-app-dashboard",
                    "created_at": now,
                    "updated_at": now,
                    "first_seen_at": now,
                    "last_seen_at": now,
                },
                {
                    "_id": "finding_export_2",
                    "project_id": self.project_id,
                    "owner_id": self.owner_id,
                    "asset_hostname": "orphan.example.com",
                    "title": "Orphan Finding",
                    "severity": "low",
                    "severity_rank": 1,
                    "triage_status": "acknowledged",
                    "references": [],
                    "evidence_summary": "orphan evidence",
                    "dedupe_key": "export-orphan-finding",
                    "created_at": now,
                    "updated_at": now,
                    "first_seen_at": now,
                    "last_seen_at": now,
                },
            ]
        )

    async def test_build_results_csv_uses_v2_assets_and_findings(self):
        content = await self.service.build_results_csv(
            project_id=self.project_id,
            owner_id=self.owner_id,
        )

        rows = list(csv.DictReader(StringIO(content.lstrip("\ufeff"))))
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["Subdomain"], "app.example.com")
        self.assertIn("Exposed Dashboard", rows[0]["Vulnerabilities"])
        self.assertEqual(rows[1]["Subdomain"], "orphan.example.com")
        self.assertIn("Orphan Finding", rows[1]["Vulnerabilities"])

    async def test_build_results_markdown_uses_v2_assets_and_findings(self):
        content = await self.service.build_results_markdown(
            project_id=self.project_id,
            owner_id=self.owner_id,
        )

        self.assertIn("# Vulnerability Report", content)
        self.assertIn("### Asset: app.example.com", content)
        self.assertIn("Exposed Dashboard", content)
        self.assertIn("### Asset: orphan.example.com", content)
        self.assertIn("Orphan Finding", content)
