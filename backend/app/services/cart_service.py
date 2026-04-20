"""
Cart service — one cart per user, one row per (product, merchant) pair.

Computes cross-merchant totals and the savings delta vs. buying
everything at the single best-combined merchant.
"""
from typing import Optional

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.cart import Cart, CartItem
from app.db.models.merchant import Merchant
from app.db.models.price_snapshot import PriceSnapshot
from app.db.models.product import Product

logger = structlog.get_logger(__name__)


class CartService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create(self, user_id: int) -> Cart:
        stmt = select(Cart).where(Cart.user_id == user_id).options(selectinload(Cart.items))
        cart = (await self.db.execute(stmt)).scalar_one_or_none()
        if cart is not None:
            return cart
        cart = Cart(user_id=user_id)
        self.db.add(cart)
        await self.db.commit()
        await self.db.refresh(cart, attribute_names=["items"])
        return cart

    async def _serialize(self, cart: Cart) -> dict:
        """Return the cart as a dict with per-merchant totals + savings."""
        if not cart.items:
            return {
                "id": cart.id, "items": [],
                "merchant_totals": [], "total": 0.0,
                "item_count": 0, "savings_vs_worst_split": 0.0,
                "updated_at": cart.updated_at,
            }

        # Pull related product + merchant rows in one query each.
        product_ids = {i.product_id for i in cart.items}
        merchant_ids = {i.merchant_id for i in cart.items}
        products = {
            p.id: p for p in (
                await self.db.execute(select(Product).where(Product.id.in_(product_ids)))
            ).scalars().all()
        }
        merchants = {
            m.id: m for m in (
                await self.db.execute(select(Merchant).where(Merchant.id.in_(merchant_ids)))
            ).scalars().all()
        }

        items = []
        merchant_totals: dict[int, dict] = {}
        grand_total = 0.0
        worst_total = 0.0

        for item in cart.items:
            product = products.get(item.product_id)
            merchant = merchants.get(item.merchant_id)
            subtotal = round(item.price_at_add * item.quantity, 2)
            grand_total += subtotal

            items.append({
                "id": item.id,
                "product_id": item.product_id,
                "merchant_id": item.merchant_id,
                "product_name": product.display_name if product else f"#{item.product_id}",
                "brand": product.brand if product else None,
                "category": product.category if product else None,
                "merchant": merchant.name if merchant else f"#{item.merchant_id}",
                "merchant_slug": merchant.slug if merchant else None,
                "price": item.price_at_add,
                "quantity": item.quantity,
                "subtotal": subtotal,
                "added_at": item.added_at,
            })

            key = item.merchant_id
            bucket = merchant_totals.setdefault(
                key,
                {"merchant": merchant.name if merchant else f"#{key}",
                 "merchant_slug": merchant.slug if merchant else None,
                 "total": 0.0, "item_count": 0},
            )
            bucket["total"] = round(bucket["total"] + subtotal, 2)
            bucket["item_count"] += item.quantity

            # Worst-case price for this product (across all merchants) — used
            # to compute how much this cart saves vs. a naive single-merchant buy.
            worst_row = (await self.db.execute(
                select(func.max(PriceSnapshot.price))
                .where(PriceSnapshot.product_id == item.product_id)
            )).scalar_one_or_none() or item.price_at_add
            worst_total += worst_row * item.quantity

        savings = max(0.0, round(worst_total - grand_total, 2))

        return {
            "id": cart.id,
            "items": items,
            "merchant_totals": sorted(
                merchant_totals.values(), key=lambda b: -b["total"],
            ),
            "total": round(grand_total, 2),
            "item_count": sum(i["quantity"] for i in items),
            "savings_vs_worst_split": savings,
            "updated_at": cart.updated_at,
        }

    async def view(self, user_id: int) -> dict:
        cart = await self.get_or_create(user_id)
        return await self._serialize(cart)

    async def add_item(
        self, user_id: int, product_id: int, merchant_id: int, quantity: int = 1,
    ) -> dict:
        cart = await self.get_or_create(user_id)

        # Resolve the current price at that merchant from the latest snapshot.
        snap = (await self.db.execute(
            select(PriceSnapshot)
            .where(PriceSnapshot.product_id == product_id, PriceSnapshot.merchant_id == merchant_id)
            .order_by(PriceSnapshot.captured_at.desc())
            .limit(1)
        )).scalar_one_or_none()
        if snap is None:
            raise ValueError("No price on record for that product/merchant pair")

        existing = (await self.db.execute(
            select(CartItem).where(
                CartItem.cart_id == cart.id,
                CartItem.product_id == product_id,
                CartItem.merchant_id == merchant_id,
            )
        )).scalar_one_or_none()

        if existing is not None:
            existing.quantity = existing.quantity + quantity
            existing.price_at_add = snap.price  # refresh to the latest price
        else:
            self.db.add(CartItem(
                cart_id=cart.id,
                product_id=product_id,
                merchant_id=merchant_id,
                quantity=max(1, int(quantity)),
                price_at_add=float(snap.price),
            ))

        await self.db.commit()
        await self.db.refresh(cart, attribute_names=["items"])
        return await self._serialize(cart)

    async def update_quantity(self, user_id: int, item_id: int, quantity: int) -> dict:
        cart = await self.get_or_create(user_id)
        item = (await self.db.execute(
            select(CartItem).where(CartItem.id == item_id, CartItem.cart_id == cart.id)
        )).scalar_one_or_none()
        if item is None:
            raise LookupError("Cart item not found")

        if quantity <= 0:
            await self.db.delete(item)
        else:
            item.quantity = int(quantity)

        await self.db.commit()
        await self.db.refresh(cart, attribute_names=["items"])
        return await self._serialize(cart)

    async def remove_item(self, user_id: int, item_id: int) -> dict:
        return await self.update_quantity(user_id, item_id, 0)

    async def clear(self, user_id: int) -> dict:
        cart = await self.get_or_create(user_id)
        for item in list(cart.items):
            await self.db.delete(item)
        await self.db.commit()
        await self.db.refresh(cart, attribute_names=["items"])
        return await self._serialize(cart)
