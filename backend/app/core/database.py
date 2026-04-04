import os

from fastapi import FastAPI, Request
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase


MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongo:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "typesdb")


def configure_database(app: FastAPI) -> None:
    @app.on_event("startup")
    async def startup() -> None:
        if getattr(app.state, "v2_database", None) is None:
            client = AsyncIOMotorClient(MONGO_URI)
            app.state.v2_mongo_client = client
            app.state.v2_database = client[DATABASE_NAME]

    @app.on_event("shutdown")
    async def shutdown() -> None:
        client = getattr(app.state, "v2_mongo_client", None)
        if client is not None:
            client.close()
            app.state.v2_mongo_client = None
            app.state.v2_database = None


def get_database(request: Request) -> AsyncIOMotorDatabase:
    database = getattr(request.app.state, "v2_database", None)
    if database is None:
        client = AsyncIOMotorClient(MONGO_URI)
        request.app.state.v2_mongo_client = client
        request.app.state.v2_database = client[DATABASE_NAME]
        database = request.app.state.v2_database

    return database
