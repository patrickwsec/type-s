import shutil

import httpx

from app.core.database import get_database
from app.core.security import get_current_user
from app.main import app as v2_app
from app.services.artifacts import ARTIFACTS_ROOT
from tests.base import AsyncMongoTestCase


class V2ApiTestCase(AsyncMongoTestCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        self.app = v2_app
        self.app.dependency_overrides[get_current_user] = lambda: self.owner_id
        self.app.dependency_overrides[get_database] = lambda: self.database
        self.http_client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self.app),
            base_url="http://testserver",
        )

    async def asyncTearDown(self):
        await self.http_client.aclose()
        self.app.dependency_overrides.clear()
        project_artifact_dir = ARTIFACTS_ROOT / self.project_id
        if project_artifact_dir.exists():
            shutil.rmtree(project_artifact_dir, ignore_errors=True)
        await super().asyncTearDown()
