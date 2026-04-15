"""Canonical product entity. One row per normalized product name."""
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import JSON, DateTime, Float, Integer, String, func
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

    # Comparison attributes — populated from seed or merchant feeds.
    size: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    rating: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    review_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Category-specific specs (cpu/ram/display for electronics, ingredients for
    # groceries, etc.) — stored as JSON so the schema doesn't need to know
    # about every attribute up front.
    specs: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now(),
    )

    def __repr__(self) -> str:
        return f"<Product(id={self.id}, canonical='{self.canonical_name}')>"

