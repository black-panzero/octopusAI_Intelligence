"""
Scraping service — parallel merchant scrapers + canonical catalog write.

Optimizations in this iteration:
  * Module-level query cache (10-minute TTL) so repeated searches are near-instant
  * Product image reuse — once a Product has an image_url we don't overwrite it
  * Richer Product metadata (size, rating, review_count, specs) merged from scrapes
  * Per-hour duplicate-snapshot suppression so history stays clean
"""
from __future__ import annotations

import asyncio
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.merchant import Merchant
from app.db.models.price_snapshot import PriceSnapshot
from app.db.models.product import Product
from app.services.scrapers.base import BaseScraper, ScrapedOffer
from app.services.scrapers.carrefour import CarrefourKeScraper
from app.services.scrapers.copia import CopiaScraper
from app.services.scrapers.hotpoint import HotpointScraper
from app.services.scrapers.jumia_ke import JumiaKeScraper
from app.services.scrapers.kilimall import KilimallScraper
from app.services.scrapers.masoko import MasokoScraper
from app.services.scrapers.naivas import NaivasScraper
from app.services.scrapers.phone_place_kenya import PhonePlaceKenyaScraper
from app.services.scrapers.quickmart import QuickmartScraper

logger = structlog.get_logger(__name__)


# The active scraper registry — every live Kenyan merchant SmartBuy knows.
# Adding a new storefront is a one-liner: import + append.
SCRAPERS: list[BaseScraper] = [
    NaivasScraper(),
    CarrefourKeScraper(),
    QuickmartScraper(),
    JumiaKeScraper(),
    KilimallScraper(),
    MasokoScraper(),
    HotpointScraper(),
    PhonePlaceKenyaScraper(),
    CopiaScraper(),
]


def _canonicalize(name: str) -> str:
    cleaned = re.sub(r"[^\w\s]", " ", name.lower())
    return re.sub(r"\s+", " ", cleaned).strip()


async def _safe_run(scraper: BaseScraper, query: str) -> tuple[BaseScraper, list[ScrapedOffer]]:
    try:
        offers = await asyncio.wait_for(scraper.search(query), timeout=scraper.timeout_seconds + 3)
        return scraper, offers
    except Exception as e:
        logger.warning("scraper.run_failed", scraper=scraper.slug, error=str(e))
        return scraper, []


# Module-level query cache: { normalized_query: (expires_at_epoch, summary_dict) }
# Small, deliberately in-process. Redis would be a drop-in replacement.
_QUERY_CACHE: dict[str, tuple[float, dict]] = {}
_QUERY_CACHE_TTL_SECONDS = 10 * 60  # 10 min


class ScrapingService:
    """Coordinates live scrapers + persists into the catalog tables."""

    def __init__(self, db: AsyncSession, scrapers: Optional[list[BaseScraper]] = None):
        self.db = db
        self.scrapers = scrapers if scrapers is not None else SCRAPERS

    async def refresh_for_query(self, query: str, *, force: bool = False) -> dict:
        q_norm = _canonicalize(query)
        if not q_norm:
            return {"query": query, "scrapers_ran": [], "offers_persisted": 0,
                    "per_scraper": [], "cached": False}

        # 1. Cheap cache hit if we scraped this exact query very recently.
        if not force:
            cached = _QUERY_CACHE.get(q_norm)
            if cached and cached[0] > time.time():
                hit = dict(cached[1])
                hit["cached"] = True
                return hit

        # 2. Fan-out to every scraper in parallel.
        pairs = await asyncio.gather(*(_safe_run(s, query) for s in self.scrapers))

        per_scraper: list[dict] = []
        offers_persisted = 0

        for scraper, offers in pairs:
            if not offers:
                per_scraper.append({"slug": scraper.slug, "ok": False, "count": 0})
                continue
            merchant = await self._upsert_merchant(scraper)
            count = 0
            for offer in offers:
                try:
                    await self._persist_offer(merchant, offer)
                    count += 1
                except Exception as e:
                    logger.warning("scraper.persist_failed", scraper=scraper.slug, error=str(e))
            per_scraper.append({"slug": scraper.slug, "ok": True, "count": count})
            offers_persisted += count

        await self.db.commit()

        summary = {
            "query": query,
            "scrapers_ran": [s.slug for s in self.scrapers],
            "offers_persisted": offers_persisted,
            "per_scraper": per_scraper,
            "cached": False,
        }
        _QUERY_CACHE[q_norm] = (time.time() + _QUERY_CACHE_TTL_SECONDS, summary)
        return summary

    # ------------------------------------------------------------------
    # persistence helpers
    # ------------------------------------------------------------------

    async def _upsert_merchant(self, scraper: BaseScraper) -> Merchant:
        stmt = select(Merchant).where(Merchant.slug == scraper.slug)
        existing = (await self.db.execute(stmt)).scalar_one_or_none()
        if existing is not None:
            if scraper.name and existing.name != scraper.name:
                existing.name = scraper.name
            if scraper.base_url and not existing.base_url:
                existing.base_url = scraper.base_url
            return existing
        merchant = Merchant(
            slug=scraper.slug,
            name=scraper.name or scraper.slug.title(),
            base_url=scraper.base_url,
            is_active=True,
        )
        self.db.add(merchant)
        await self.db.flush()
        return merchant

    async def _persist_offer(self, merchant: Merchant, offer: ScrapedOffer) -> None:
        canonical = _canonicalize(offer.product_name)
        if not canonical:
            return

        product_stmt = select(Product).where(Product.canonical_name == canonical)
        product = (await self.db.execute(product_stmt)).scalar_one_or_none()

        if product is None:
            product = Product(
                canonical_name=canonical,
                display_name=offer.product_name,
                brand=offer.brand,
                category=offer.category,
                image_url=offer.image_url,
                rating=offer.rating,
                review_count=offer.review_count,
                size=offer.size,
                specs=offer.specs,
            )
            self.db.add(product)
            await self.db.flush()
        else:
            # Only fill attributes that are currently null so a richer scrape
            # result can't overwrite data we already trust. Image is the key
            # dedup target requested — same product across stores reuses it.
            if offer.brand and not product.brand:
                product.brand = offer.brand
            if offer.category and not product.category:
                product.category = offer.category
            if offer.image_url and not product.image_url:
                product.image_url = offer.image_url
            if offer.size and not product.size:
                product.size = offer.size
            if offer.rating is not None and product.rating is None:
                product.rating = offer.rating
            if offer.review_count is not None and product.review_count is None:
                product.review_count = offer.review_count
            if offer.specs:
                # Merge specs: scraper-provided keys fill in; existing keys win.
                merged = dict(offer.specs)
                if product.specs:
                    merged.update(product.specs)
                product.specs = merged

        # Skip near-identical snapshots captured in the last hour so history
        # doesn't get polluted when users hit "Refresh live" in quick succession.
        recent_stmt = (
            select(PriceSnapshot)
            .where(
                PriceSnapshot.product_id == product.id,
                PriceSnapshot.merchant_id == merchant.id,
                PriceSnapshot.captured_at >= datetime.now(timezone.utc) - timedelta(hours=1),
            )
            .order_by(PriceSnapshot.captured_at.desc())
            .limit(1)
        )
        recent = (await self.db.execute(recent_stmt)).scalar_one_or_none()
        if recent is not None and abs(recent.price - offer.price) < 0.01:
            return

        self.db.add(
            PriceSnapshot(
                product_id=product.id,
                merchant_id=merchant.id,
                price=float(offer.price),
                currency=offer.currency or "KES",
                url=offer.url,
                is_available=offer.available,
            )
        )
