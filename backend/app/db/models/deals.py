# app/models/deal.py
"""
Deal model for database persistence

Every Deal is mirrored into the canonical catalog (Product + Merchant +
PriceSnapshot) on create, so user-submitted deals show up in Compare
Prices and can be added to the cart or tracked like any other product.
"""
from datetime import datetime
from typing import Optional

import structlog
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base

logger = structlog.get_logger(__name__)


class Deal(Base):
    """
    Deal model representing a shopping offer or discount.

    This model captures essential deal information for the SmartBuy
    deal aggregation engine, providing the foundation for deal management.
    """

    __tablename__ = "deals"

    # Primary key - auto-incremented unique identifier
    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        index=True,
        doc="Unique identifier for the deal"
    )

    # Core deal information
    product_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
        doc="Name of the product or service on offer"
    )

    price: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        doc="Original price of the product"
    )

    discount: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
        default=None,
        doc="Discount percentage or amount (optional)"
    )

    merchant: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
        doc="Store or provider offering the deal"
    )

    # Timestamps
    expiry: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
        doc="Expiration date of the deal"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        doc="Timestamp when the deal was created"
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        doc="Timestamp when the deal was last updated"
    )

    # Optional additional information for future extensibility
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        default=None,
        doc="Optional description of the deal"
    )

    category: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        default=None,
        index=True,
        doc="Product category for future filtering"
    )

    original_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        default=None,
        doc="Original URL where the deal was found"
    )

    is_active: Mapped[bool] = mapped_column(
        nullable=False,
        default=True,
        index=True,
        doc="Whether the deal is currently active"
    )

    # Links to the canonical catalog so the UI can reuse Add-to-Cart /
    # Track-price flows that operate on (product_id, merchant_id) pairs.
    product_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("products.id", ondelete="SET NULL"),
        nullable=True, default=None, index=True,
    )
    merchant_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("merchants.id", ondelete="SET NULL"),
        nullable=True, default=None, index=True,
    )

    def __repr__(self) -> str:
        """String representation of the Deal model."""
        return (
            f"<Deal(id={self.id}, product_name='{self.product_name}', "
            f"price={self.price}, merchant='{self.merchant}', "
            f"discount={self.discount}, active={self.is_active})>"
        )

    @property
    def discounted_price(self) -> Optional[float]:
        """Calculate the discounted price if discount is available."""
        if self.discount is None:
            return None

        if self.discount > 0 and self.discount <= 100:
            # Assume percentage discount
            return self.price * (1 - self.discount / 100)
        elif self.discount > 0:
            # Assume fixed amount discount
            return max(0, self.price - self.discount)

        return self.price

    @property
    def savings_amount(self) -> Optional[float]:
        """Calculate the savings amount if discount is available."""
        discounted = self.discounted_price
        if discounted is None:
            return None
        return self.price - discounted

    @property
    def is_expired(self) -> bool:
        """Check if the deal has expired."""
        if self.expiry is None:
            return False
        return datetime.utcnow() > self.expiry.replace(tzinfo=None)
