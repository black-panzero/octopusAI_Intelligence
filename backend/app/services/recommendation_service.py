"""
Recommendation service — rule-based v1.

Surfaces 'best deals', 'biggest price drops' and 'top rated' products
from the current catalog. No ML yet; this is deliberately simple so we
can swap in a learned model later without touching the frontend.
"""
from datetime import datetime, timedelta, timezone
from math import sqrt
from typing import Optional

import structlog
from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.merchant import Merchant
from app.db.models.price_snapshot import PriceSnapshot
from app.db.models.product import Product

logger = structlog.get_logger(__name__)


class RecommendationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def for_user(self, user_id: Optional[int] = None) -> dict:
        best_deals = await self._best_deals()
        price_drops = await self._price_drops()
        top_rated = await self._top_rated()
        return {
            "best_deals": best_deals,
            "price_drops": price_drops,
            "top_rated": top_rated,
        }

    # ------------------------------------------------------------------
    # internals
    # ------------------------------------------------------------------

    async def _latest_per_pair(self) -> list:
        """Fetch (PriceSnapshot, Product, Merchant) for the latest snapshot
        of every (product, merchant) pair."""
        latest_sq = (
            select(
                PriceSnapshot.product_id,
                PriceSnapshot.merchant_id,
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
        )
        return (await self.db.execute(stmt)).all()

    async def _best_deals(self, limit: int = 6) -> list[dict]:
        rows = await self._latest_per_pair()
        grouped: dict[int, dict] = {}
        for snap, product, merchant in rows:
            bucket = grouped.setdefault(
                product.id,
                {"product": self._product_dict(product), "offers": []},
            )
            bucket["offers"].append({
                "merchant": merchant.name,
                "merchant_slug": merchant.slug,
                "merchant_id": merchant.id,
                "price": snap.price,
                "url": snap.url,
            })

        results: list[dict] = []
        for bucket in grouped.values():
            prices = [o["price"] for o in bucket["offers"]]
            if len(prices) < 2:
                continue
            min_p, max_p = min(prices), max(prices)
            if max_p <= 0 or min_p == max_p:
                continue
            bucket["offers"].sort(key=lambda o: o["price"])
            bucket["min_price"] = min_p
            bucket["max_price"] = max_p
            bucket["savings_pct"] = ((max_p - min_p) / max_p) * 100
            bucket["best_merchant"] = bucket["offers"][0]["merchant"]
            bucket["offer_count"] = len(prices)
            results.append(bucket)

        results.sort(key=lambda r: -r["savings_pct"])
        return results[:limit]

    async def _price_drops(self, limit: int = 6) -> list[dict]:
        """Products where the latest price at a merchant is meaningfully lower
        than the previous one for the same pair."""
        # Pull every snapshot for the last ~60 days ordered by time.
        since = datetime.now(timezone.utc) - timedelta(days=60)
        stmt = (
            select(PriceSnapshot, Product, Merchant)
            .join(Product, PriceSnapshot.product_id == Product.id)
            .join(Merchant, PriceSnapshot.merchant_id == Merchant.id)
            .where(PriceSnapshot.captured_at >= since)
            .order_by(PriceSnapshot.product_id, PriceSnapshot.merchant_id,
                      PriceSnapshot.captured_at.desc())
        )
        rows = (await self.db.execute(stmt)).all()

        # Keep only the last two snapshots per (product, merchant).
        latest_two: dict[tuple[int, int], list] = {}
        for snap, product, merchant in rows:
            key = (product.id, merchant.id)
            if len(latest_two.setdefault(key, [])) < 2:
                latest_two[key].append((snap, product, merchant))

        drops: list[dict] = []
        for pair in latest_two.values():
            if len(pair) < 2:
                continue
            latest, prev = pair[0], pair[1]
            if latest[0].price >= prev[0].price:
                continue
            delta = prev[0].price - latest[0].price
            pct = (delta / prev[0].price) * 100 if prev[0].price > 0 else 0
            if pct < 1:  # ignore rounding noise
                continue
            drops.append({
                "product": self._product_dict(latest[1]),
                "merchant": latest[2].name,
                "merchant_slug": latest[2].slug,
                "merchant_id": latest[2].id,
                "previous_price": prev[0].price,
                "current_price": latest[0].price,
                "drop_abs": delta,
                "drop_pct": pct,
                "observed_at": latest[0].captured_at.isoformat(),
            })

        drops.sort(key=lambda d: -d["drop_pct"])
        return drops[:limit]

    async def _top_rated(self, limit: int = 6) -> list[dict]:
        """Simple Bayesian-ish ranking: rating × sqrt(review_count)."""
        stmt = (
            select(Product)
            .where(
                Product.rating.is_not(None),
                Product.review_count.is_not(None),
            )
        )
        products = (await self.db.execute(stmt)).scalars().all()
        ranked = sorted(
            products,
            key=lambda p: -((p.rating or 0) * sqrt((p.review_count or 0))),
        )
        out = []
        for p in ranked[:limit]:
            # Attach the cheapest current merchant for click-through.
            latest_sq = (
                select(PriceSnapshot.merchant_id, func.max(PriceSnapshot.captured_at).label("mx"))
                .where(PriceSnapshot.product_id == p.id)
                .group_by(PriceSnapshot.merchant_id)
                .subquery()
            )
            best_stmt = (
                select(PriceSnapshot, Merchant)
                .join(Merchant, PriceSnapshot.merchant_id == Merchant.id)
                .join(
                    latest_sq,
                    and_(
                        PriceSnapshot.merchant_id == latest_sq.c.merchant_id,
                        PriceSnapshot.captured_at == latest_sq.c.mx,
                    ),
                )
                .where(PriceSnapshot.product_id == p.id)
                .order_by(PriceSnapshot.price.asc())
                .limit(1)
            )
            best_row = (await self.db.execute(best_stmt)).first()
            min_price = best_row[0].price if best_row else None
            merchant_name = best_row[1].name if best_row else None
            merchant_id = best_row[1].id if best_row else None
            merchant_slug = best_row[1].slug if best_row else None
            out.append({
                "product": self._product_dict(p),
                "min_price": min_price,
                "merchant": merchant_name,
                "merchant_id": merchant_id,
                "merchant_slug": merchant_slug,
            })
        return out

    def _product_dict(self, product: Product) -> dict:
        return {
            "id": product.id,
            "display_name": product.display_name,
            "brand": product.brand,
            "category": product.category,
            "size": product.size,
            "rating": product.rating,
            "review_count": product.review_count,
            "image_url": product.image_url,
        }
