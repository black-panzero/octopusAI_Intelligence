"""
Auth service: register, authenticate, and resolve the current user.
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
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: int) -> Optional[User]:
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def register(self, data: UserRegister) -> User:
        """Create a new user. Caller must ensure email is unique."""
        user = User(
            email=data.email.lower(),
            hashed_password=hash_password(data.password),
            full_name=data.full_name,
            is_active=True,
            is_superuser=False,
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        logger.info("User registered", user_id=user.id, email=user.email)
        return user

    async def authenticate(self, email: str, password: str) -> Optional[User]:
        """Return the user if credentials are valid, else None."""
        user = await self.get_by_email(email)
        if user is None or not user.is_active:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user
