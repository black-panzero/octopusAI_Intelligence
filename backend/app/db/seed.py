"""
Database seeder — populates merchants, products and an initial price
snapshot per (product, merchant) pair on first boot. Replaces the
in-memory mock adapters so the /products/search endpoint queries real
rows from the database.
"""
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.merchant import Merchant
from app.db.models.price_snapshot import PriceSnapshot
from app.db.models.product import Product

logger = structlog.get_logger(__name__)


MERCHANTS: list[dict] = [
    {"slug": "naivas",     "name": "Naivas",     "base_url": "https://naivas.online"},
    {"slug": "carrefour",  "name": "Carrefour",  "base_url": "https://www.carrefour.ke"},
    {"slug": "quickmart",  "name": "Quickmart",  "base_url": "https://quickmart.co.ke"},
    {"slug": "chandarana", "name": "Chandarana", "base_url": "https://chandaranafoodplus.com"},
]


# display_name, brand, category, [(merchant_slug, price_kes)]
PRODUCTS: list[dict] = [
    {"name": "Pishori Rice 5kg", "brand": "Mwea", "category": "Groceries",
     "offers": [("carrefour", 899), ("naivas", 950), ("quickmart", 975), ("chandarana", 980)]},
    {"name": "Basmati Rice 2kg", "brand": "Daawat", "category": "Groceries",
     "offers": [("carrefour", 540), ("naivas", 560), ("quickmart", 570)]},
    {"name": "Maize Flour 2kg", "brand": "Jogoo", "category": "Groceries",
     "offers": [("naivas", 195), ("carrefour", 189), ("quickmart", 199), ("chandarana", 205)]},
    {"name": "Wheat Flour 2kg", "brand": "Pembe", "category": "Groceries",
     "offers": [("naivas", 210), ("carrefour", 205), ("quickmart", 215)]},
    {"name": "Cooking Oil 1L", "brand": "Fresh Fri", "category": "Groceries",
     "offers": [("carrefour", 299), ("quickmart", 315), ("naivas", 320), ("chandarana", 329)]},
    {"name": "Cooking Oil 3L", "brand": "Rina", "category": "Groceries",
     "offers": [("carrefour", 890), ("naivas", 920), ("quickmart", 905)]},
    {"name": "Brown Sugar 2kg", "brand": "Kabras", "category": "Groceries",
     "offers": [("naivas", 340), ("quickmart", 335), ("carrefour", 349)]},
    {"name": "Table Salt 1kg", "brand": "Kensalt", "category": "Groceries",
     "offers": [("naivas", 45), ("carrefour", 42), ("quickmart", 44), ("chandarana", 48)]},
    {"name": "Kenya Tea 500g", "brand": "Kericho Gold", "category": "Groceries",
     "offers": [("naivas", 420), ("carrefour", 409), ("quickmart", 415)]},
    {"name": "Instant Coffee 100g", "brand": "Dormans", "category": "Groceries",
     "offers": [("carrefour", 650), ("naivas", 670), ("chandarana", 690)]},
    {"name": "Blue Band Margarine 500g", "brand": "Blue Band", "category": "Groceries",
     "offers": [("carrefour", 350), ("naivas", 360), ("quickmart", 355)]},
    {"name": "Brookside Milk 500ml", "brand": "Brookside", "category": "Groceries",
     "offers": [("quickmart", 62), ("naivas", 65), ("carrefour", 68), ("chandarana", 70)]},
    {"name": "Coca-Cola 2L", "brand": "Coca-Cola", "category": "Food & Beverages",
     "offers": [("naivas", 220), ("carrefour", 240), ("quickmart", 225)]},
    {"name": "White Bread 400g", "brand": "Festive", "category": "Food & Beverages",
     "offers": [("naivas", 65), ("carrefour", 60), ("quickmart", 62)]},
    {"name": "Eggs Tray (30)", "brand": "Kenchic", "category": "Food & Beverages",
     "offers": [("naivas", 560), ("carrefour", 549), ("quickmart", 555), ("chandarana", 579)]},
    {"name": "Colgate Toothpaste 140g", "brand": "Colgate", "category": "Health & Beauty",
     "offers": [("quickmart", 260), ("naivas", 280), ("carrefour", 275)]},
    {"name": "Geisha Soap Bar 250g", "brand": "Geisha", "category": "Health & Beauty",
     "offers": [("naivas", 140), ("carrefour", 135), ("quickmart", 139)]},
    {"name": "Nivea Body Lotion 400ml", "brand": "Nivea", "category": "Health & Beauty",
     "offers": [("carrefour", 720), ("naivas", 749), ("quickmart", 735)]},
    {"name": "Omo Detergent 1kg", "brand": "Omo", "category": "Household",
     "offers": [("quickmart", 475), ("naivas", 490), ("carrefour", 469)]},
    {"name": "Tissue Paper 10pk", "brand": "Rosy", "category": "Household",
     "offers": [("quickmart", 430), ("carrefour", 450), ("naivas", 455)]},
    {"name": "Dettol Disinfectant 250ml", "brand": "Dettol", "category": "Household",
     "offers": [("carrefour", 320), ("naivas", 335), ("quickmart", 329)]},
    {"name": "Samsung Galaxy A15", "brand": "Samsung", "category": "Electronics",
     "offers": [("carrefour", 22500), ("naivas", 23500)]},
    {"name": "Bluetooth Earbuds", "brand": "Oraimo", "category": "Electronics",
     "offers": [("carrefour", 1750), ("quickmart", 1850)]},
    {"name": "Electric Kettle 1.7L", "brand": "Ramtons", "category": "Electronics",
     "offers": [("carrefour", 2899), ("naivas", 2950), ("quickmart", 2899)]},
]


