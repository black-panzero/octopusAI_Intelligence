# app/core/database.py
"""
Database configuration and session management
"""
import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from sqlalchemy import MetaData
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

logger = structlog.get_logger(__name__)

# Database configuration
settings = get_settings()

# Create async engine
engine = create_async_engine(
    settings.database_url,
    echo=settings.database_echo,
    future=True,
    pool_pre_ping=True,
)

# Create session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=True,
    autocommit=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    
    metadata = MetaData(
        naming_convention={
            "ix": "ix_%(column_0_label)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "ck": "ck_%(table_name)s_%(constraint_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s"
        }
    )


async def create_tables() -> None:
    """Create all database tables."""
    logger.info("Creating database tables...")
    
    try:
        async with engine.begin() as conn:
            # Import models to register them with SQLAlchemy's metadata
            from app.db.models.deals import Deal                  # noqa: F401
            from app.db.models.user import User                   # noqa: F401
            from app.db.models.merchant import Merchant           # noqa: F401
            from app.db.models.product import Product             # noqa: F401
            from app.db.models.price_snapshot import PriceSnapshot  # noqa: F401
            from app.db.models.cart import Cart, CartItem         # noqa: F401
            from app.db.models.price_rule import PriceRule        # noqa: F401
            from app.db.models.conversation import Conversation, ChatTurn  # noqa: F401

            # Create all tables
            await conn.run_sync(Base.metadata.create_all)

        # 1. Apply additive schema migrations (SQLite-friendly) so new
        #    columns on existing tables land without wiping the DB.
        # 2. Seed the Kenyan catalog if anything is missing.
        # 3. Backfill any legacy deals that don't yet link to a product.
        from app.db.migrations import evolve_schema
        from app.db.seed import seed_if_empty
        from app.services.deal_sync_service import backfill_deal_links
        async with AsyncSessionLocal() as session:
            await evolve_schema(session)
            await seed_if_empty(session)
            await backfill_deal_links(session)
        
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error("Failed to create database tables", error=str(e))
        raise


async def drop_tables() -> None:
    """Drop all database tables - useful for testing."""
    logger.warning("Dropping all database tables...")
    
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        
        logger.info("Database tables dropped successfully")
    except Exception as e:
        logger.error("Failed to drop database tables", error=str(e))
        raise


@asynccontextmanager
async def get_database() -> AsyncGenerator[AsyncSession, None]:
    """Get database session context manager."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency to get database session."""
    async with get_database() as session:
        yield session


async def test_database_connection() -> bool:
    """Test database connectivity."""
    try:
        async with get_database() as db:
            await db.execute("SELECT 1")
        logger.info("Database connection test successful")
        return True
    except Exception as e:
        logger.error("Database connection test failed", error=str(e))
        return False