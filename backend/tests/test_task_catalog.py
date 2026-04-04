import unittest

from fastapi import HTTPException

from app.schemas.common import TaskType
from app.services.task_catalog import list_task_capabilities, normalize_task_request


class TaskCatalogTests(unittest.TestCase):
    def test_capabilities_expose_supported_task_types(self):
        capabilities = list_task_capabilities()

        self.assertEqual(
            [capability.task_type.value for capability in capabilities],
            [
                TaskType.ENUMERATE_SCOPE.value,
                TaskType.PORT_SCAN.value,
                TaskType.SERVICE_DISCOVERY.value,
                TaskType.RUN_FINDINGS_SCAN.value,
            ],
        )

    def test_enumerate_scope_request_is_normalized(self):
        label, requested_input = normalize_task_request(
            task_type=TaskType.ENUMERATE_SCOPE,
            label="",
            requested_input={
                "scope_value": " Example.COM ",
                "include_http_enrichment": "false",
                "include_screenshots": "true",
            },
        )

        self.assertEqual(label, "Enumerate example.com")
        self.assertEqual(
            requested_input,
            {
                "scope_type": "domain",
                "scope_value": "example.com",
                "include_http_enrichment": False,
                "include_screenshots": True,
            },
        )

    def test_findings_scan_request_is_normalized(self):
        label, requested_input = normalize_task_request(
            task_type=TaskType.RUN_FINDINGS_SCAN,
            label=None,
            requested_input={
                "hostnames": " Petstore.Swagger.IO \n api.example.com ",
                "ports": "443, 8443",
                "templates": "template-a.yaml, template-b.yaml",
                "severity": "INFO, medium, invalid",
                "exclude_severity": ["low", "not-a-severity"],
                "use_primary_url": "true",
                "max_assets": "5",
                "rate_limit": "200",
                "timeout": "15",
                "retries": "3",
                "command_timeout": "120",
            },
        )

        self.assertEqual(label, "Findings scan for 2 hosts")
        self.assertEqual(requested_input["hostnames"], ["petstore.swagger.io", "api.example.com"])
        self.assertEqual(requested_input["ports"], [443, 8443])
        self.assertEqual(requested_input["templates"], ["template-a.yaml", "template-b.yaml"])
        self.assertEqual(requested_input["severity"], ["info", "medium"])
        self.assertEqual(requested_input["exclude_severity"], ["low"])
        self.assertTrue(requested_input["use_primary_url"])
        self.assertEqual(requested_input["max_assets"], 5)
        self.assertEqual(requested_input["rate_limit"], 200)
        self.assertEqual(requested_input["timeout"], 15)
        self.assertEqual(requested_input["retries"], 3)
        self.assertEqual(requested_input["command_timeout"], 120)

    def test_findings_scan_rejects_tags_and_templates_together(self):
        with self.assertRaises(HTTPException) as ctx:
            normalize_task_request(
                task_type=TaskType.RUN_FINDINGS_SCAN,
                label=None,
                requested_input={
                    "tags": ["exposure"],
                    "templates": ["template-a.yaml"],
                },
            )

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("either requested_input.templates or requested_input.tags", ctx.exception.detail)

    def test_findings_scan_rejects_run_all_templates_with_filters(self):
        with self.assertRaises(HTTPException) as ctx:
            normalize_task_request(
                task_type=TaskType.RUN_FINDINGS_SCAN,
                label=None,
                requested_input={
                    "run_all_templates": True,
                    "tags": ["cve"],
                },
            )

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("run_all_templates", ctx.exception.detail)


if __name__ == "__main__":
    unittest.main()
