"""
User model with role-based access.

Three actors on the platform:
  - user     : consumers who search, compare, cart, track prices
  - merchant : businesses who list products, view analytics
  - admin    : platform operators with full control

Role is set at registration (user/merchant) or seeded (admin).
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base

VALID_ROLES = {"user", "merchant", "admin"}


class User(Base):
    """Application user with role-based access."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)

    email: Mapped[str] = mapped_column(
        String(255), nullable=False, unique=True, index=True,
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    full_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True, default=None)

    # Role: user | merchant | admin
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="user", index=True)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_superuser: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Merchant-specific fields (null for non-merchants)
    business_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True, default=None)
    business_description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, default=None)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now(),
    )

    @property
    def is_admin(self) -> bool:
        return self.role == "admin" or self.is_superuser

    @property
    def is_merchant(self) -> bool:
        return self.role == "merchant"

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email='{self.email}', role='{self.role}')>"
