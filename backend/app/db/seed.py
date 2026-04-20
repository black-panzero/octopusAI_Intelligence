"""
Database seeder — idempotent Kenyan catalog.

Populates merchants, products (with comparison attributes) and an initial
PriceSnapshot per (product, merchant). Safe to re-run; inserts only what's
missing. Replaces the in-memory mock adapters — `/products/search` now
reads real rows from the database.
"""
import structlog
from sqlalchemy import select, update
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


# Kenyan catalog with comparison attributes. `specs` is category-specific.
PRODUCTS: list[dict] = [
    {"name": "Pishori Rice 5kg", "brand": "Mwea", "category": "Groceries",
     "size": "5kg", "rating": 4.6, "review_count": 842,
     "specs": {"origin": "Mwea, Kenya", "grain": "Aromatic long"},
     "offers": [("carrefour", 899), ("naivas", 950), ("quickmart", 975), ("chandarana", 980)]},
    {"name": "Basmati Rice 2kg", "brand": "Daawat", "category": "Groceries",
     "size": "2kg", "rating": 4.4, "review_count": 312,
     "specs": {"origin": "India", "grain": "Long basmati"},
     "offers": [("carrefour", 540), ("naivas", 560), ("quickmart", 570)]},
    {"name": "Maize Flour 2kg", "brand": "Jogoo", "category": "Groceries",
     "size": "2kg", "rating": 4.5, "review_count": 1290,
     "specs": {"fortified": True, "type": "Sifted"},
     "offers": [("naivas", 195), ("carrefour", 189), ("quickmart", 199), ("chandarana", 205)]},
    {"name": "Wheat Flour 2kg", "brand": "Pembe", "category": "Groceries",
     "size": "2kg", "rating": 4.3, "review_count": 560,
     "specs": {"type": "All-purpose"},
     "offers": [("naivas", 210), ("carrefour", 205), ("quickmart", 215)]},
    {"name": "Cooking Oil 1L", "brand": "Fresh Fri", "category": "Groceries",
     "size": "1L", "rating": 4.5, "review_count": 720,
     "specs": {"type": "Vegetable", "cholesterol_free": True},
     "offers": [("carrefour", 299), ("quickmart", 315), ("naivas", 320), ("chandarana", 329)]},
    {"name": "Cooking Oil 3L", "brand": "Rina", "category": "Groceries",
     "size": "3L", "rating": 4.4, "review_count": 430,
     "specs": {"type": "Vegetable"},
     "offers": [("carrefour", 890), ("naivas", 920), ("quickmart", 905)]},
    {"name": "Brown Sugar 2kg", "brand": "Kabras", "category": "Groceries",
     "size": "2kg", "rating": 4.5, "review_count": 610,
     "specs": {"type": "Brown"},
     "offers": [("naivas", 340), ("quickmart", 335), ("carrefour", 349)]},
    {"name": "Table Salt 1kg", "brand": "Kensalt", "category": "Groceries",
     "size": "1kg", "rating": 4.7, "review_count": 2010,
     "specs": {"iodized": True},
     "offers": [("naivas", 45), ("carrefour", 42), ("quickmart", 44), ("chandarana", 48)]},
    {"name": "Kenya Tea 500g", "brand": "Kericho Gold", "category": "Groceries",
     "size": "500g", "rating": 4.8, "review_count": 1450,
     "specs": {"type": "Loose leaf"},
     "offers": [("naivas", 420), ("carrefour", 409), ("quickmart", 415)]},
    {"name": "Instant Coffee 100g", "brand": "Dormans", "category": "Groceries",
     "size": "100g", "rating": 4.6, "review_count": 385,
     "specs": {"type": "Instant", "origin": "Kenyan arabica"},
     "offers": [("carrefour", 650), ("naivas", 670), ("chandarana", 690)]},
    {"name": "Blue Band Margarine 500g", "brand": "Blue Band", "category": "Groceries",
     "size": "500g", "rating": 4.4, "review_count": 560,
     "specs": {"vitamin_fortified": True},
     "offers": [("carrefour", 350), ("naivas", 360), ("quickmart", 355)]},
    {"name": "Brookside Milk 500ml", "brand": "Brookside", "category": "Groceries",
     "size": "500ml", "rating": 4.7, "review_count": 1820,
     "specs": {"pasteurized": True, "fat": "Whole"},
     "offers": [("quickmart", 62), ("naivas", 65), ("carrefour", 68), ("chandarana", 70)]},
    {"name": "Coca-Cola 2L", "brand": "Coca-Cola", "category": "Food & Beverages",
     "size": "2L", "rating": 4.6, "review_count": 980,
     "specs": {"sugar": True, "caffeine": True},
     "offers": [("naivas", 220), ("carrefour", 240), ("quickmart", 225)]},
    {"name": "White Bread 400g", "brand": "Festive", "category": "Food & Beverages",
     "size": "400g", "rating": 4.2, "review_count": 240,
     "specs": {"type": "White sliced"},
     "offers": [("naivas", 65), ("carrefour", 60), ("quickmart", 62)]},
    {"name": "Eggs Tray (30)", "brand": "Kenchic", "category": "Food & Beverages",
     "size": "30 eggs", "rating": 4.5, "review_count": 412,
     "specs": {"grade": "A", "source": "Free-range"},
     "offers": [("naivas", 560), ("carrefour", 549), ("quickmart", 555), ("chandarana", 579)]},
    {"name": "Colgate Toothpaste 140g", "brand": "Colgate", "category": "Health & Beauty",
     "size": "140g", "rating": 4.7, "review_count": 1340,
     "specs": {"fluoride": True, "flavor": "Mint"},
     "offers": [("quickmart", 260), ("naivas", 280), ("carrefour", 275)]},
    {"name": "Geisha Soap Bar 250g", "brand": "Geisha", "category": "Health & Beauty",
     "size": "250g", "rating": 4.3, "review_count": 480,
     "specs": {"type": "Beauty soap"},
     "offers": [("naivas", 140), ("carrefour", 135), ("quickmart", 139)]},
    {"name": "Nivea Body Lotion 400ml", "brand": "Nivea", "category": "Health & Beauty",
     "size": "400ml", "rating": 4.6, "review_count": 920,
     "specs": {"type": "Moisturizing", "spf": False},
     "offers": [("carrefour", 720), ("naivas", 749), ("quickmart", 735)]},
    {"name": "Omo Detergent 1kg", "brand": "Omo", "category": "Household",
     "size": "1kg", "rating": 4.5, "review_count": 640,
     "specs": {"type": "Powder"},
     "offers": [("quickmart", 475), ("naivas", 490), ("carrefour", 469)]},
    {"name": "Tissue Paper 10pk", "brand": "Rosy", "category": "Household",
     "size": "10 rolls", "rating": 4.4, "review_count": 310,
     "specs": {"ply": 2, "scent": "Unscented"},
     "offers": [("quickmart", 430), ("carrefour", 450), ("naivas", 455)]},
    {"name": "Dettol Disinfectant 250ml", "brand": "Dettol", "category": "Household",
     "size": "250ml", "rating": 4.7, "review_count": 770,
     "specs": {"type": "Antiseptic liquid"},
     "offers": [("carrefour", 320), ("naivas", 335), ("quickmart", 329)]},
    {"name": "Samsung Galaxy A15", "brand": "Samsung", "category": "Electronics",
     "size": "6.5\"", "rating": 4.3, "review_count": 215,
     "specs": {"display": "6.5\" LCD 90Hz", "ram": "4GB", "storage": "128GB",
               "battery": "5000mAh", "camera": "50MP", "os": "Android 14"},
     "offers": [("carrefour", 22500), ("naivas", 23500)]},
    {"name": "Bluetooth Earbuds", "brand": "Oraimo", "category": "Electronics",
     "size": "True wireless", "rating": 4.1, "review_count": 180,
     "specs": {"bluetooth": "5.3", "battery_life": "24h with case",
               "noise_cancel": False, "water_resistant": "IPX4"},
     "offers": [("carrefour", 1750), ("quickmart", 1850)]},
    {"name": "Electric Kettle 1.7L", "brand": "Ramtons", "category": "Electronics",
     "size": "1.7L", "rating": 4.4, "review_count": 260,
     "specs": {"power": "2200W", "auto_shutoff": True, "cordless": True},
     "offers": [("carrefour", 2899), ("naivas", 2950), ("quickmart", 2899)]},
]


