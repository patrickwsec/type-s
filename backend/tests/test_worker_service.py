import asyncio
import shutil
from datetime import datetime, timezone
from uuid import uuid4

from app.schemas.common import ApprovalMode, TaskStatus, TaskType
from app.schemas.tasks import TaskCreateRequest
from app.services.artifacts import ARTIFACTS_ROOT
from app.services.tasks import TaskService
from app.services.worker import PNG_SIGNATURE, TaskWorkerService
from tests.base import AsyncMongoTestCase


class CooperativeCancellationWorker(TaskWorkerService):
    def __init__(self, database, *, started_event: asyncio.Event):
        super().__init__(database, worker_name="test-worker")
        self.started_event = started_event

    async def _run_subfinder(self, domain: str, *, task_id: str) -> list[dict]:
        self.started_event.set()
        while True:
            await asyncio.sleep(0.05)
            await self._raise_if_cancellation_requested(
                task_id,
                "Task cancelled during test enumeration.",
            )


class CooperativeFindingsCancellationWorker(TaskWorkerService):
    def __init__(self, database, *, started_event: asyncio.Event):
        super().__init__(database, worker_name="test-worker")
        self.started_event = started_event

    async def _run_nuclei(
        self,
        target_urls: list[str],
        requested_input: dict,
        *,
        task_id: str,
    ) -> list[dict]:
        self.started_event.set()
        while True:
            await asyncio.sleep(0.05)
            await self._raise_if_cancellation_requested(
                task_id,
                "Task cancelled during test findings scan.",
            )


class TaskWorkerServiceTests(AsyncMongoTestCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        self.task_service = TaskService(self.database)

    async def asyncTearDown(self):
        shutil.rmtree(ARTIFACTS_ROOT / self.project_id, ignore_errors=True)
        await super().asyncTearDown()

    async def test_extract_screenshot_storage_key_normalizes_httpx_relative_paths(self):
        task_id = "task_capture"
        screenshot_path = (
            ARTIFACTS_ROOT
            / self.project_id
            / task_id
            / "screenshot"
            / "www.example.com_443"
            / "hash.png"
        )
        screenshot_path.parent.mkdir(parents=True, exist_ok=True)
        screenshot_path.write_bytes(PNG_SIGNATURE + b"fake-png")

        storage_key = TaskWorkerService._extract_screenshot_storage_key(
            {"screenshot_path_rel": "www.example.com_443/hash.png"},
            project_id=self.project_id,
            task_id=task_id,
        )

        self.assertEqual(
            storage_key,
            f"{self.project_id}/{task_id}/screenshot/www.example.com_443/hash.png",
        )

    async def test_extract_screenshot_storage_key_ignores_empty_png_files(self):
        task_id = "task_empty_capture"
        screenshot_path = (
            ARTIFACTS_ROOT
            / self.project_id
            / task_id
            / "screenshot"
            / "www.example.com_443"
            / "empty.png"
        )
        screenshot_path.parent.mkdir(parents=True, exist_ok=True)
        screenshot_path.write_bytes(b"")

        storage_key = TaskWorkerService._extract_screenshot_storage_key(
            {"screenshot_path": str(screenshot_path)},
            project_id=self.project_id,
            task_id=task_id,
        )

        self.assertIsNone(storage_key)

    async def test_running_task_cancellation_stops_worker_and_marks_task_cancelled(self):
        created_task = await self.task_service.create_task(
            project_id=self.project_id,
            user_id=self.owner_id,
            request=TaskCreateRequest(
                task_type=TaskType.ENUMERATE_SCOPE,
                requested_input={"scope_value": "example.com"},
                approval_mode=ApprovalMode.AUTO,
            ),
        )

        started_event = asyncio.Event()
        worker = CooperativeCancellationWorker(
            self.database,
            started_event=started_event,
        )

        worker_run = asyncio.create_task(worker.run_task(created_task.task.id))
        await asyncio.wait_for(started_event.wait(), timeout=2)

        cancelling_task = await self.task_service.cancel_task(
            created_task.task.id,
            self.owner_id,
        )
        await asyncio.wait_for(worker_run, timeout=2)

        final_task = await self.task_service.get_task(
            created_task.task.id,
            self.owner_id,
        )
        events = await self.task_service.list_task_events(
            created_task.task.id,
            self.owner_id,
        )

        self.assertEqual(cancelling_task.status, TaskStatus.CANCELLING)
        self.assertEqual(final_task.status, TaskStatus.CANCELLED)
        self.assertEqual(final_task.last_error, "Task cancelled during test enumeration.")
        self.assertEqual(
            [event.event_type for event in events.items[-2:]],
            ["task.cancellation_requested", "task.cancelled"],
        )
        self.assertEqual(
            await self.database["v2_assets"].count_documents(
                {"task_id": created_task.task.id}
            ),
            0,
        )

    async def test_findings_scan_cancellation_stops_worker_before_ingest(self):
        now = datetime.now(timezone.utc)
        await self.database["v2_assets"].insert_one(
            {
                "_id": f"asset_{uuid4()}",
                "project_id": self.project_id,
                "owner_id": self.owner_id,
                "hostname": "app.example.com",
                "primary_url": "https://app.example.com",
                "status_code": 200,
                "title": "Example App",
                "webserver": "nginx",
                "screenshot_storage_key": None,
                "ip_addresses": ["203.0.113.10"],
                "ports": [443],
                "technologies": ["nginx"],
                "tags": [],
                "source_task_id": "task_seed",
                "first_seen_at": now,
                "last_seen_at": now,
            }
        )

        created_task = await self.task_service.create_task(
            project_id=self.project_id,
            user_id=self.owner_id,
            request=TaskCreateRequest(
                task_type=TaskType.RUN_FINDINGS_SCAN,
                requested_input={
                    "hostnames": ["app.example.com"],
                    "templates": ["/app/nuclei-templates/http/exposures/apis/swagger-api.yaml"],
                },
                approval_mode=ApprovalMode.AUTO,
            ),
        )

        started_event = asyncio.Event()
        worker = CooperativeFindingsCancellationWorker(
            self.database,
            started_event=started_event,
        )

        worker_run = asyncio.create_task(worker.run_task(created_task.task.id))
        await asyncio.wait_for(started_event.wait(), timeout=2)

        cancelling_task = await self.task_service.cancel_task(
            created_task.task.id,
            self.owner_id,
        )
        await asyncio.wait_for(worker_run, timeout=2)

        final_task = await self.task_service.get_task(
            created_task.task.id,
            self.owner_id,
        )
        events = await self.task_service.list_task_events(
            created_task.task.id,
            self.owner_id,
        )

        self.assertEqual(cancelling_task.status, TaskStatus.CANCELLING)
        self.assertEqual(final_task.status, TaskStatus.CANCELLED)
        self.assertEqual(final_task.last_error, "Task cancelled during test findings scan.")
        self.assertEqual(
            [event.event_type for event in events.items[-2:]],
            ["task.cancellation_requested", "task.cancelled"],
        )
        self.assertEqual(
            await self.database["v2_findings"].count_documents(
                {"project_id": self.project_id}
            ),
            0,
        )