async def seed_if_empty(db: AsyncSession) -> None:
    """
    Idempotently ensure the catalog is populated.

    Runs on every boot but only inserts rows that are missing, so it is
    safe to re-run without breaking existing data. This also upgrades
    databases that were populated earlier by the now-removed mock
    adapters (they only wrote a handful of merchants/products).
    """
    # 1. Merchants — upsert by slug
    existing_merchants = (await db.execute(select(Merchant))).scalars().all()
    merchants_by_slug: dict[str, Merchant] = {m.slug: m for m in existing_merchants}
    new_merchant_count = 0
    for m in MERCHANTS:
        if m["slug"] in merchants_by_slug:
            continue
        obj = Merchant(slug=m["slug"], name=m["name"], base_url=m["base_url"], is_active=True)
        db.add(obj)
        merchants_by_slug[m["slug"]] = obj
        new_merchant_count += 1
    if new_merchant_count:
        await db.flush()

    # 2. Products + initial snapshots — upsert by canonical_name
    existing_canonicals = {
        row[0] for row in (
            await db.execute(select(Product.canonical_name))
        ).all()
    }

    new_product_count = 0
    for p in PRODUCTS:
        canonical = " ".join(p["name"].lower().split())
        if canonical in existing_canonicals:
            continue

        product = Product(
            canonical_name=canonical,
            display_name=p["name"],
            brand=p.get("brand"),
            category=p.get("category"),
        )
        db.add(product)
        await db.flush()
        new_product_count += 1

        for slug, price in p["offers"]:
            merchant = merchants_by_slug.get(slug)
            if merchant is None:
                continue
            db.add(
                PriceSnapshot(
                    product_id=product.id,
                    merchant_id=merchant.id,
                    price=float(price),
                    currency="KES",
                    url=f"{merchant.base_url}/search?q={product.display_name}",
                    is_available=True,
                )
            )

    await db.commit()

    if new_merchant_count or new_product_count:
        logger.info(
            "Seed applied",
            new_merchants=new_merchant_count,
            new_products=new_product_count,
        )
    else:
        logger.debug("Seed skipped — catalog already complete")
