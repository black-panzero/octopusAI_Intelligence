"""
Merchant router — product listing management + analytics.

Only users with role='merchant' can access these endpoints. Merchants
can add/update/delete their own product listings (which become
PriceSnapshots in the catalog) and see analytics about views, price
position, and competitors.
"""
from typing import Annotated, Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models.merchant import Merchant
from app.db.models.price_snapshot import PriceSnapshot
from app.db.models.product import Product
from app.db.models.user import User
from app.routers.auth import get_current_user
from app.services.deal_sync_service import slugify

logger = structlog.get_logger(__name__)

router = APIRouter()


async def require_merchant(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if current_user.role not in ("merchant", "admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Merchant access required")
    return current_user


async def _get_or_create_merchant(db: AsyncSession, user: User) -> Merchant:
    """Each merchant user is backed by a Merchant catalog row."""
    slug = slugify(user.business_name or user.email.split("@")[0])
    stmt = select(Merchant).where(Merchant.slug == slug)
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        return existing
    m = Merchant(
        slug=slug,
        name=user.business_name or user.full_name or user.email,
        is_active=True,
    )
    db.add(m)
    await db.flush()
    return m


# ── Dashboard ─────────────────────────────────────────────────────
@router.get("/dashboard", summary="Merchant analytics dashboard")
async def dashboard(
    user: Annotated[User, Depends(require_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    merchant = await _get_or_create_merchant(db, user)

    total_listings = (await db.execute(
        select(func.count(PriceSnapshot.id))
        .where(PriceSnapshot.merchant_id == merchant.id)
    )).scalar_one() or 0

    unique_products = (await db.execute(
        select(func.count(func.distinct(PriceSnapshot.product_id)))
        .where(PriceSnapshot.merchant_id == merchant.id)
    )).scalar_one() or 0

    avg_price = (await db.execute(
        select(func.avg(PriceSnapshot.price))
        .where(PriceSnapshot.merchant_id == merchant.id)
    )).scalar_one()

    return {
        "merchant": {
            "id": merchant.id,
            "slug": merchant.slug,
            "name": merchant.name,
        },
        "stats": {
            "total_listings": total_listings,
            "unique_products": unique_products,
            "avg_price": round(float(avg_price or 0), 2),
        },
    }


# ── List merchant's products ──────────────────────────────────────
@router.get("/products", summary="List this merchant's product listings")
async def list_products(
    user: Annotated[User, Depends(require_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    size: int = Query(30, ge=1, le=100),
    q: Optional[str] = Query(None),
):
    merchant = await _get_or_create_merchant(db, user)

    # Latest snapshot per product for this merchant.
    latest_sq = (
        select(
            PriceSnapshot.product_id,
            func.max(PriceSnapshot.captured_at).label("max_t"),
        )
        .where(PriceSnapshot.merchant_id == merchant.id)
        .group_by(PriceSnapshot.product_id)
        .subquery()
    )

    stmt = (
        select(PriceSnapshot, Product)
        .join(Product, PriceSnapshot.product_id == Product.id)
        .join(
            latest_sq,
            (PriceSnapshot.product_id == latest_sq.c.product_id)
            & (PriceSnapshot.captured_at == latest_sq.c.max_t),
        )
        .where(PriceSnapshot.merchant_id == merchant.id)
    )

    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            Product.display_name.ilike(like) | Product.brand.ilike(like)
        )

    total = (await db.execute(
        select(func.count()).select_from(stmt.subquery())
    )).scalar_one() or 0

    stmt = stmt.order_by(desc(PriceSnapshot.captured_at)).offset((page - 1) * size).limit(size)
    rows = (await db.execute(stmt)).all()

    items = []
    for snap, product in rows:
        items.append({
            "product_id": product.id,
            "display_name": product.display_name,
            "brand": product.brand,
            "category": product.category,
            "size": product.size,
            "image_url": product.image_url,
            "price": snap.price,
            "currency": snap.currency,
            "url": snap.url,
            "is_available": snap.is_available,
            "last_updated": snap.captured_at.isoformat() if snap.captured_at else None,
        })

    return {"total": total, "page": page, "size": size, "items": items}


# ── Add / update a product listing ────────────────────────────────
from pydantic import BaseModel, Field


class MerchantProductIn(BaseModel):
    product_name: str = Field(..., min_length=1, max_length=255)
    price: float = Field(..., gt=0)
    currency: str = Field(default="KES", max_length=8)
    brand: Optional[str] = Field(default=None, max_length=120)
    category: Optional[str] = Field(default=None, max_length=120)
    size: Optional[str] = Field(default=None, max_length=64)
    url: Optional[str] = Field(default=None, max_length=500)
    image_url: Optional[str] = Field(default=None, max_length=500)
    is_available: bool = True
    description: Optional[str] = Field(default=None, max_length=1000)


@router.post("/products", status_code=201, summary="Add a product listing")
async def add_product(
    payload: MerchantProductIn,
    user: Annotated[User, Depends(require_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    import re
    merchant = await _get_or_create_merchant(db, user)

    canonical = re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", payload.product_name.lower())).strip()

    # Upsert product
    product = (await db.execute(
        select(Product).where(Product.canonical_name == canonical)
    )).scalar_one_or_none()

    if product is None:
        product = Product(
            canonical_name=canonical,
            display_name=payload.product_name,
            brand=payload.brand,
            category=payload.category,
            size=payload.size,
            image_url=payload.image_url,
        )
        db.add(product)
        await db.flush()
    else:
        if payload.brand and not product.brand:
            product.brand = payload.brand
        if payload.category and not product.category:
            product.category = payload.category
        if payload.image_url and not product.image_url:
            product.image_url = payload.image_url
        if payload.size and not product.size:
            product.size = payload.size

    # Create price snapshot
    snapshot = PriceSnapshot(
        product_id=product.id,
        merchant_id=merchant.id,
        price=float(payload.price),
        currency=payload.currency,
        url=payload.url,
        is_available=payload.is_available,
    )
    db.add(snapshot)
    await db.commit()

    return {
        "product_id": product.id,
        "merchant_id": merchant.id,
        "display_name": product.display_name,
        "price": snapshot.price,
        "created": True,
    }


@router.delete("/products/{product_id}", summary="Remove a listing")
async def remove_product(
    product_id: int,
    user: Annotated[User, Depends(require_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    merchant = await _get_or_create_merchant(db, user)

    # Mark latest snapshot as unavailable (soft-remove).
    latest = (await db.execute(
        select(PriceSnapshot)
        .where(
            PriceSnapshot.product_id == product_id,
            PriceSnapshot.merchant_id == merchant.id,
        )
        .order_by(desc(PriceSnapshot.captured_at))
        .limit(1)
    )).scalar_one_or_none()

    if latest is None:
        raise HTTPException(404, "Listing not found")

    latest.is_available = False
    await db.commit()
    return {"removed": True, "product_id": product_id}
