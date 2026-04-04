from fastapi import HTTPException

from app.schemas.common import ApprovalMode, TaskStatus, TaskType
from app.schemas.tasks import TaskCreateRequest
from app.services.tasks import TaskService
from tests.base import AsyncMongoTestCase


class TaskServiceTests(AsyncMongoTestCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        self.service = TaskService(self.database)

    async def test_create_task_persists_normalized_task_and_created_event(self):
        response = await self.service.create_task(
            project_id=self.project_id,
            user_id=self.owner_id,
            request=TaskCreateRequest(
                task_type=TaskType.ENUMERATE_SCOPE,
                requested_input={
                    "scope_value": " Example.COM ",
                    "include_http_enrichment": "false",
                },
                approval_mode=ApprovalMode.AUTO,
            ),
        )

        self.assertEqual(response.task.label, "Enumerate example.com")
        self.assertEqual(response.task.status, TaskStatus.QUEUED)
        self.assertEqual(
            response.task.requested_input,
            {
                "scope_type": "domain",
                "scope_value": "example.com",
                "include_http_enrichment": False,
                "include_screenshots": False,
            },
        )

        events = await self.service.list_task_events(response.task.id, self.owner_id)
        self.assertEqual(len(events.items), 1)
        self.assertEqual(events.items[0].event_type, "task.created")

    async def test_list_tasks_filters_by_type(self):
        enumerate_task = await self.service.create_task(
            project_id=self.project_id,
            user_id=self.owner_id,
            request=TaskCreateRequest(
                task_type=TaskType.ENUMERATE_SCOPE,
                requested_input={"scope_value": "example.com"},
                approval_mode=ApprovalMode.AUTO,
            ),
        )
        await self.service.create_task(
            project_id=self.project_id,
            user_id=self.owner_id,
            request=TaskCreateRequest(
                task_type=TaskType.RUN_FINDINGS_SCAN,
                requested_input={"hostnames": ["petstore.swagger.io"]},
                approval_mode=ApprovalMode.AUTO,
            ),
        )

        tasks = await self.service.list_tasks(
            project_id=self.project_id,
            user_id=self.owner_id,
            page=1,
            page_size=10,
            task_type=TaskType.ENUMERATE_SCOPE,
        )

        self.assertEqual(tasks.pagination.total, 1)
        self.assertEqual(tasks.items[0].id, enumerate_task.task.id)
        self.assertEqual(tasks.items[0].task_type, TaskType.ENUMERATE_SCOPE)

    async def test_cancel_task_updates_status_and_creates_event(self):
        response = await self.service.create_task(
            project_id=self.project_id,
            user_id=self.owner_id,
            request=TaskCreateRequest(
                task_type=TaskType.ENUMERATE_SCOPE,
                requested_input={"scope_value": "example.com"},
                approval_mode=ApprovalMode.AUTO,
            ),
        )

        cancelled_task = await self.service.cancel_task(response.task.id, self.owner_id)
        events = await self.service.list_task_events(response.task.id, self.owner_id)

        self.assertEqual(cancelled_task.status, TaskStatus.CANCELLED)
        self.assertEqual(events.items[-1].event_type, "task.cancelled")

    async def test_cancel_running_task_marks_task_cancelling(self):
        response = await self.service.create_task(
            project_id=self.project_id,
            user_id=self.owner_id,
            request=TaskCreateRequest(
                task_type=TaskType.ENUMERATE_SCOPE,
                requested_input={"scope_value": "example.com"},
                approval_mode=ApprovalMode.AUTO,
            ),
        )
        await self.database["v2_tasks"].update_one(
            {"_id": response.task.id},
            {"$set": {"status": TaskStatus.RUNNING.value}},
        )

        cancelling_task = await self.service.cancel_task(response.task.id, self.owner_id)
        events = await self.service.list_task_events(response.task.id, self.owner_id)

        self.assertEqual(cancelling_task.status, TaskStatus.CANCELLING)
        self.assertEqual(events.items[-1].event_type, "task.cancellation_requested")

    async def test_retry_task_clones_previous_task(self):
        response = await self.service.create_task(
            project_id=self.project_id,
            user_id=self.owner_id,
            request=TaskCreateRequest(
                task_type=TaskType.RUN_FINDINGS_SCAN,
                requested_input={"hostnames": ["petstore.swagger.io"]},
                approval_mode=ApprovalMode.AUTO,
            ),
        )
        await self.database["v2_tasks"].update_one(
            {"_id": response.task.id},
            {"$set": {"status": TaskStatus.FAILED.value}},
        )

        retried = await self.service.retry_task(response.task.id, self.owner_id)

        self.assertNotEqual(retried.task.id, response.task.id)
        self.assertEqual(retried.task.status, TaskStatus.QUEUED)
        self.assertEqual(retried.task.task_type, TaskType.RUN_FINDINGS_SCAN)
        self.assertEqual(retried.task.requested_input["hostnames"], ["petstore.swagger.io"])

    async def test_get_task_enforces_owner_scope(self):
        response = await self.service.create_task(
            project_id=self.project_id,
            user_id=self.owner_id,
            request=TaskCreateRequest(
                task_type=TaskType.ENUMERATE_SCOPE,
                requested_input={"scope_value": "example.com"},
                approval_mode=ApprovalMode.AUTO,
            ),
        )

        with self.assertRaises(HTTPException) as ctx:
            await self.service.get_task(response.task.id, self.other_owner_id)

        self.assertEqual(ctx.exception.status_code, 404)

    async def test_create_task_requires_project_access(self):
        with self.assertRaises(HTTPException) as ctx:
            await self.service.create_task(
                project_id=self.project_id,
                user_id=self.other_owner_id,
                request=TaskCreateRequest(
                    task_type=TaskType.ENUMERATE_SCOPE,
                    requested_input={"scope_value": "example.com"},
                    approval_mode=ApprovalMode.AUTO,
                ),
            )

        self.assertEqual(ctx.exception.status_code, 404)
