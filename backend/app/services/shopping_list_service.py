"""
Shopping list service — CRUD + resolve-and-send-to-cart.

`send_to_cart` is the bridge between a list and the universal cart. For
every un-completed item it either:
  * uses the linked product_id directly at the cheapest current merchant, or
  * searches the catalog for the free-text note, picking the best match

Resolved items are added to the cart; anything unresolvable is reported
in `items_skipped` so the caller (UI or AI) can tell the user what to do.
"""
from typing import Optional

import structlog
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.merchant import Merchant
from app.db.models.product import Product
from app.db.models.shopping_list import ShoppingList, ShoppingListItem
from app.services.cart_service import CartService
from app.services.catalog_service import CatalogService

logger = structlog.get_logger(__name__)


class ShoppingListService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.catalog = CatalogService(db)

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------
    async def list_for_user(
        self, user_id: int, *, include_archived: bool = False, kind: Optional[str] = None,
    ) -> list[dict]:
        stmt = select(ShoppingList).where(ShoppingList.user_id == user_id)
        if not include_archived:
            stmt = stmt.where(ShoppingList.is_archived.is_(False))
        if kind:
            stmt = stmt.where(ShoppingList.kind == kind)
        stmt = stmt.order_by(desc(ShoppingList.updated_at))

        lists = (await self.db.execute(stmt)).scalars().all()
        return [await self._serialize(lst) for lst in lists]

    async def get(self, user_id: int, list_id: int) -> Optional[ShoppingList]:
        stmt = select(ShoppingList).where(
            ShoppingList.id == list_id, ShoppingList.user_id == user_id,
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def get_serialized(self, user_id: int, list_id: int) -> Optional[dict]:
        lst = await self.get(user_id, list_id)
        if lst is None:
            return None
        return await self._serialize(lst)

    async def create(
        self, user_id: int, title: str, *,
        kind: str = "shopping", items: Optional[list[dict]] = None,
    ) -> dict:
        lst = ShoppingList(
            user_id=user_id,
            title=(title or "My shopping list").strip()[:200] or "My shopping list",
            kind=kind if kind in ("shopping", "wishlist") else "shopping",
        )
        self.db.add(lst)
        await self.db.flush()

        if items:
            for i, it in enumerate(items):
                self.db.add(ShoppingListItem(
                    list_id=lst.id,
                    note=(it.get("note") or None),
                    product_id=it.get("product_id"),
                    quantity=max(1, int(it.get("quantity", 1))),
                    sort_order=i,
                ))

        await self.db.commit()
        await self.db.refresh(lst)
        return await self._serialize(lst)

    async def update(
        self, user_id: int, list_id: int,
        *, title: Optional[str] = None, kind: Optional[str] = None,
        is_archived: Optional[bool] = None,
    ) -> Optional[dict]:
        lst = await self.get(user_id, list_id)
        if lst is None:
            return None
        if title is not None:
            lst.title = title.strip()[:200] or lst.title
        if kind in ("shopping", "wishlist"):
            lst.kind = kind
        if is_archived is not None:
            lst.is_archived = is_archived
        await self.db.commit()
        await self.db.refresh(lst)
        return await self._serialize(lst)

    async def delete(self, user_id: int, list_id: int) -> bool:
        lst = await self.get(user_id, list_id)
        if lst is None:
            return False
        await self.db.delete(lst)
        await self.db.commit()
        return True

    async def add_item(
        self, user_id: int, list_id: int,
        *, note: Optional[str] = None, product_id: Optional[int] = None,
        quantity: int = 1,
    ) -> dict:
        lst = await self.get(user_id, list_id)
        if lst is None:
            raise LookupError("List not found")

        max_sort = max((i.sort_order for i in lst.items), default=-1)
        item = ShoppingListItem(
            list_id=list_id,
            note=(note or None),
            product_id=product_id,
            quantity=max(1, int(quantity)),
            sort_order=max_sort + 1,
        )
        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(lst)
        return await self._serialize(lst)

    async def update_item(
        self, user_id: int, list_id: int, item_id: int, **fields,
    ) -> dict:
        lst = await self.get(user_id, list_id)
        if lst is None:
            raise LookupError("List not found")
        item = next((i for i in lst.items if i.id == item_id), None)
        if item is None:
            raise LookupError("Item not found")
        for k, v in fields.items():
            if v is None: continue
            if k in ("note", "product_id", "quantity", "completed", "sort_order"):
                setattr(item, k, v)
        await self.db.commit()
        await self.db.refresh(lst)
        return await self._serialize(lst)

    async def remove_item(self, user_id: int, list_id: int, item_id: int) -> dict:
        lst = await self.get(user_id, list_id)
        if lst is None:
            raise LookupError("List not found")
        item = next((i for i in lst.items if i.id == item_id), None)
        if item is None:
            raise LookupError("Item not found")
        await self.db.delete(item)
        await self.db.commit()
        await self.db.refresh(lst)
        return await self._serialize(lst)

    # ------------------------------------------------------------------
    # Send-to-cart
    # ------------------------------------------------------------------
    async def send_to_cart(self, user_id: int, list_id: int) -> dict:
        """Resolve every un-completed item to (product, merchant) and add
        to the user's cart. Returns a summary for the caller to report."""
        lst = await self.get(user_id, list_id)
        if lst is None:
            raise LookupError("List not found")

        cart_service = CartService(self.db)
        added: list[dict] = []
        skipped: list[dict] = []

        for item in lst.items:
            if item.completed:
                continue

            product_id: Optional[int] = item.product_id
            merchant_id: Optional[int] = None
            merchant_name: Optional[str] = None
            resolved_from: Optional[str] = None

            # 1) Catalog search for free-text notes when we have no product_id
            if product_id is None and item.note:
                try:
                    matches = await self.catalog.search(item.note, limit=1)
                except Exception as e:
                    skipped.append({"item_id": item.id, "note": item.note,
                                    "reason": f"search failed: {e}"})
                    continue
                if matches:
                    product_id = matches[0]["product"]["id"]
                    merchant_id = matches[0]["offers"][0]["merchant_id"]
                    merchant_name = matches[0]["offers"][0]["merchant"]
                    resolved_from = item.note

            # 2) If we only had a product_id, pick the cheapest current merchant
            if product_id is not None and merchant_id is None:
                latest = await self.catalog.latest_price_for_product(product_id)
                if latest is not None:
                    merchant_id = latest[1].id
                    merchant_name = latest[1].name

            if product_id is None or merchant_id is None:
                skipped.append({
                    "item_id": item.id,
                    "note": item.note,
                    "product_id": item.product_id,
                    "reason": "No matching product or merchant found",
                })
                continue

            try:
                await cart_service.add_item(user_id, product_id, merchant_id, item.quantity)
                added.append({
                    "item_id": item.id,
                    "product_id": product_id,
                    "merchant_id": merchant_id,
                    "merchant": merchant_name,
                    "quantity": item.quantity,
                    "resolved_from": resolved_from,
                })
            except Exception as e:
                skipped.append({"item_id": item.id, "reason": str(e)})

        return {
            "list_id": list_id,
            "list_title": lst.title,
            "added_count": len(added),
            "skipped_count": len(skipped),
            "items_added": added,
            "items_skipped": skipped,
        }

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------
    async def _serialize(self, lst: ShoppingList) -> dict:
        # Attach product display info for linked items.
        product_ids = [i.product_id for i in lst.items if i.product_id]
        products: dict[int, Product] = {}
        if product_ids:
            result = await self.db.execute(
                select(Product).where(Product.id.in_(product_ids))
            )
            products = {p.id: p for p in result.scalars().all()}

        items = []
        for it in sorted(lst.items, key=lambda x: x.sort_order):
            product = products.get(it.product_id) if it.product_id else None
            best_price = best_merchant = None
            if product is not None:
                try:
                    latest = await self.catalog.latest_price_for_product(product.id)
                    if latest is not None:
                        best_price = latest[0].price
                        best_merchant = latest[1].name
                except Exception:
                    pass
            items.append({
                "id": it.id,
                "list_id": it.list_id,
                "product_id": it.product_id,
                "product_name": product.display_name if product else None,
                "product_image_url": product.image_url if product else None,
                "current_best_price": best_price,
                "current_best_merchant": best_merchant,
                "note": it.note,
                "quantity": it.quantity,
                "completed": it.completed,
                "sort_order": it.sort_order,
            })

        return {
            "id": lst.id,
            "title": lst.title,
            "kind": lst.kind,
            "is_archived": lst.is_archived,
            "item_count": len(items),
            "items": items,
            "created_at": lst.created_at,
            "updated_at": lst.updated_at,
        }