async def seed_if_empty(db: AsyncSession) -> None:
    """
    Idempotently ensure the catalog is populated.

    Runs on every boot but only inserts rows that are missing, so it is
    safe to re-run without breaking existing data. Also refreshes
    comparison attributes (size, rating, specs, etc.) on existing rows
    so older databases pick up the richer seed.
    """
    # 1. Merchants — upsert by slug
    existing_merchants = (await db.execute(select(Merchant))).scalars().all()
    merchants_by_slug: dict[str, Merchant] = {m.slug: m for m in existing_merchants}
    for m in MERCHANTS:
        if m["slug"] in merchants_by_slug:
            continue
        obj = Merchant(slug=m["slug"], name=m["name"], base_url=m["base_url"], is_active=True)
        db.add(obj)
        merchants_by_slug[m["slug"]] = obj
    await db.flush()

    # 2. Products — upsert by canonical_name, refresh attributes on existing rows
    existing_products = {
        p.canonical_name: p for p in (
            await db.execute(select(Product))
        ).scalars().all()
    }

    new_product_count = 0
    refreshed_count = 0
    for p in PRODUCTS:
        canonical = " ".join(p["name"].lower().split())
        attrs = {
            "size": p.get("size"),
            "rating": p.get("rating"),
            "review_count": p.get("review_count"),
            "specs": p.get("specs"),
        }

        product = existing_products.get(canonical)
        if product is None:
            product = Product(
                canonical_name=canonical,
                display_name=p["name"],
                brand=p.get("brand"),
                category=p.get("category"),
                **attrs,
            )
            db.add(product)
            await db.flush()
            new_product_count += 1
        else:
            # Fill in any missing attributes without clobbering non-null values.
            changed = False
            for key, value in attrs.items():
                if value is not None and getattr(product, key, None) in (None, ""):
                    setattr(product, key, value)
                    changed = True
            if changed:
                refreshed_count += 1

        # Ensure every expected merchant has at least one snapshot for this product.
        existing_pairs = {
            (row[0], row[1]) for row in (
                await db.execute(
                    select(PriceSnapshot.product_id, PriceSnapshot.merchant_id)
                    .where(PriceSnapshot.product_id == product.id)
                )
            ).all()
        }
        for slug, price in p["offers"]:
            merchant = merchants_by_slug.get(slug)
            if merchant is None:
                continue
            if (product.id, merchant.id) in existing_pairs:
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

    if new_product_count or refreshed_count:
        logger.info(
            "Seed applied",
            new_products=new_product_count,
            refreshed_products=refreshed_count,
        )
    else:
        logger.debug("Seed skipped — catalog already complete")
