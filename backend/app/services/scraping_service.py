"""
Scraping service — runs every registered scraper in parallel, persists
the results into the canonical catalog (Merchant + Product + PriceSnapshot),
and returns a summary suitable for wiring into /products/search?live=1.
"""
from __future__ import annotations

import asyncio
import re
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
from app.services.scrapers.jumia_ke import JumiaKeScraper
from app.services.scrapers.naivas import NaivasScraper
from app.services.scrapers.quickmart import QuickmartScraper

logger = structlog.get_logger(__name__)


# The active scraper registry. Wire a new live merchant by appending here.
SCRAPERS: list[BaseScraper] = [
    NaivasScraper(),
    CarrefourKeScraper(),
    QuickmartScraper(),
    JumiaKeScraper(),
]


def _canonicalize(name: str) -> str:
    cleaned = re.sub(r"[^\w\s]", " ", name.lower())
    return re.sub(r"\s+", " ", cleaned).strip()


async def _safe_run(scraper: BaseScraper, query: str) -> tuple[BaseScraper, list[ScrapedOffer]]:
    try:
        offers = await asyncio.wait_for(scraper.search(query), timeout=scraper.timeout_seconds + 3)
        return scraper, offers
    except Exception as e:  # pragma: no cover — never crash the orchestrator
        logger.warning("scraper.run_failed", scraper=scraper.slug, error=str(e))
        return scraper, []


class ScrapingService:
    """Coordinates live scrapers + persists into the catalog tables."""

    # If we've already scraped this (query, slug) within this window we skip it.
    stale_after: timedelta = timedelta(minutes=30)

    def __init__(self, db: AsyncSession, scrapers: Optional[list[BaseScraper]] = None):
        self.db = db
        self.scrapers = scrapers if scrapers is not None else SCRAPERS

    async def refresh_for_query(self, query: str) -> dict:
        """
        Run every scraper for `query` in parallel, write the results, and
        return a summary. Designed to be called before a catalog read so
        fresh snapshots are included.
        """
        q = (query or "").strip()
        if not q:
            return {"query": q, "scrapers_ran": [], "offers_persisted": 0,
                    "per_scraper": []}

        pairs = await asyncio.gather(*(_safe_run(s, q) for s in self.scrapers))

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
                    logger.warning(
                        "scraper.persist_failed", scraper=scraper.slug, error=str(e),
                    )
            per_scraper.append({"slug": scraper.slug, "ok": True, "count": count})
            offers_persisted += count

        await self.db.commit()

        return {
            "query": q,
            "scrapers_ran": [s.slug for s in self.scrapers],
            "offers_persisted": offers_persisted,
            "per_scraper": per_scraper,
        }

    # ------------------------------------------------------------------
    # persistence helpers
    # ------------------------------------------------------------------

    async def _upsert_merchant(self, scraper: BaseScraper) -> Merchant:
        stmt = select(Merchant).where(Merchant.slug == scraper.slug)
        existing = (await self.db.execute(stmt)).scalar_one_or_none()
        if existing is not None:
            # Keep the display name + base_url fresh (handy if a scraper
            # registers a brand-new slug.)
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
            )
            self.db.add(product)
            await self.db.flush()
        else:
            if offer.brand and not product.brand:
                product.brand = offer.brand
            if offer.category and not product.category:
                product.category = offer.category
            if offer.image_url and not product.image_url:
                product.image_url = offer.image_url

        # Skip if we already captured the same price for this merchant in the
        # last hour — avoids piling up duplicate history from rapid re-scrapes.
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
