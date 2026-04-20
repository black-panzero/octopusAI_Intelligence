"""
Auth service: register, authenticate, seed admin.

Role assignment rules:
  - Registration allows 'user' or 'merchant' only
  - 'admin' is seeded programmatically (never via public signup)
  - is_superuser is only set on admin-seeded accounts
"""
from typing import Optional

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.db.models.user import User
from app.schemas.auth import UserRegister

logger = structlog.get_logger(__name__)


class AuthService:
    """Business logic for user authentication."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_email(self, email: str) -> Optional[User]:
        stmt = select(User).where(User.email == email.lower())
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def get_by_id(self, user_id: int) -> Optional[User]:
        stmt = select(User).where(User.id == user_id)
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def register(self, data: UserRegister) -> User:
        """Create a new user or merchant. Admin cannot be created via register."""
        role = data.role if data.role in ("user", "merchant") else "user"

        user = User(
            email=data.email.lower(),
            hashed_password=hash_password(data.password),
            full_name=data.full_name,
            role=role,
            is_active=True,
            is_superuser=False,
            business_name=data.business_name if role == "merchant" else None,
            business_description=data.business_description if role == "merchant" else None,
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        logger.info(
            "User registered",
            user_id=user.id, email=user.email, role=user.role,
        )
        return user

    async def authenticate(self, email: str, password: str) -> Optional[User]:
        """Return the user if credentials are valid, else None."""
        user = await self.get_by_email(email)
        if user is None or not user.is_active:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user


async def seed_admin(db: AsyncSession) -> None:
    """Create the platform admin if not already present."""
    email = "darelladero@gmail.com"
    existing = (await db.execute(
        select(User).where(User.email == email)
    )).scalar_one_or_none()

    if existing is not None:
        # Ensure admin role is set even if account was created before roles
        if existing.role != "admin" or not existing.is_superuser:
            existing.role = "admin"
            existing.is_superuser = True
            await db.commit()
            logger.info("admin.role_upgraded", user_id=existing.id)
        return

    admin = User(
        email=email,
        hashed_password=hash_password("123@iamking"),
        full_name="Platform Admin",
        role="admin",
        is_active=True,
        is_superuser=True,
    )
    db.add(admin)
    await db.commit()
    logger.info("admin.seeded", email=email)
