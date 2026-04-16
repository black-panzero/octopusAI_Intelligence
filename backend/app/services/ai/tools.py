"""
Tool registry for the SmartBuy chat assistant.

Tools are JSON-schema function definitions given to the LLM, plus async
executors that actually run against the database. Each tool receives the
invoking user so cart / rules mutations are scoped correctly.
"""
import json
from typing import Any

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import User
from app.services.cart_service import CartService
from app.services.catalog_service import CatalogService
from app.services.rules_service import RulesService
from app.services.scraping_service import ScrapingService
from app.services.shopping_list_service import ShoppingListService

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Tool JSON schemas — given to the LLM
# ---------------------------------------------------------------------------
TOOL_SCHEMAS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "search_products",
            "description": (
                "Search the SmartBuy Kenyan product catalog by name, brand or "
                "category. Returns grouped results with cross-merchant offers "
                "(price in KES), ratings and specs. Use this for every "
                "product question before answering."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search text (e.g. 'rice', 'Samsung A15')",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max number of products to return",
                        "default": 8,
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "compare_products",
            "description": (
                "Fetch multiple products by id and return a side-by-side "
                "comparison object containing price, size, rating, reviews, "
                "brand, category and category-specific specs. Use this after "
                "the user asks to compare specific products."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "product_ids": {
                        "type": "array",
                        "items": {"type": "integer"},
                        "description": "Product ids returned from search_products",
                        "minItems": 2,
                        "maxItems": 4,
                    }
                },
                "required": ["product_ids"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_to_cart",
            "description": (
                "Add a product to the authenticated user's universal cart at a "
                "specific merchant. Use merchant_id and product_id exactly as "
                "returned by search_products."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "integer"},
                    "merchant_id": {"type": "integer"},
                    "quantity": {"type": "integer", "default": 1, "minimum": 1},
                },
                "required": ["product_id", "merchant_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "view_cart",
            "description": "Return the authenticated user's current cart with totals.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_price_rule",
            "description": (
                "Create (or replace) a tracking rule. action='alert' surfaces "
                "a triggered flag when the current price drops at or below "
                "target_price; action='add_to_cart' auto-adds at the cheapest "
                "merchant when the target is hit. target_price is in KES."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "integer"},
                    "action": {
                        "type": "string",
                        "enum": ["alert", "add_to_cart"],
                        "default": "alert",
                    },
                    "target_price": {"type": "number"},
                },
                "required": ["product_id", "target_price"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_rules",
            "description": "List the user's tracking + automation rules with current prices.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "refresh_live_prices",
            "description": (
                "Fetch fresh prices from live merchant websites (Naivas, "
                "Carrefour, Quickmart, Jumia Kenya) for a query and persist "
                "the results into the catalog. Use this when the user wants "
                "the most up-to-date prices rather than whatever is cached."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                },
                "required": ["query"],
            },
        },
    },
    # --- Cart CRUD (beyond add_to_cart) -----------------------------------
    {
        "type": "function",
        "function": {
            "name": "remove_cart_item",
            "description": "Remove a single item from the user's cart by its cart item id.",
            "parameters": {
                "type": "object",
                "properties": {"item_id": {"type": "integer"}},
                "required": ["item_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_cart_quantity",
            "description": (
                "Set the quantity for a cart item. Setting it to 0 removes "
                "the item."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "item_id": {"type": "integer"},
                    "quantity": {"type": "integer", "minimum": 0},
                },
                "required": ["item_id", "quantity"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "clear_cart",
            "description": "Empty the user's cart entirely. Ask for confirmation before calling.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    # --- Shopping lists ----------------------------------------------------
    {
        "type": "function",
        "function": {
            "name": "list_shopping_lists",
            "description": (
                "Return the user's saved shopping lists and wishlists with their items. "
                "kind filters to 'shopping' or 'wishlist' when provided."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "kind": {"type": "string", "enum": ["shopping", "wishlist"]},
                    "include_archived": {"type": "boolean", "default": False},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_shopping_list",
            "description": "Fetch a single shopping list with its items and current best prices.",
            "parameters": {
                "type": "object",
                "properties": {"list_id": {"type": "integer"}},
                "required": ["list_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_shopping_list",
            "description": (
                "Create a new shopping list or wishlist. Each item can be a "
                "free-text note (e.g. '2kg rice') or a catalog product_id. "
                "After creation, call send_shopping_list_to_cart(list_id) if "
                "the user wants to move everything to the cart."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "kind": {"type": "string", "enum": ["shopping", "wishlist"], "default": "shopping"},
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "note": {"type": "string"},
                                "product_id": {"type": "integer"},
                                "quantity": {"type": "integer", "minimum": 1, "default": 1},
                            },
                        },
                    },
                },
                "required": ["title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_shopping_list",
            "description": "Rename, change kind, or archive a shopping list.",
            "parameters": {
                "type": "object",
                "properties": {
                    "list_id": {"type": "integer"},
                    "title": {"type": "string"},
                    "kind": {"type": "string", "enum": ["shopping", "wishlist"]},
                    "is_archived": {"type": "boolean"},
                },
                "required": ["list_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_shopping_list",
            "description": "Delete a shopping list and its items permanently.",
            "parameters": {
                "type": "object",
                "properties": {"list_id": {"type": "integer"}},
                "required": ["list_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_shopping_list_item",
            "description": (
                "Append an item to a list. Provide either a note (free text) "
                "or a product_id from search_products."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "list_id": {"type": "integer"},
                    "note": {"type": "string"},
                    "product_id": {"type": "integer"},
                    "quantity": {"type": "integer", "minimum": 1, "default": 1},
                },
                "required": ["list_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_shopping_list_item",
            "description": (
                "Update an existing list item — toggle completed, change "
                "quantity, replace note, or attach a product_id."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "list_id": {"type": "integer"},
                    "item_id": {"type": "integer"},
                    "note": {"type": "string"},
                    "product_id": {"type": "integer"},
                    "quantity": {"type": "integer", "minimum": 1},
                    "completed": {"type": "boolean"},
                },
                "required": ["list_id", "item_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "remove_shopping_list_item",
            "description": "Remove a single item from a shopping list.",
            "parameters": {
                "type": "object",
                "properties": {
                    "list_id": {"type": "integer"},
                    "item_id": {"type": "integer"},
                },
                "required": ["list_id", "item_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_shopping_list_to_cart",
            "description": (
                "Resolve each un-completed item on a shopping list to the "
                "cheapest catalog product + merchant, and add everything to "
                "the user's universal cart. The user reviews and checks out "
                "from the cart."
            ),
            "parameters": {
                "type": "object",
                "properties": {"list_id": {"type": "integer"}},
                "required": ["list_id"],
            },
        },
    },
]


# ---------------------------------------------------------------------------
# Executors
# ---------------------------------------------------------------------------
def _jsonable(obj: Any) -> Any:
    """Convert ORM / datetime / set objects to plain JSON-safe values."""
    return json.loads(json.dumps(obj, default=str))


async def _tool_search_products(args: dict, db: AsyncSession, user: User) -> dict:
    query = str(args.get("query", "")).strip()
    limit = int(args.get("limit", 8))
    catalog = CatalogService(db)
    results = await catalog.search(query, limit=limit)
    # Trim offers to keep the response small for the model.
    trimmed = []
    for r in results:
        trimmed.append({
            "product": r["product"],
            "min_price": r["min_price"],
            "max_price": r["max_price"],
            "best_merchant": r["best_merchant"],
            "savings_pct": r["savings_pct"],
            "offer_count": r["offer_count"],
            "offers": [
                {
                    "merchant": o["merchant"],
                    "merchant_id": o["merchant_id"],
                    "price": o["price"],
                    "url": o.get("url"),
                }
                for o in r["offers"]
            ],
        })
    return {"query": query, "count": len(trimmed), "results": _jsonable(trimmed)}


async def _tool_compare_products(args: dict, db: AsyncSession, user: User) -> dict:
    ids = list(args.get("product_ids", []))
    if len(ids) < 2:
        return {"error": "Provide at least 2 product_ids"}
    catalog = CatalogService(db)
    # Reuse search by id — run a search for each id's canonical_name is too
    # fuzzy, so hit the catalog directly via a targeted query per id.
    # Simpler approach: pull them via a broad search and filter in-memory.
    from sqlalchemy import select
    from app.db.models.product import Product

    products = {
        p.id: p for p in (
            await db.execute(select(Product).where(Product.id.in_(ids)))
        ).scalars().all()
    }
    rows: list[dict] = []
    for pid in ids:
        product = products.get(pid)
        if product is None:
            continue
        # Run a search for the product name to pull offers.
        search = await catalog.search(product.display_name, limit=1)
        if search:
            rows.append(search[0])
    return {"comparison": _jsonable(rows)}


async def _tool_add_to_cart(args: dict, db: AsyncSession, user: User) -> dict:
    service = CartService(db)
    try:
        cart = await service.add_item(
            user.id,
            product_id=int(args["product_id"]),
            merchant_id=int(args["merchant_id"]),
            quantity=int(args.get("quantity", 1)),
        )
    except ValueError as e:
        return {"error": str(e)}
    return _jsonable({"added": True, "cart": cart})


async def _tool_view_cart(args: dict, db: AsyncSession, user: User) -> dict:
    service = CartService(db)
    return _jsonable(await service.view(user.id))


async def _tool_create_price_rule(args: dict, db: AsyncSession, user: User) -> dict:
    service = RulesService(db)
    try:
        rule = await service.create(
            user_id=user.id,
            product_id=int(args["product_id"]),
            action=str(args.get("action", "alert")),
            target_price=float(args["target_price"]) if args.get("target_price") is not None else None,
        )
    except ValueError as e:
        return {"error": str(e)}
    return {"created": True, "rule_id": rule.id, "target_price": rule.target_price, "action": rule.action}


async def _tool_list_rules(args: dict, db: AsyncSession, user: User) -> dict:
    service = RulesService(db)
    return {"rules": _jsonable(await service.list_for_user(user.id))}


async def _tool_refresh_live_prices(args: dict, db: AsyncSession, user: User) -> dict:
    service = ScrapingService(db)
    return _jsonable(await service.refresh_for_query(str(args.get("query", ""))))


# ---------- Cart CRUD --------------------------------------------------------

async def _tool_remove_cart_item(args: dict, db: AsyncSession, user: User) -> dict:
    service = CartService(db)
    try:
        cart = await service.remove_item(user.id, int(args["item_id"]))
    except LookupError as e:
        return {"error": str(e)}
    return _jsonable({"removed": True, "cart": cart})


async def _tool_update_cart_quantity(args: dict, db: AsyncSession, user: User) -> dict:
    service = CartService(db)
    try:
        cart = await service.update_quantity(
            user.id, int(args["item_id"]), int(args["quantity"]),
        )
    except LookupError as e:
        return {"error": str(e)}
    return _jsonable({"updated": True, "cart": cart})


async def _tool_clear_cart(args: dict, db: AsyncSession, user: User) -> dict:
    service = CartService(db)
    cart = await service.clear(user.id)
    return _jsonable({"cleared": True, "cart": cart})


# ---------- Shopping lists ---------------------------------------------------

async def _tool_list_shopping_lists(args: dict, db: AsyncSession, user: User) -> dict:
    service = ShoppingListService(db)
    return _jsonable({
        "lists": await service.list_for_user(
            user.id,
            include_archived=bool(args.get("include_archived", False)),
            kind=args.get("kind"),
        )
    })


async def _tool_get_shopping_list(args: dict, db: AsyncSession, user: User) -> dict:
    service = ShoppingListService(db)
    data = await service.get_serialized(user.id, int(args["list_id"]))
    if data is None:
        return {"error": "List not found"}
    return _jsonable({"list": data})


async def _tool_create_shopping_list(args: dict, db: AsyncSession, user: User) -> dict:
    service = ShoppingListService(db)
    data = await service.create(
        user.id,
        title=str(args.get("title", "New list")),
        kind=str(args.get("kind", "shopping")),
        items=[dict(i) for i in (args.get("items") or [])],
    )
    return _jsonable({"created": True, "list": data})


async def _tool_update_shopping_list(args: dict, db: AsyncSession, user: User) -> dict:
    service = ShoppingListService(db)
    data = await service.update(
        user.id, int(args["list_id"]),
        title=args.get("title"),
        kind=args.get("kind"),
        is_archived=args.get("is_archived"),
    )
    if data is None:
        return {"error": "List not found"}
    return _jsonable({"updated": True, "list": data})


async def _tool_delete_shopping_list(args: dict, db: AsyncSession, user: User) -> dict:
    service = ShoppingListService(db)
    ok = await service.delete(user.id, int(args["list_id"]))
    if not ok:
        return {"error": "List not found"}
    return {"deleted": True, "list_id": int(args["list_id"])}


async def _tool_add_shopping_list_item(args: dict, db: AsyncSession, user: User) -> dict:
    service = ShoppingListService(db)
    try:
        data = await service.add_item(
            user.id, int(args["list_id"]),
            note=args.get("note"),
            product_id=args.get("product_id"),
            quantity=int(args.get("quantity", 1)),
        )
    except LookupError as e:
        return {"error": str(e)}
    return _jsonable({"added": True, "list": data})


async def _tool_update_shopping_list_item(args: dict, db: AsyncSession, user: User) -> dict:
    service = ShoppingListService(db)
    try:
        data = await service.update_item(
            user.id, int(args["list_id"]), int(args["item_id"]),
            note=args.get("note"),
            product_id=args.get("product_id"),
            quantity=args.get("quantity"),
            completed=args.get("completed"),
        )
    except LookupError as e:
        return {"error": str(e)}
    return _jsonable({"updated": True, "list": data})


async def _tool_remove_shopping_list_item(args: dict, db: AsyncSession, user: User) -> dict:
    service = ShoppingListService(db)
    try:
        data = await service.remove_item(
            user.id, int(args["list_id"]), int(args["item_id"]),
        )
    except LookupError as e:
        return {"error": str(e)}
    return _jsonable({"removed": True, "list": data})


async def _tool_send_shopping_list_to_cart(args: dict, db: AsyncSession, user: User) -> dict:
    service = ShoppingListService(db)
    try:
        return _jsonable(await service.send_to_cart(user.id, int(args["list_id"])))
    except LookupError as e:
        return {"error": str(e)}


EXECUTORS = {
    "search_products": _tool_search_products,
    "compare_products": _tool_compare_products,
    "add_to_cart": _tool_add_to_cart,
    "view_cart": _tool_view_cart,
    "create_price_rule": _tool_create_price_rule,
    "list_rules": _tool_list_rules,
    "refresh_live_prices": _tool_refresh_live_prices,
    "remove_cart_item": _tool_remove_cart_item,
    "update_cart_quantity": _tool_update_cart_quantity,
    "clear_cart": _tool_clear_cart,
    "list_shopping_lists": _tool_list_shopping_lists,
    "get_shopping_list": _tool_get_shopping_list,
    "create_shopping_list": _tool_create_shopping_list,
    "update_shopping_list": _tool_update_shopping_list,
    "delete_shopping_list": _tool_delete_shopping_list,
    "add_shopping_list_item": _tool_add_shopping_list_item,
    "update_shopping_list_item": _tool_update_shopping_list_item,
    "remove_shopping_list_item": _tool_remove_shopping_list_item,
    "send_shopping_list_to_cart": _tool_send_shopping_list_to_cart,
}


async def execute_tool(name: str, args: dict, db: AsyncSession, user: User) -> dict:
    fn = EXECUTORS.get(name)
    if fn is None:
        return {"error": f"Unknown tool: {name}"}
    try:
        return await fn(args or {}, db, user)
    except Exception as e:
        logger.warning("Tool execution failed", tool=name, error=str(e))
        return {"error": f"{name} failed: {e}"}
