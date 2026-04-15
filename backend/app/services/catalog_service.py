"""
Catalog service — DB-backed product search.

Replaces the mock-adapter aggregation pipeline. Each /products/search
query joins products with the latest PriceSnapshot per (product, merchant)
pair and groups the result by product so the frontend can render
cross-merchant comparisons.
"""
from typing import Optional

import structlog
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.merchant import Merchant
from app.db.models.price_snapshot import PriceSnapshot
from app.db.models.product import Product

logger = structlog.get_logger(__name__)


class CatalogService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def search(self, query: str, limit: int = 50) -> list[dict]:
        q = query.strip()
        if not q:
            return []

        like = f"%{q}%"

        # Subquery: latest captured_at per (product, merchant) — ensures we
        # surface the freshest snapshot once real scrapers start writing
        # multiple rows per pair.
        latest_sq = (
            select(
                PriceSnapshot.product_id.label("product_id"),
                PriceSnapshot.merchant_id.label("merchant_id"),
                func.max(PriceSnapshot.captured_at).label("max_captured"),
            )
            .group_by(PriceSnapshot.product_id, PriceSnapshot.merchant_id)
            .subquery()
        )

        stmt = (
            select(PriceSnapshot, Product, Merchant)
            .join(Product, PriceSnapshot.product_id == Product.id)
            .join(Merchant, PriceSnapshot.merchant_id == Merchant.id)
            .join(
                latest_sq,
                and_(
                    PriceSnapshot.product_id == latest_sq.c.product_id,
                    PriceSnapshot.merchant_id == latest_sq.c.merchant_id,
                    PriceSnapshot.captured_at == latest_sq.c.max_captured,
                ),
            )
            .where(
                or_(
                    Product.display_name.ilike(like),
                    Product.canonical_name.ilike(like),
                    Product.brand.ilike(like),
                    Product.category.ilike(like),
                )
            )
            .limit(limit * 4)  # each product can have multiple merchant rows
        )

        rows = (await self.db.execute(stmt)).all()

        # Group rows by product_id for the response shape.
        grouped: dict[int, dict] = {}
        for snapshot, product, merchant in rows:
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
            bucket["offers"].append(
                {
                    "merchant": merchant.name,
                    "merchant_slug": merchant.slug,
                    "merchant_id": merchant.id,
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
            prices = [o["price"] for o in offers]
            min_p, max_p = min(prices), max(prices)
            bucket["offers"] = offers
            bucket["min_price"] = min_p
            bucket["max_price"] = max_p
            bucket["best_merchant"] = offers[0]["merchant"]
            bucket["offer_count"] = len(offers)
            bucket["savings_pct"] = (
                ((max_p - min_p) / max_p) * 100 if max_p > 0 and max_p != min_p else 0.0
            )
            results.append(bucket)

        results.sort(key=lambda r: (-r["offer_count"], r["min_price"]))
        return results[:limit]

    async def latest_price_for_product(
        self, product_id: int
    ) -> Optional[tuple[PriceSnapshot, Merchant]]:
        """Return the cheapest current offer for a product, with its merchant."""
        latest_sq = (
            select(
                PriceSnapshot.product_id,
                PriceSnapshot.merchant_id,
                func.max(PriceSnapshot.captured_at).label("max_captured"),
            )
            .where(PriceSnapshot.product_id == product_id)
            .group_by(PriceSnapshot.product_id, PriceSnapshot.merchant_id)
            .subquery()
        )
        stmt = (
            select(PriceSnapshot, Merchant)
            .join(Merchant, PriceSnapshot.merchant_id == Merchant.id)
            .join(
                latest_sq,
                and_(
                    PriceSnapshot.product_id == latest_sq.c.product_id,
                    PriceSnapshot.merchant_id == latest_sq.c.merchant_id,
                    PriceSnapshot.captured_at == latest_sq.c.max_captured,
                ),
            )
            .order_by(PriceSnapshot.price.asc())
            .limit(1)
        )
        result = (await self.db.execute(stmt)).first()
        return result if result is None else (result[0], result[1])
