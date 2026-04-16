"""Admin router — inspection of the catalog + manual scrape trigger.

All routes require `is_superuser`. The first user registered is auto-
promoted, so one signup seeds the initial admin account.
"""
from typing import Annotated, Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models.cart import Cart, CartItem
from app.db.models.conversation import ChatTurn, Conversation
from app.db.models.merchant import Merchant
from app.db.models.price_rule import PriceRule
from app.db.models.price_snapshot import PriceSnapshot
from app.db.models.product import Product
from app.db.models.shopping_list import ShoppingList
from app.db.models.user import User
from app.routers.auth import get_current_user
from app.services.image_resolver import resolve_missing_images
from app.services.scraping_service import ScrapingService

logger = structlog.get_logger(__name__)

router = APIRouter()


async def require_superuser(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if not current_user.is_superuser:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")
    return current_user


@router.get("/stats", summary="Top-level counts across the system")
async def stats(
    _: Annotated[User, Depends(require_superuser)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    async def count(model):
        return (await db.execute(select(func.count(model.id)))).scalar_one() or 0

    return {
        "users": await count(User),
        "merchants": await count(Merchant),
        "products": await count(Product),
        "products_with_image": (await db.execute(
            select(func.count(Product.id)).where(Product.image_url.is_not(None))
        )).scalar_one() or 0,
        "price_snapshots": await count(PriceSnapshot),
        "carts": await count(Cart),
        "cart_items": await count(CartItem),
        "shopping_lists": await count(ShoppingList),
        "rules": await count(PriceRule),
        "conversations": await count(Conversation),
        "chat_turns": await count(ChatTurn),
    }


@router.get("/merchants", summary="All merchants in the catalog")
async def admin_merchants(
    _: Annotated[User, Depends(require_superuser)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    stmt = (
        select(
            Merchant,
            func.count(PriceSnapshot.id).label("snapshot_count"),
        )
        .outerjoin(PriceSnapshot, PriceSnapshot.merchant_id == Merchant.id)
        .group_by(Merchant.id)
        .order_by(Merchant.slug)
    )
    rows = (await db.execute(stmt)).all()
    return [
        {
            "id": m.id, "slug": m.slug, "name": m.name, "base_url": m.base_url,
            "is_active": m.is_active,
            "snapshot_count": int(count or 0),
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for (m, count) in rows
    ]


@router.get("/products", summary="Paginated products, newest first")
async def admin_products(
    _: Annotated[User, Depends(require_superuser)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    size: int = Query(30, ge=1, le=100),
    q: Optional[str] = Query(None, description="Case-insensitive substring on display_name / brand"),
    missing_image: bool = Query(False),
):
    stmt = select(Product)
    if q:
        like = f"%{q}%"
        stmt = stmt.where((Product.display_name.ilike(like)) | (Product.brand.ilike(like)))
    if missing_image:
        stmt = stmt.where(Product.image_url.is_(None))

    total_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(total_stmt)).scalar_one() or 0

    stmt = stmt.order_by(desc(Product.updated_at)).offset((page - 1) * size).limit(size)
    products = (await db.execute(stmt)).scalars().all()

    return {
        "total": total,
        "page": page,
        "size": size,
        "items": [
            {
                "id": p.id,
                "display_name": p.display_name,
                "canonical_name": p.canonical_name,
                "brand": p.brand,
                "category": p.category,
                "size": p.size,
                "rating": p.rating,
                "review_count": p.review_count,
                "image_url": p.image_url,
                "specs_keys": list(p.specs.keys()) if p.specs else [],
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "updated_at": p.updated_at.isoformat() if p.updated_at else None,
            }
            for p in products
        ],
    }


@router.get("/products/{product_id}/snapshots",
            summary="Every price snapshot for one product")
async def admin_product_snapshots(
    product_id: int,
    _: Annotated[User, Depends(require_superuser)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(100, ge=1, le=500),
):
    stmt = (
        select(PriceSnapshot, Merchant)
        .join(Merchant, PriceSnapshot.merchant_id == Merchant.id)
        .where(PriceSnapshot.product_id == product_id)
        .order_by(desc(PriceSnapshot.captured_at))
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    return [
        {
            "id": s.id,
            "product_id": s.product_id,
            "merchant_id": s.merchant_id,
            "merchant": m.name,
            "merchant_slug": m.slug,
            "price": s.price,
            "currency": s.currency,
            "url": s.url,
            "is_available": s.is_available,
            "captured_at": s.captured_at.isoformat() if s.captured_at else None,
        }
        for (s, m) in rows
    ]


@router.post("/scrape", summary="Trigger a live scrape across every registered merchant")
async def admin_scrape(
    q: str,
    _: Annotated[User, Depends(require_superuser)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = ScrapingService(db)
    return await service.refresh_for_query(q, force=True)


@router.post("/resolve-images", summary="Backfill missing product images (one batch)")
async def admin_resolve_images(
    _: Annotated[User, Depends(require_superuser)],
    db: Annotated[AsyncSession, Depends(get_db)],
    batch_size: int = Query(30, ge=1, le=100),
):
    n = await resolve_missing_images(db, batch_size=batch_size)
    return {"resolved": n, "batch_size": batch_size}
