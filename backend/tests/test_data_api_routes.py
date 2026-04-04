from datetime import datetime, timezone

from bson import ObjectId
from app.core.security import get_current_user
from app.schemas.common import TaskStatus
from app.services.artifacts import ARTIFACTS_ROOT
from tests.api_base import V2ApiTestCase


class DataApiRouteTests(V2ApiTestCase):
    async def test_asset_finding_and_export_routes_return_v2_data(self):
        now = datetime.now(timezone.utc)
        await self.database["v2_assets"].insert_one(
            {
                "_id": "asset_route_1",
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
                "tags": [],
                "created_at": now,
                "updated_at": now,
                "first_seen_at": now,
                "last_seen_at": now,
            }
        )
        await self.database["v2_findings"].insert_one(
            {
                "_id": "finding_route_1",
                "project_id": self.project_id,
                "owner_id": self.owner_id,
                "asset_id": "asset_route_1",
                "asset_hostname": "app.example.com",
                "title": "Exposed Dashboard",
                "severity": "high",
                "severity_rank": 3,
                "triage_status": "new",
                "references": ["https://example.com/advisory"],
                "evidence_summary": "dashboard visible",
                "dedupe_key": "route-app-dashboard",
                "created_at": now,
                "updated_at": now,
                "first_seen_at": now,
                "last_seen_at": now,
            }
        )

        assets_response = await self.http_client.get(
            f"/v2/projects/{self.project_id}/assets",
            params={"page": 1, "page_size": 10},
        )
        findings_response = await self.http_client.get(
            f"/v2/projects/{self.project_id}/findings",
            params={"page": 1, "page_size": 10},
        )
        triage_response = await self.http_client.patch(
            f"/v2/projects/{self.project_id}/findings/finding_route_1",
            json={"triage_status": "resolved"},
        )
        filtered_findings_response = await self.http_client.get(
            f"/v2/projects/{self.project_id}/findings",
            params={"page": 1, "page_size": 10, "triage_status": "resolved"},
        )
        csv_response = await self.http_client.get(
            f"/v2/projects/{self.project_id}/exports/results.csv"
        )
        markdown_response = await self.http_client.get(
            f"/v2/projects/{self.project_id}/exports/results.md"
        )

        self.assertEqual(assets_response.status_code, 200)
        self.assertEqual(assets_response.json()["items"][0]["hostname"], "app.example.com")
        self.assertEqual(findings_response.status_code, 200)
        self.assertEqual(findings_response.json()["items"][0]["title"], "Exposed Dashboard")
        self.assertEqual(triage_response.status_code, 200)
        self.assertEqual(triage_response.json()["triage_status"], "resolved")
        self.assertEqual(filtered_findings_response.status_code, 200)
        self.assertEqual(len(filtered_findings_response.json()["items"]), 1)
        self.assertEqual(csv_response.status_code, 200)
        self.assertTrue(csv_response.headers["content-type"].startswith("text/csv"))
        self.assertIn("app.example.com", csv_response.text)
        self.assertIn("Exposed Dashboard", csv_response.text)
        self.assertEqual(markdown_response.status_code, 200)
        self.assertTrue(markdown_response.headers["content-type"].startswith("text/markdown"))
        self.assertIn("### Asset: app.example.com", markdown_response.text)
        self.assertIn("Exposed Dashboard", markdown_response.text)

    async def test_asset_mutation_routes_delete_cascades_related_records_and_file(self):
        now = datetime.now(timezone.utc)
        screenshot_storage_key = f"{self.project_id}/task_seed/screenshot.png"
        screenshot_path = ARTIFACTS_ROOT / screenshot_storage_key
        screenshot_path.parent.mkdir(parents=True, exist_ok=True)
        screenshot_path.write_bytes(b"fake-image")

        await self.database["v2_assets"].insert_one(
            {
                "_id": "asset_mutation_1",
                "project_id": self.project_id,
                "owner_id": self.owner_id,
                "hostname": "delete.example.com",
                "primary_url": "https://delete.example.com",
                "status_code": 200,
                "webserver": "nginx",
                "title": "Delete Me",
                "screenshot_storage_key": screenshot_storage_key,
                "ip_addresses": ["10.0.0.2"],
                "ports": [443],
                "technologies": ["nginx"],
                "tags": [],
                "created_at": now,
                "updated_at": now,
                "first_seen_at": now,
                "last_seen_at": now,
            }
        )
        await self.database["v2_findings"].insert_one(
            {
                "_id": "finding_mutation_1",
                "project_id": self.project_id,
                "owner_id": self.owner_id,
                "asset_id": "asset_mutation_1",
                "asset_hostname": "delete.example.com",
                "title": "Delete Me Finding",
                "severity": "medium",
                "severity_rank": 2,
                "triage_status": "new",
                "references": [],
                "evidence_summary": "to be deleted",
                "dedupe_key": "mutation-delete-finding",
                "created_at": now,
                "updated_at": now,
                "first_seen_at": now,
                "last_seen_at": now,
            }
        )
        await self.database["v2_artifacts"].insert_one(
            {
                "_id": "artifact_mutation_1",
                "project_id": self.project_id,
                "owner_id": self.owner_id,
                "asset_id": "asset_mutation_1",
                "task_id": "task_seed",
                "artifact_type": "screenshot",
                "storage_key": screenshot_storage_key,
                "content_type": "image/png",
                "metadata": {"hostname": "delete.example.com"},
                "created_at": now,
            }
        )

        add_tags_response = await self.http_client.post(
            f"/v2/projects/{self.project_id}/assets/tags",
            json={"asset_ids": ["asset_mutation_1"], "tags": ["prod", "external"]},
        )
        remove_tags_response = await self.http_client.request(
            "DELETE",
            f"/v2/projects/{self.project_id}/assets/tags",
            json={"asset_ids": ["asset_mutation_1"], "tags": ["prod"]},
        )
        delete_response = await self.http_client.post(
            f"/v2/projects/{self.project_id}/assets/delete",
            json={"asset_ids": ["asset_mutation_1"]},
        )

        self.assertEqual(add_tags_response.status_code, 200)
        self.assertEqual(add_tags_response.json()["updated_count"], 1)
        self.assertEqual(remove_tags_response.status_code, 200)
        self.assertEqual(remove_tags_response.json()["updated_count"], 1)
        self.assertEqual(delete_response.status_code, 200)
        self.assertEqual(delete_response.json()["deleted_count"], 1)
        self.assertFalse(await self.database["v2_assets"].find_one({"_id": "asset_mutation_1"}))
        self.assertEqual(
            await self.database["v2_findings"].count_documents({"_id": "finding_mutation_1"}),
            0,
        )
        self.assertEqual(
            await self.database["v2_artifacts"].count_documents({"_id": "artifact_mutation_1"}),
            0,
        )
        self.assertFalse(screenshot_path.exists())

    async def test_asset_import_route_upserts_manual_assets(self):
        import_response = await self.http_client.post(
            f"/v2/projects/{self.project_id}/assets/import",
            json={
                "items": [
                    {"hostname": "manual.example.com", "ip_address": "10.10.10.10"},
                    {"ip_address": "10.10.10.11"},
                ]
            },
        )
        duplicate_import_response = await self.http_client.post(
            f"/v2/projects/{self.project_id}/assets/import",
            json={"items": [{"hostname": "manual.example.com"}]},
        )
        assets_response = await self.http_client.get(
            f"/v2/projects/{self.project_id}/assets",
            params={"page": 1, "page_size": 10},
        )

        self.assertEqual(import_response.status_code, 200)
        self.assertEqual(import_response.json()["updated_count"], 2)
        self.assertEqual(duplicate_import_response.status_code, 200)
        self.assertEqual(duplicate_import_response.json()["updated_count"], 1)
        self.assertEqual(assets_response.status_code, 200)

        items = assets_response.json()["items"]
        hostnames = {item["hostname"] for item in items}
        self.assertIn("manual.example.com", hostnames)
        self.assertIn("10.10.10.11", hostnames)
        manual_asset = next(item for item in items if item["hostname"] == "manual.example.com")
        self.assertEqual(manual_asset["ip_addresses"], ["10.10.10.10"])

    async def test_asset_import_route_preserves_existing_asset_enrichment(self):
        now = datetime.now(timezone.utc)
        await self.database["v2_assets"].insert_one(
            {
                "_id": "asset_existing_manual_import",
                "project_id": self.project_id,
                "owner_id": self.owner_id,
                "hostname": "existing.example.com",
                "primary_url": "https://existing.example.com",
                "status_code": 200,
                "title": "Existing Asset",
                "webserver": "nginx",
                "screenshot_storage_key": "seed/screenshot.png",
                "ip_addresses": ["10.0.0.9"],
                "ports": [443],
                "technologies": ["nginx", "react"],
                "tags": ["prod"],
                "source_task_id": "task_existing",
                "created_at": now,
                "updated_at": now,
                "first_seen_at": now,
                "last_seen_at": now,
            }
        )

        import_response = await self.http_client.post(
            f"/v2/projects/{self.project_id}/assets/import",
            json={"items": [{"hostname": "existing.example.com", "ip_address": "10.0.0.10"}]},
        )

        self.assertEqual(import_response.status_code, 200)
        asset = await self.database["v2_assets"].find_one({"_id": "asset_existing_manual_import"})
        self.assertEqual(asset["primary_url"], "https://existing.example.com")
        self.assertEqual(asset["status_code"], 200)
        self.assertEqual(asset["title"], "Existing Asset")
        self.assertEqual(asset["webserver"], "nginx")
        self.assertEqual(asset["screenshot_storage_key"], "seed/screenshot.png")
        self.assertEqual(asset["ports"], [443])
        self.assertEqual(asset["technologies"], ["nginx", "react"])
        self.assertEqual(asset["tags"], ["prod"])
        self.assertEqual(asset["source_task_id"], "task_existing")
        self.assertEqual(asset["ip_addresses"], ["10.0.0.9", "10.0.0.10"])

    async def test_project_and_analytics_routes_return_expected_aggregates(self):
        now = datetime.now(timezone.utc)
        await self.database["v2_assets"].insert_many(
            [
                {
                    "_id": "asset_overview_1",
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
                    "_id": "asset_overview_2",
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
                    "_id": "finding_overview_1",
                    "project_id": self.project_id,
                    "owner_id": self.owner_id,
                    "asset_id": "asset_overview_1",
                    "asset_hostname": "app.example.com",
                    "title": "Exposed Dashboard",
                    "severity": "high",
                    "severity_rank": 3,
                    "triage_status": "new",
                    "references": [],
                    "evidence_summary": "dashboard visible",
                    "dedupe_key": "overview-dashboard",
                    "created_at": now,
                    "updated_at": now,
                    "first_seen_at": now,
                    "last_seen_at": now,
                },
                {
                    "_id": "finding_overview_2",
                    "project_id": self.project_id,
                    "owner_id": self.owner_id,
                    "asset_id": "asset_overview_2",
                    "asset_hostname": "mail.example.com",
                    "title": "Mail Banner",
                    "severity": "info",
                    "severity_rank": 0,
                    "triage_status": "acknowledged",
                    "references": [],
                    "evidence_summary": "mail banner",
                    "dedupe_key": "overview-mail-banner",
                    "created_at": now,
                    "updated_at": now,
                    "first_seen_at": now,
                    "last_seen_at": now,
                },
            ]
        )
        await self.database["v2_tasks"].insert_one(
            {
                "_id": "task_overview_1",
                "project_id": self.project_id,
                "owner_id": self.owner_id,
                "task_type": "enumerate_scope",
                "status": TaskStatus.COMPLETED.value,
                "label": "Enumerate example.com",
                "requested_input": {"scope_value": "example.com"},
                "approval_mode": "auto",
                "created_by": self.owner_id,
                "assigned_agent": "test-worker",
                "result_summary": {"assets_upserted": 2},
                "last_error": None,
                "started_at": now,
                "completed_at": now,
                "created_at": now,
                "updated_at": now,
            }
        )

        projects_response = await self.http_client.get("/v2/projects")
        project_response = await self.http_client.get(f"/v2/projects/{self.project_id}")
        overview_response = await self.http_client.get(
            f"/v2/projects/{self.project_id}/overview"
        )
        graph_response = await self.http_client.get(
            f"/v2/projects/{self.project_id}/graph-data",
            params={"graph_type": "severity_summary"},
        )
        invalid_graph_response = await self.http_client.get(
            f"/v2/projects/{self.project_id}/graph-data",
            params={"graph_type": "not_supported"},
        )

        self.assertEqual(projects_response.status_code, 200)
        self.assertEqual(projects_response.json()["total"], 1)
        self.assertEqual(project_response.status_code, 200)
        self.assertEqual(project_response.json()["id"], self.project_id)
        self.assertEqual(overview_response.status_code, 200)
        self.assertEqual(overview_response.json()["stats"]["asset_count"], 2)
        self.assertEqual(overview_response.json()["stats"]["vulnerability_count"], 1)
        self.assertEqual(overview_response.json()["stats"]["info_finding_count"], 1)
        self.assertEqual(overview_response.json()["stats"]["task_count"], 1)
        self.assertEqual(len(overview_response.json()["recent_activity"]), 1)
        self.assertEqual(graph_response.status_code, 200)
        self.assertEqual(graph_response.json()["graph_type"], "severity_summary")
        self.assertCountEqual(
            [
                (item["severity"], item["count"])
                for item in graph_response.json()["data"]
            ],
            [("high", 1), ("info", 1)],
        )
        self.assertEqual(invalid_graph_response.status_code, 400)

    async def test_project_create_and_delete_routes_manage_v2_and_legacy_data(self):
        create_response = await self.http_client.post(
            "/v2/projects",
            json={
                "name": "Created Via V2",
                "description": "project mutation coverage",
            },
        )

        self.assertEqual(create_response.status_code, 200)
        created_project = create_response.json()
        created_project_id = created_project["id"]
        now = datetime.now(timezone.utc)

        await self.database["subdomains"].insert_one(
            {
                "_id": "legacy_subdomain_delete_1",
                "project_id": created_project_id,
                "domain": "legacy.example.com",
                "vulnerabilities": [],
                "created_at": now,
                "updated_at": now,
            }
        )
        await self.database["scans"].insert_one(
            {
                "_id": "legacy_scan_delete_1",
                "project_id": created_project_id,
                "scan_id": "scan_delete_1",
                "type": "subfinder",
                "status": "completed",
                "created_at": now,
                "updated_at": now,
            }
        )
        await self.database["v2_assets"].insert_one(
            {
                "_id": "asset_delete_project_1",
                "project_id": created_project_id,
                "owner_id": self.owner_id,
                "hostname": "v2.example.com",
                "primary_url": "https://v2.example.com",
                "status_code": 200,
                "title": "V2 Asset",
                "webserver": "nginx",
                "screenshot_storage_key": f"{created_project_id}/task_delete/screenshot.png",
                "ip_addresses": ["10.0.0.5"],
                "ports": [443],
                "technologies": ["nginx"],
                "tags": ["seed"],
                "source_task_id": "task_delete_1",
                "created_at": now,
                "updated_at": now,
                "first_seen_at": now,
                "last_seen_at": now,
            }
        )
        await self.database["v2_findings"].insert_one(
            {
                "_id": "finding_delete_project_1",
                "project_id": created_project_id,
                "owner_id": self.owner_id,
                "asset_id": "asset_delete_project_1",
                "asset_hostname": "v2.example.com",
                "title": "Delete Me Finding",
                "severity": "medium",
                "severity_rank": 2,
                "triage_status": "new",
                "references": [],
                "evidence_summary": "delete me",
                "dedupe_key": "delete-project-finding",
                "created_at": now,
                "updated_at": now,
                "first_seen_at": now,
                "last_seen_at": now,
            }
        )
        await self.database["v2_artifacts"].insert_one(
            {
                "_id": "artifact_delete_project_1",
                "project_id": created_project_id,
                "owner_id": self.owner_id,
                "asset_id": "asset_delete_project_1",
                "task_id": "task_delete_1",
                "artifact_type": "screenshot",
                "storage_key": f"{created_project_id}/task_delete/screenshot.png",
                "content_type": "image/png",
                "metadata": {"hostname": "v2.example.com"},
                "created_at": now,
            }
        )
        await self.database["v2_tasks"].insert_one(
            {
                "_id": "task_delete_1",
                "project_id": created_project_id,
                "owner_id": self.owner_id,
                "task_type": "enumerate_scope",
                "status": TaskStatus.COMPLETED.value,
                "label": "Delete Project Task",
                "requested_input": {"scope_value": "example.com"},
                "approval_mode": "auto",
                "created_by": self.owner_id,
                "assigned_agent": "test-worker",
                "result_summary": {"assets_upserted": 1},
                "last_error": None,
                "started_at": now,
                "completed_at": now,
                "created_at": now,
                "updated_at": now,
            }
        )
        await self.database["v2_task_events"].insert_one(
            {
                "_id": "task_event_delete_1",
                "task_id": "task_delete_1",
                "project_id": created_project_id,
                "owner_id": self.owner_id,
                "event_type": "task.created",
                "message": "Seed event",
                "payload": {},
                "created_at": now,
            }
        )

        screenshot_path = ARTIFACTS_ROOT / created_project_id / "task_delete" / "screenshot.png"
        screenshot_path.parent.mkdir(parents=True, exist_ok=True)
        screenshot_path.write_bytes(b"fake-image")

        delete_response = await self.http_client.delete(f"/v2/projects/{created_project_id}")

        self.assertEqual(delete_response.status_code, 200)
        self.assertFalse(
            await self.database["projects"].find_one({"_id": self.project_object_id})
            is None
        )
        self.assertIsNone(
            await self.database["projects"].find_one({"_id": ObjectId(created_project_id)})
        )
        self.assertEqual(
            await self.database["subdomains"].count_documents({"project_id": created_project_id}),
            0,
        )
        self.assertEqual(
            await self.database["scans"].count_documents({"project_id": created_project_id}),
            0,
        )
        self.assertEqual(
            await self.database["v2_assets"].count_documents({"project_id": created_project_id}),
            0,
        )
        self.assertEqual(
            await self.database["v2_findings"].count_documents({"project_id": created_project_id}),
            0,
        )
        self.assertEqual(
            await self.database["v2_artifacts"].count_documents({"project_id": created_project_id}),
            0,
        )
        self.assertEqual(
            await self.database["v2_tasks"].count_documents({"project_id": created_project_id}),
            0,
        )
        self.assertEqual(
            await self.database["v2_task_events"].count_documents({"project_id": created_project_id}),
            0,
        )
        self.assertFalse((ARTIFACTS_ROOT / created_project_id).exists())

    async def test_data_routes_enforce_owner_scope(self):
        self.app.dependency_overrides[get_current_user] = lambda: self.other_owner_id

        assets_response = await self.http_client.get(
            f"/v2/projects/{self.project_id}/assets",
            params={"page": 1, "page_size": 10},
        )
        findings_response = await self.http_client.get(
            f"/v2/projects/{self.project_id}/findings",
            params={"page": 1, "page_size": 10},
        )
        overview_response = await self.http_client.get(
            f"/v2/projects/{self.project_id}/overview"
        )
        export_response = await self.http_client.get(
            f"/v2/projects/{self.project_id}/exports/results.csv"
        )

        self.assertEqual(assets_response.status_code, 404)
        self.assertEqual(findings_response.status_code, 404)
        self.assertEqual(overview_response.status_code, 404)
        self.assertEqual(export_response.status_code, 404)
