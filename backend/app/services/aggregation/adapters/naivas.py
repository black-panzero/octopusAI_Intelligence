"""
Mock Naivas adapter. Returns a small hand-curated catalog with Kenyan-market
prices so the aggregation pipeline can be exercised end-to-end without
network access. Replace with a real scraper (Scrapy/httpx+BeautifulSoup)
later — the AggregationService contract stays the same.
"""
from app.services.aggregation.base import MerchantAdapter, RawOffer


class MockNaivasAdapter(MerchantAdapter):
    slug = "naivas"
    name = "Naivas"
    base_url = "https://naivas.online"

    _catalog: list[dict] = [
        {"name": "Pishori Rice 5kg",         "price": 950,   "category": "Groceries",       "brand": "Mwea"},
        {"name": "Coca-Cola 2L",             "price": 220,   "category": "Food & Beverages","brand": "Coca-Cola"},
        {"name": "Colgate Toothpaste 140g",  "price": 280,   "category": "Health & Beauty", "brand": "Colgate"},
        {"name": "Blue Band Margarine 500g", "price": 360,   "category": "Groceries",       "brand": "Blue Band"},
        {"name": "Cooking Oil 1L",           "price": 320,   "category": "Groceries",       "brand": "Fresh Fri"},
        {"name": "Brookside Milk 500ml",     "price": 65,    "category": "Groceries",       "brand": "Brookside"},
        {"name": "Omo Detergent 1kg",        "price": 490,   "category": "Household",       "brand": "Omo"},
    ]

    async def search(self, query: str) -> list[RawOffer]:
        q = query.lower().strip()
        if not q:
            return []
        out: list[RawOffer] = []
        for item in self._catalog:
            haystack = f"{item['name']} {item.get('brand', '')} {item.get('category', '')}".lower()
            if q in haystack:
                out.append(
                    RawOffer(
                        product_name=item["name"],
                        price=item["price"],
                        url=f"{self.base_url}/search?q={query}",
                        brand=item.get("brand"),
                        category=item.get("category"),
                    )
                )
        return out
