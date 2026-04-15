"""Canonical product entity. One row per normalized product name."""
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)

    # Lowercased, whitespace-collapsed form used to dedupe across merchants.
    canonical_name: Mapped[str] = mapped_column(
        String(255), nullable=False, unique=True, index=True,
    )
    # Human-friendly display name (first occurrence wins).
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)

    brand: Mapped[Optional[str]] = mapped_column(String(120), nullable=True, index=True)
    category: Mapped[Optional[str]] = mapped_column(String(120), nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now(),
    )

    def __repr__(self) -> str:
        return f"<Product(id={self.id}, canonical='{self.canonical_name}')>"
