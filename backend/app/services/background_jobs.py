"""
Concrete background jobs run by the scheduler.

All jobs are self-contained — each opens its own AsyncSession so they
can run alongside request-scoped work without contention.
"""
from __future__ import annotations

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import AsyncSessionLocal
from app.db.models.user import User
from app.services.image_resolver import resolve_missing_images
from app.services.rules_service import RulesService

logger = structlog.get_logger(__name__)


async def job_resolve_images(batch_size: int = 20) -> None:
    """Fill missing Product.image_url in background batches."""
    async with AsyncSessionLocal() as db:
        try:
            n = await resolve_missing_images(db, batch_size=batch_size)
            if n:
                logger.info("job.images_resolved", count=n)
        except Exception as e:
            logger.warning("job.images_failed", error=str(e))


async def job_evaluate_all_rules() -> None:
    """Evaluate every active user's rules. Triggered rules get their
    `last_triggered_at` set; add_to_cart rules auto-execute."""
    async with AsyncSessionLocal() as db:
        try:
            users = (await db.execute(select(User).where(User.is_active.is_(True)))).scalars().all()
            total_triggered = 0
            for user in users:
                try:
                    triggered = await RulesService(db).evaluate_all(user.id)
                    total_triggered += len(triggered)
                except Exception as e:
                    logger.warning("job.rules_eval_user_failed", user_id=user.id, error=str(e))
            if total_triggered:
                logger.info("job.rules_triggered", total=total_triggered)
        except Exception as e:
            logger.warning("job.rules_failed", error=str(e))
