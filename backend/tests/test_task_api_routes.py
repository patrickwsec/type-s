from app.api.dependencies import get_task_worker_service
from app.core.security import get_current_user
from app.schemas.common import ApprovalMode, TaskStatus, TaskType
from app.schemas.tasks import TaskCreateRequest
from app.services.tasks import TaskService
from tests.api_base import V2ApiTestCase


class FakeTaskWorkerService:
    def __init__(self):
        self.called_task_ids = []

    async def run_task(self, task_id: str) -> None:
        self.called_task_ids.append(task_id)


class TaskApiRouteTests(V2ApiTestCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        self.task_service = TaskService(self.database)

    async def test_task_routes_create_list_detail_cancel_retry_and_events(self):
        create_response = await self.http_client.post(
            f"/v2/projects/{self.project_id}/tasks",
            json={
                "task_type": "enumerate_scope",
                "approval_mode": "auto",
                "requested_input": {"scope_value": "example.com"},
            },
        )

        self.assertEqual(create_response.status_code, 200)
        created_task = create_response.json()["task"]
        task_id = created_task["id"]
        self.assertEqual(created_task["status"], TaskStatus.QUEUED.value)
        self.assertEqual(created_task["label"], "Enumerate example.com")

        list_response = await self.http_client.get(
            f"/v2/projects/{self.project_id}/tasks",
            params={"page": 1, "page_size": 10},
        )
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.json()["pagination"]["total"], 1)
        self.assertEqual(list_response.json()["items"][0]["id"], task_id)

        detail_response = await self.http_client.get(f"/v2/tasks/{task_id}")
        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(detail_response.json()["id"], task_id)

        cancel_response = await self.http_client.post(f"/v2/tasks/{task_id}/cancel")
        self.assertEqual(cancel_response.status_code, 200)
        self.assertEqual(cancel_response.json()["status"], TaskStatus.CANCELLED.value)

        events_response = await self.http_client.get(f"/v2/tasks/{task_id}/events")
        self.assertEqual(events_response.status_code, 200)
        self.assertEqual(
            [item["event_type"] for item in events_response.json()["items"]],
            ["task.created", "task.cancelled"],
        )

        retry_response = await self.http_client.post(f"/v2/tasks/{task_id}/retry")
        self.assertEqual(retry_response.status_code, 200)
        retried_task = retry_response.json()["task"]
        self.assertNotEqual(retried_task["id"], task_id)
        self.assertEqual(retried_task["status"], TaskStatus.QUEUED.value)
        self.assertEqual(retried_task["task_type"], TaskType.ENUMERATE_SCOPE.value)

    async def test_cancel_route_marks_running_task_cancelling(self):
        created_task = await self.task_service.create_task(
            project_id=self.project_id,
            user_id=self.owner_id,
            request=TaskCreateRequest(
                task_type=TaskType.ENUMERATE_SCOPE,
                requested_input={"scope_value": "example.com"},
                approval_mode=ApprovalMode.AUTO,
            ),
        )
        await self.database["v2_tasks"].update_one(
            {"_id": created_task.task.id},
            {"$set": {"status": TaskStatus.RUNNING.value}},
        )

        cancel_response = await self.http_client.post(
            f"/v2/tasks/{created_task.task.id}/cancel"
        )

        self.assertEqual(cancel_response.status_code, 200)
        self.assertEqual(
            cancel_response.json()["status"],
            TaskStatus.CANCELLING.value,
        )

    async def test_run_route_accepts_queued_task_and_calls_worker(self):
        fake_worker = FakeTaskWorkerService()
        self.app.dependency_overrides[get_task_worker_service] = lambda: fake_worker

        created_task = await self.task_service.create_task(
            project_id=self.project_id,
            user_id=self.owner_id,
            request=TaskCreateRequest(
                task_type=TaskType.ENUMERATE_SCOPE,
                requested_input={"scope_value": "example.com"},
                approval_mode=ApprovalMode.AUTO,
            ),
        )

        run_response = await self.http_client.post(
            f"/v2/tasks/{created_task.task.id}/run"
        )

        self.assertEqual(run_response.status_code, 200)
        self.assertTrue(run_response.json()["accepted"])
        self.assertEqual(fake_worker.called_task_ids, [created_task.task.id])

    async def test_task_routes_enforce_owner_scope(self):
        created_task = await self.task_service.create_task(
            project_id=self.project_id,
            user_id=self.owner_id,
            request=TaskCreateRequest(
                task_type=TaskType.ENUMERATE_SCOPE,
                requested_input={"scope_value": "example.com"},
                approval_mode=ApprovalMode.AUTO,
            ),
        )
        self.app.dependency_overrides[get_current_user] = lambda: self.other_owner_id

        detail_response = await self.http_client.get(f"/v2/tasks/{created_task.task.id}")
        list_response = await self.http_client.get(
            f"/v2/projects/{self.project_id}/tasks",
            params={"page": 1, "page_size": 10},
        )

        self.assertEqual(detail_response.status_code, 404)
        self.assertEqual(list_response.status_code, 404)

    async def test_task_event_stream_emits_events_and_terminal_snapshot(self):
        created_task = await self.task_service.create_task(
            project_id=self.project_id,
            user_id=self.owner_id,
            request=TaskCreateRequest(
                task_type=TaskType.ENUMERATE_SCOPE,
                requested_input={"scope_value": "example.com"},
                approval_mode=ApprovalMode.AUTO,
            ),
        )
        await self.task_service.cancel_task(created_task.task.id, self.owner_id)

        async with self.http_client.stream(
            "GET",
            f"/v2/tasks/{created_task.task.id}/events/stream",
        ) as response:
            self.assertEqual(response.status_code, 200)
            chunks = []
            async for text in response.aiter_text():
                chunks.append(text)

        stream_content = "".join(chunks)
        self.assertIn("event: task_event", stream_content)
        self.assertIn("task.created", stream_content)
        self.assertIn("task.cancelled", stream_content)
        self.assertIn("event: task_terminal", stream_content)
