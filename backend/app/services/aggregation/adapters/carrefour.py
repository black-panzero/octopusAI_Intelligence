"""Mock Carrefour adapter."""
from app.services.aggregation.base import MerchantAdapter, RawOffer


class MockCarrefourAdapter(MerchantAdapter):
    slug = "carrefour"
    name = "Carrefour"
    base_url = "https://www.carrefour.ke"

    _catalog: list[dict] = [
        {"name": "Pishori Rice 5kg",         "price": 899,   "category": "Groceries",       "brand": "Mwea"},
        {"name": "Coca-Cola 2L",             "price": 240,   "category": "Food & Beverages","brand": "Coca-Cola"},
        {"name": "Blue Band Margarine 500g", "price": 350,   "category": "Groceries",       "brand": "Blue Band"},
        {"name": "Cooking Oil 1L",           "price": 299,   "category": "Groceries",       "brand": "Fresh Fri"},
        {"name": "Brookside Milk 500ml",     "price": 68,    "category": "Groceries",       "brand": "Brookside"},
        {"name": "Tissue Paper 10pk",        "price": 450,   "category": "Household",       "brand": "Rosy"},
        {"name": "Samsung Galaxy A15",       "price": 22500, "category": "Electronics",     "brand": "Samsung"},
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
                        url=f"{self.base_url}/search?keyword={query}",
                        brand=item.get("brand"),
                        category=item.get("category"),
                    )
                )
        return out
