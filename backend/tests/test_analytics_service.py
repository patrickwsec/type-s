from datetime import datetime, timezone

from fastapi import HTTPException

from app.services.analytics import AnalyticsService
from tests.base import AsyncMongoTestCase


class AnalyticsServiceTests(AsyncMongoTestCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        self.service = AnalyticsService(self.database)
        now = datetime.now(timezone.utc)

        await self.database["v2_assets"].insert_many(
            [
                {
                    "_id": "asset_1",
                    "project_id": self.project_id,
                    "owner_id": self.owner_id,
                    "hostname": "app.example.com",
                    "status_code": 200,
                    "ports": [443],
                    "technologies": ["nginx", "react"],
                    "created_at": now,
                    "updated_at": now,
                    "first_seen_at": now,
                    "last_seen_at": now,
                },
                {
                    "_id": "asset_2",
                    "project_id": self.project_id,
                    "owner_id": self.owner_id,
                    "hostname": "admin.example.com",
                    "status_code": 200,
                    "ports": [443, 8443],
                    "technologies": ["nginx", "vue"],
                    "created_at": now,
                    "updated_at": now,
                    "first_seen_at": now,
                    "last_seen_at": now,
                },
                {
                    "_id": "asset_3",
                    "project_id": self.project_id,
                    "owner_id": self.owner_id,
                    "hostname": "mail.example.com",
                    "status_code": None,
                    "ports": [25],
                    "technologies": ["postfix"],
                    "created_at": now,
                    "updated_at": now,
                    "first_seen_at": now,
                    "last_seen_at": now,
                },
            ]
        )
        await self.database["v2_findings"].insert_many(
            [
                {
                    "_id": "finding_1",
                    "project_id": self.project_id,
                    "owner_id": self.owner_id,
                    "asset_id": "asset_1",
                    "title": "WAF Detection",
                    "severity": "info",
                    "matcher_name": "Cloudflare",
                    "created_at": now,
                    "updated_at": now,
                    "first_seen_at": now,
                    "last_seen_at": now,
                },
                {
                    "_id": "finding_2",
                    "project_id": self.project_id,
                    "owner_id": self.owner_id,
                    "asset_id": "asset_2",
                    "title": "WAF Detection",
                    "severity": "info",
                    "matcher_name": "Fastly",
                    "created_at": now,
                    "updated_at": now,
                    "first_seen_at": now,
                    "last_seen_at": now,
                },
                {
                    "_id": "finding_3",
                    "project_id": self.project_id,
                    "owner_id": self.owner_id,
                    "asset_id": "asset_2",
                    "title": "Exposed Dashboard",
                    "severity": "high",
                    "created_at": now,
                    "updated_at": now,
                    "first_seen_at": now,
                    "last_seen_at": now,
                },
                {
                    "_id": "finding_4",
                    "project_id": self.project_id,
                    "owner_id": self.owner_id,
                    "asset_id": "asset_3",
                    "title": "Rare Mail Issue",
                    "severity": "low",
                    "created_at": now,
                    "updated_at": now,
                    "first_seen_at": now,
                    "last_seen_at": now,
                },
            ]
        )

    async def test_graph_data_covers_all_supported_graph_types(self):
        severity = await self.service.get_graph_data(
            project_id=self.project_id,
            owner_id=self.owner_id,
            graph_type="severity_summary",
        )
        ports = await self.service.get_graph_data(
            project_id=self.project_id,
            owner_id=self.owner_id,
            graph_type="ports_summary",
        )
        technology = await self.service.get_graph_data(
            project_id=self.project_id,
            owner_id=self.owner_id,
            graph_type="technology_summary",
        )
        vulnerabilities = await self.service.get_graph_data(
            project_id=self.project_id,
            owner_id=self.owner_id,
            graph_type="vulnerability_distribution",
        )
        anomalies = await self.service.get_graph_data(
            project_id=self.project_id,
            owner_id=self.owner_id,
            graph_type="anomalies",
        )
        waf = await self.service.get_graph_data(
            project_id=self.project_id,
            owner_id=self.owner_id,
            graph_type="waf_detection",
        )

        self.assertEqual(severity[0]["severity"], "info")
        self.assertEqual(severity[0]["count"], 2)
        self.assertEqual(ports, [{"port": 25, "count": 1}, {"port": 443, "count": 2}, {"port": 8443, "count": 1}])
        self.assertEqual(technology[0], {"technology": "nginx", "count": 2})
        self.assertEqual(vulnerabilities[0], {"name": "WAF Detection", "count": 2})
        self.assertEqual(waf["wafCounts"], {"Cloudflare": 1, "Fastly": 1})
        self.assertEqual(waf["totalWithWAF"], 2)
        self.assertEqual(waf["totalWithoutWAF"], 0)
        self.assertIn("nginx", anomalies)
        self.assertEqual(anomalies["Rare Mail Issue"], 1)

    async def test_graph_data_rejects_unknown_type(self):
        with self.assertRaises(ValueError):
            await self.service.get_graph_data(
                project_id=self.project_id,
                owner_id=self.owner_id,
                graph_type="not_supported",
            )

    async def test_graph_data_enforces_project_ownership(self):
        with self.assertRaises(HTTPException) as ctx:
            await self.service.get_graph_data(
                project_id=self.project_id,
                owner_id=self.other_owner_id,
                graph_type="severity_summary",
            )

        self.assertEqual(ctx.exception.status_code, 404)
