import asyncio
import logging
import os
import signal
import socket
from contextlib import suppress

from motor.motor_asyncio import AsyncIOMotorClient

from app.core.database import DATABASE_NAME, MONGO_URI
from app.services.worker import TaskWorkerService


logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def _build_worker_name() -> str:
    return os.getenv("TASK_WORKER_NAME", f"agent-worker@{socket.gethostname()}")


async def worker_loop() -> None:
    client = AsyncIOMotorClient(MONGO_URI)
    database = client[DATABASE_NAME]
    poll_interval = float(os.getenv("V2_TASK_WORKER_POLL_INTERVAL", "3"))
    worker_name = _build_worker_name()
    service = TaskWorkerService(database, worker_name=worker_name)
    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()

    for sig in (signal.SIGINT, signal.SIGTERM):
        with suppress(NotImplementedError):
            loop.add_signal_handler(sig, stop_event.set)

    logger.info(
        "Starting task worker '%s' against %s/%s with poll interval %.1fs",
        worker_name,
        MONGO_URI,
        DATABASE_NAME,
        poll_interval,
    )

    await service.recover_interrupted_tasks()

    try:
        while not stop_event.is_set():
            claimed = await service.run_next_task()
            if claimed:
                continue

            try:
                await asyncio.wait_for(stop_event.wait(), timeout=poll_interval)
            except asyncio.TimeoutError:
                continue
    finally:
        logger.info("Stopping task worker '%s'", worker_name)
        client.close()


def main() -> None:
    asyncio.run(worker_loop())


if __name__ == "__main__":
    main()
