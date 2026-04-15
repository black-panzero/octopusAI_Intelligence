"""Pydantic schemas for the product search API."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ProductOffer(BaseModel):
    """A single merchant offer for a canonical product."""

    model_config = ConfigDict(from_attributes=True)

    merchant: str
    merchant_slug: str
    price: float
    currency: str = "KES"
    url: Optional[str] = None
    available: bool = True
    captured_at: datetime


class ProductSummary(BaseModel):
    """Canonical product info returned in search results."""

    id: int
    canonical_name: str
    display_name: str
    brand: Optional[str] = None
    category: Optional[str] = None
    size: Optional[str] = None
    rating: Optional[float] = None
    review_count: Optional[int] = None
    image_url: Optional[str] = None
    specs: Optional[dict] = None


class ProductSearchResult(BaseModel):
    """Grouped cross-merchant result for a single product."""

    product: ProductSummary
    offers: list[ProductOffer]
    min_price: float
    max_price: float
    best_merchant: str
    offer_count: int
    savings_pct: float = Field(
        description="Percentage savings of min vs max price across merchants",
    )


class ProductSearchResponse(BaseModel):
    query: str
    count: int
    results: list[ProductSearchResult]
