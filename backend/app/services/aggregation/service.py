"""
Aggregation service — runs every merchant adapter in parallel, normalizes
the raw offers, persists `Merchant` / `Product` / `PriceSnapshot` rows,
and returns grouped cross-merchant comparisons ready for the API.
"""
import asyncio
import re
from typing import Iterable, Optional

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.merchant import Merchant
from app.db.models.price_snapshot import PriceSnapshot
from app.db.models.product import Product
from app.services.aggregation.base import MerchantAdapter, RawOffer

logger = structlog.get_logger(__name__)


def canonicalize(name: str) -> str:
    """Normalize a product name to a stable key used for cross-merchant dedup."""
    # Lowercase, strip punctuation we don't care about, collapse whitespace.
    cleaned = re.sub(r"[^\w\s]", " ", name.lower())
    return re.sub(r"\s+", " ", cleaned).strip()


class AggregationService:
    """Orchestrates merchant adapters and persists results."""

    def __init__(self, db: AsyncSession, adapters: Iterable[MerchantAdapter]):
        self.db = db
        self.adapters = list(adapters)

    async def search(self, query: str) -> list[dict]:
        """
        Query every adapter concurrently, persist snapshots, and return
        a list of grouped product results:
            {
              "product": { id, canonical_name, display_name, brand, category },
              "offers": [ { merchant, merchant_slug, price, currency, url,
                            available, captured_at } ],
              "min_price", "max_price", "best_merchant", "savings_pct", "offer_count"
            }
        """
        q = query.strip()
        if not q:
            return []

        # Fan-out concurrently, tolerate individual adapter failures.
        raw_results = await asyncio.gather(
            *(self._safe_search(adapter, q) for adapter in self.adapters),
            return_exceptions=False,
        )

        # Flatten to (adapter, offer) pairs.
        pairs: list[tuple[MerchantAdapter, RawOffer]] = []
        for adapter, offers in zip(self.adapters, raw_results):
            pairs.extend((adapter, offer) for offer in offers)

        if not pairs:
            return []

        # Persist merchants + products + snapshots, then build response.
        merchant_by_slug = await self._upsert_merchants(
            {adapter for adapter, _ in pairs}
        )
        product_by_canonical = await self._upsert_products(
            [offer for _, offer in pairs]
        )

        snapshots: list[PriceSnapshot] = []
        for adapter, offer in pairs:
            snapshots.append(
                PriceSnapshot(
                    product_id=product_by_canonical[canonicalize(offer.product_name)].id,
                    merchant_id=merchant_by_slug[adapter.slug].id,
                    price=float(offer.price),
                    currency=offer.currency or "KES",
                    url=offer.url,
                    is_available=offer.available,
                )
            )
        self.db.add_all(snapshots)
        await self.db.commit()
        for s in snapshots:
            await self.db.refresh(s)

        # Group the freshly captured snapshots by product for the response.
        grouped: dict[int, dict] = {}
        for (adapter, offer), snapshot in zip(pairs, snapshots):
            product = product_by_canonical[canonicalize(offer.product_name)]
            bucket = grouped.setdefault(
                product.id,
                {
                    "product": {
                        "id": product.id,
                        "canonical_name": product.canonical_name,
                        "display_name": product.display_name,
                        "brand": product.brand,
                        "category": product.category,
                    },
                    "offers": [],
                },
            )
            merchant = merchant_by_slug[adapter.slug]
            bucket["offers"].append(
                {
                    "merchant": merchant.name,
                    "merchant_slug": merchant.slug,
                    "price": snapshot.price,
                    "currency": snapshot.currency,
                    "url": snapshot.url,
                    "available": snapshot.is_available,
                    "captured_at": snapshot.captured_at,
                }
            )

        results = []
        for bucket in grouped.values():
            offers = sorted(bucket["offers"], key=lambda o: o["price"])
            bucket["offers"] = offers
            prices = [o["price"] for o in offers]
            min_p, max_p = min(prices), max(prices)
            bucket["min_price"] = min_p
            bucket["max_price"] = max_p
            bucket["best_merchant"] = offers[0]["merchant"]
            bucket["offer_count"] = len(offers)
            bucket["savings_pct"] = (
                ((max_p - min_p) / max_p) * 100 if max_p > 0 and max_p != min_p else 0.0
            )
            results.append(bucket)

        # Most offers first — products with the richest comparison float up.
        results.sort(key=lambda r: (-r["offer_count"], r["min_price"]))
        return results

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _safe_search(self, adapter: MerchantAdapter, query: str) -> list[RawOffer]:
        try:
            return await adapter.search(query)
        except Exception as e:  # adapters must never take the whole search down
            logger.warning(
                "Merchant adapter failed; skipping",
                adapter=adapter.slug, error=str(e),
            )
            return []

    async def _upsert_merchants(
        self, adapters: set[MerchantAdapter]
    ) -> dict[str, Merchant]:
        result: dict[str, Merchant] = {}
        for adapter in adapters:
            stmt = select(Merchant).where(Merchant.slug == adapter.slug)
            existing = (await self.db.execute(stmt)).scalar_one_or_none()
            if existing is None:
                existing = Merchant(
                    slug=adapter.slug,
                    name=adapter.name,
                    base_url=adapter.base_url,
                    logo_url=adapter.logo_url,
                    is_active=True,
                )
                self.db.add(existing)
                await self.db.flush()
            result[adapter.slug] = existing
        return result

    async def _upsert_products(self, offers: list[RawOffer]) -> dict[str, Product]:
        # Reduce to unique canonical names, keeping the first-seen display name.
        by_canon: dict[str, RawOffer] = {}
        for offer in offers:
            key = canonicalize(offer.product_name)
            by_canon.setdefault(key, offer)

        result: dict[str, Product] = {}
        for canon, offer in by_canon.items():
            stmt = select(Product).where(Product.canonical_name == canon)
            existing = (await self.db.execute(stmt)).scalar_one_or_none()
            if existing is None:
                existing = Product(
                    canonical_name=canon,
                    display_name=offer.product_name,
                    brand=offer.brand,
                    category=offer.category,
                )
                self.db.add(existing)
                await self.db.flush()
            else:
                # Fill brand/category lazily if we didn't know them before.
                if not existing.brand and offer.brand:
                    existing.brand = offer.brand
                if not existing.category and offer.category:
                    existing.category = offer.category
            result[canon] = existing
        return result
