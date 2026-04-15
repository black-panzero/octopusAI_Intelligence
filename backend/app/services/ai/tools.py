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


EXECUTORS = {
    "search_products": _tool_search_products,
    "compare_products": _tool_compare_products,
    "add_to_cart": _tool_add_to_cart,
    "view_cart": _tool_view_cart,
    "create_price_rule": _tool_create_price_rule,
    "list_rules": _tool_list_rules,
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
