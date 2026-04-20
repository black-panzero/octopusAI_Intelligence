"""
Lightweight async task scheduler.

No external dependency — just managed `asyncio.create_task` loops with
per-job error isolation, first-delay support, and clean cancellation
from the FastAPI lifespan. Replace with APScheduler or Celery once we
need cron expressions.
"""
import asyncio
from dataclasses import dataclass, field
from typing import Awaitable, Callable, Optional

import structlog

logger = structlog.get_logger(__name__)

Job = Callable[[], Awaitable[None]]


@dataclass
class ScheduledJob:
    name: str
    interval_seconds: float
    coro: Job
    first_run_delay: float = 5.0
    task: Optional[asyncio.Task] = None


class BackgroundScheduler:
    def __init__(self) -> None:
        self._jobs: list[ScheduledJob] = []

    def add(
        self,
        name: str, interval_seconds: float, coro: Job,
        *, first_run_delay: float = 5.0,
    ) -> None:
        self._jobs.append(ScheduledJob(name=name, interval_seconds=interval_seconds,
                                       coro=coro, first_run_delay=first_run_delay))

    def start(self) -> None:
        loop = asyncio.get_running_loop()
        for job in self._jobs:
            job.task = loop.create_task(self._run(job), name=f"sched:{job.name}")
        logger.info("scheduler.started", jobs=[j.name for j in self._jobs])

    async def shutdown(self) -> None:
        for job in self._jobs:
            if job.task and not job.task.done():
                job.task.cancel()
        for job in self._jobs:
            if job.task:
                try:
                    await job.task
                except (asyncio.CancelledError, Exception):
                    pass
        logger.info("scheduler.stopped")

    async def _run(self, job: ScheduledJob) -> None:
        try:
            await asyncio.sleep(max(0.0, job.first_run_delay))
        except asyncio.CancelledError:
            return
        while True:
            try:
                await job.coro()
            except asyncio.CancelledError:
                return
            except Exception as e:
                logger.warning("scheduler.job_failed", job=job.name, error=str(e))
            try:
                await asyncio.sleep(job.interval_seconds)
            except asyncio.CancelledError:
                return
