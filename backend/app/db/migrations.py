"""
Lightweight schema-evolution helpers for SQLite dev databases.

SQLAlchemy's `create_all` creates missing tables but never adds columns to
existing ones. When we extend a model we rely on these helpers on startup
so Codespace users don't have to delete `smartbuy.db` between pulls.

Production databases should use Alembic. These helpers are deliberately
SQLite-specific and only perform additive migrations.
"""
from typing import Iterable

import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger(__name__)


async def _existing_columns(db: AsyncSession, table: str) -> set[str]:
    rows = (await db.execute(text(f"PRAGMA table_info({table})"))).all()
    return {row[1] for row in rows}


async def ensure_columns(db: AsyncSession, table: str, columns: dict[str, str]) -> list[str]:
    """
    Add every missing column to `table`. `columns` maps name → SQL DDL snippet
    (e.g. `"VARCHAR(64)"`, `"INTEGER REFERENCES products(id)"`).
    """
    existing = await _existing_columns(db, table)
    added: list[str] = []
    for name, ddl in columns.items():
        if name in existing:
            continue
        await db.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
        added.append(name)
    if added:
        await db.commit()
        logger.info("Schema evolved", table=table, added=added)
    return added


async def evolve_schema(db: AsyncSession) -> None:
    """Apply every known additive migration for this app."""
    await ensure_columns(db, "products", {
        "size": "VARCHAR(64)",
        "rating": "FLOAT",
        "review_count": "INTEGER",
        "image_url": "VARCHAR(500)",
        "specs": "TEXT",
    })
    await ensure_columns(db, "deals", {
        "product_id": "INTEGER REFERENCES products(id)",
        "merchant_id": "INTEGER REFERENCES merchants(id)",
    })
