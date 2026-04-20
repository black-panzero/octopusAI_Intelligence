"""
Merchant adapter contract.

Every merchant integration implements `MerchantAdapter.search()` returning
a list of `RawOffer` dataclasses. Mock adapters today, real HTTP/Scrapy
adapters later — the aggregation service doesn't care which.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class RawOffer:
    """A single product offer as returned by a merchant adapter."""

    product_name: str
    price: float
    currency: str = "KES"
    url: Optional[str] = None
    available: bool = True
    brand: Optional[str] = None
    category: Optional[str] = None
    # Free-form metadata for future features (size, pack qty, image, etc).
    extra: dict = field(default_factory=dict)


class MerchantAdapter(ABC):
    """Abstract base for merchant integrations."""

    # Short, URL-safe identifier used as the DB slug.
    slug: str = ""
    name: str = ""
    base_url: Optional[str] = None
    logo_url: Optional[str] = None

    @abstractmethod
    async def search(self, query: str) -> list[RawOffer]:
        """Return offers matching `query`. Must not raise — return [] on errors."""
        raise NotImplementedError
