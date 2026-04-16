"""
Price rule service — combined price tracking + automation engine.

Each rule belongs to a user for a product. `evaluate()` finds the
cheapest current price and flags rules where the price has crossed
the target. For `add_to_cart` rules the triggered item is auto-added.
"""
from datetime import datetime, timezone
from typing import Optional

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.price_rule import PriceRule
from app.db.models.product import Product
from app.services.catalog_service import CatalogService
from app.services.cart_service import CartService

logger = structlog.get_logger(__name__)

VALID_ACTIONS = {"alert", "add_to_cart"}


class RulesService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.catalog = CatalogService(db)

    async def list_for_user(self, user_id: int) -> list[dict]:
        stmt = (
            select(PriceRule, Product)
            .join(Product, PriceRule.product_id == Product.id)
            .where(PriceRule.user_id == user_id)
            .order_by(PriceRule.created_at.desc())
        )
        rows = (await self.db.execute(stmt)).all()

        out: list[dict] = []
        for rule, product in rows:
            current = await self.catalog.latest_price_for_product(product.id)
            current_price = current[0].price if current else None
            current_merchant = current[1].name if current else None
            triggered = (
                rule.is_active
                and rule.target_price is not None
                and current_price is not None
                and current_price <= rule.target_price
            )
            out.append({
                "id": rule.id,
                "product_id": product.id,
                "product_name": product.display_name,
                "brand": product.brand,
                "category": product.category,
                "action": rule.action,
                "target_price": rule.target_price,
                "is_active": rule.is_active,
                "current_price": current_price,
                "current_merchant": current_merchant,
                "triggered": triggered,
                "last_triggered_at": rule.last_triggered_at,
                "created_at": rule.created_at,
            })
        return out

    async def create(
        self, user_id: int, product_id: int,
        action: str = "alert", target_price: Optional[float] = None,
    ) -> PriceRule:
        if action not in VALID_ACTIONS:
            raise ValueError(f"action must be one of {sorted(VALID_ACTIONS)}")

        # Enforce at most one active rule per (user, product) — editing replaces.
        existing = (await self.db.execute(
            select(PriceRule).where(
                PriceRule.user_id == user_id,
                PriceRule.product_id == product_id,
            )
        )).scalar_one_or_none()
        if existing is not None:
            existing.action = action
            existing.target_price = target_price
            existing.is_active = True
            await self.db.commit()
            await self.db.refresh(existing)
            return existing

        rule = PriceRule(
            user_id=user_id, product_id=product_id,
            action=action, target_price=target_price, is_active=True,
        )
        self.db.add(rule)
        await self.db.commit()
        await self.db.refresh(rule)
        return rule

    async def delete(self, user_id: int, rule_id: int) -> bool:
        rule = (await self.db.execute(
            select(PriceRule).where(PriceRule.id == rule_id, PriceRule.user_id == user_id)
        )).scalar_one_or_none()
        if rule is None:
            return False
        await self.db.delete(rule)
        await self.db.commit()
        return True

    async def evaluate_all(self, user_id: int) -> list[dict]:
        """
        Re-check every active rule for the user. For add_to_cart rules that
        trip, the item is auto-added at the cheapest merchant. Returns the
        list of triggered rules with the action taken.
        """
        triggered: list[dict] = []
        rules = (await self.db.execute(
            select(PriceRule).where(
                PriceRule.user_id == user_id, PriceRule.is_active.is_(True),
            )
        )).scalars().all()

        cart = CartService(self.db)

        for rule in rules:
            if rule.target_price is None:
                continue
            current = await self.catalog.latest_price_for_product(rule.product_id)
            if current is None:
                continue
            snapshot, merchant = current
            if snapshot.price > rule.target_price:
                continue

            rule.last_triggered_at = datetime.now(timezone.utc)
            action_taken = rule.action
            if rule.action == "add_to_cart":
                try:
                    await cart.add_item(user_id, rule.product_id, merchant.id, quantity=1)
                except Exception as e:
                    logger.warning("Auto-add-to-cart failed", error=str(e), rule_id=rule.id)
                    action_taken = "alert"

            triggered.append({
                "rule_id": rule.id,
                "product_id": rule.product_id,
                "merchant": merchant.name,
                "merchant_slug": merchant.slug,
                "current_price": snapshot.price,
                "target_price": rule.target_price,
                "action_taken": action_taken,
            })

        await self.db.commit()
        return triggered
