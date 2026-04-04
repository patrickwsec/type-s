import os
import unittest
from datetime import datetime, timezone
from uuid import uuid4

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient


class AsyncMongoTestCase(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        mongo_uri = os.getenv("MONGO_URI", "mongodb://mongo:27017")
        self.client = AsyncIOMotorClient(mongo_uri)
        self.database_name = f"types_test_{uuid4().hex}"
        self.database = self.client[self.database_name]
        self.owner_id = "user_test_owner"
        self.other_owner_id = "user_test_other_owner"
        self.project_object_id = ObjectId()
        self.project_id = str(self.project_object_id)

        await self.database["projects"].insert_one(
            {
                "_id": self.project_object_id,
                "name": "Test Project",
                "description": "integration test project",
                "user_id": self.owner_id,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
        )

    async def asyncTearDown(self):
        await self.client.drop_database(self.database_name)
        self.client.close()
