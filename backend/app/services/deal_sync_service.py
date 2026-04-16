"""
Deal ↔ Catalog sync.

Every time a user creates a Deal we upsert a matching Merchant, Product
and PriceSnapshot. That way deals submitted via the UI immediately show
up in /products/search and can be added to the cart or tracked like any
other catalog product.
"""
import re
from typing import Optional, Tuple

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.deals import Deal
from app.db.models.merchant import Merchant
from app.db.models.price_snapshot import PriceSnapshot
from app.db.models.product import Product

logger = structlog.get_logger(__name__)


def canonicalize(name: str) -> str:
    """Lowercase, strip punctuation we don't care about, collapse whitespace."""
    cleaned = re.sub(r"[^\w\s]", " ", name.lower())
    return re.sub(r"\s+", " ", cleaned).strip()


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "merchant"


async def _upsert_merchant(db: AsyncSession, name: str) -> Merchant:
    slug = slugify(name)
    existing = (await db.execute(
        select(Merchant).where(Merchant.slug == slug)
    )).scalar_one_or_none()
    if existing is not None:
        return existing
    merchant = Merchant(slug=slug, name=name, is_active=True)
    db.add(merchant)
    await db.flush()
    return merchant


async def _upsert_product(
    db: AsyncSession, display_name: str,
    brand: Optional[str] = None, category: Optional[str] = None,
) -> Product:
    canonical = canonicalize(display_name)
    existing = (await db.execute(
        select(Product).where(Product.canonical_name == canonical)
    )).scalar_one_or_none()
    if existing is not None:
        # Fill in attributes that were previously unknown.
        if brand and not existing.brand:
            existing.brand = brand
        if category and not existing.category:
            existing.category = category
        return existing
    product = Product(
        canonical_name=canonical,
        display_name=display_name,
        brand=brand,
        category=category,
    )
    db.add(product)
    await db.flush()
    return product


async def sync_deal_to_catalog(db: AsyncSession, deal: Deal) -> Tuple[Product, Merchant]:
    """
    Ensure a Product + Merchant exists for the given Deal and insert a
    PriceSnapshot at the deal's effective (post-discount) price. Links
    the Deal row back to those IDs so the UI can reuse Add-to-Cart /
    Track flows.

    Caller is responsible for committing the session.
    """
    merchant = await _upsert_merchant(db, deal.merchant)
    product = await _upsert_product(
        db, display_name=deal.product_name,
        brand=None, category=deal.category,
    )

    # Use the discounted price if a discount was set, else the raw price.
    effective_price = deal.price
    if deal.discount is not None and deal.discount > 0:
        if deal.discount <= 100:
            effective_price = deal.price * (1 - deal.discount / 100)
        else:
            effective_price = max(0.0, deal.price - deal.discount)

    snapshot = PriceSnapshot(
        product_id=product.id,
        merchant_id=merchant.id,
        price=float(effective_price),
        currency="KES",
        url=deal.original_url,
        is_available=bool(deal.is_active),
    )
    db.add(snapshot)

    deal.product_id = product.id
    deal.merchant_id = merchant.id

    return product, merchant


async def backfill_deal_links(db: AsyncSession) -> int:
    """
    One-time backfill for deals that pre-date the unified catalog — walk
    every deal missing a product_id / merchant_id, upsert catalog rows,
    and insert one PriceSnapshot per deal so they surface in search.
    """
    orphans = (await db.execute(
        select(Deal).where(
            (Deal.product_id.is_(None)) | (Deal.merchant_id.is_(None))
        )
    )).scalars().all()

    if not orphans:
        return 0

    for deal in orphans:
        try:
            await sync_deal_to_catalog(db, deal)
        except Exception as e:
            logger.warning("Deal backfill failed", deal_id=deal.id, error=str(e))

    await db.commit()
    logger.info("Deals linked to catalog", count=len(orphans))
    return len(orphans)
