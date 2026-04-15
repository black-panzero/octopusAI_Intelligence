"""Mock Quickmart adapter."""
from app.services.aggregation.base import MerchantAdapter, RawOffer


class MockQuickmartAdapter(MerchantAdapter):
    slug = "quickmart"
    name = "Quickmart"
    base_url = "https://quickmart.co.ke"

    _catalog: list[dict] = [
        {"name": "Pishori Rice 5kg",         "price": 975,   "category": "Groceries",       "brand": "Mwea"},
        {"name": "Colgate Toothpaste 140g",  "price": 260,   "category": "Health & Beauty", "brand": "Colgate"},
        {"name": "Cooking Oil 1L",           "price": 315,   "category": "Groceries",       "brand": "Fresh Fri"},
        {"name": "Tissue Paper 10pk",        "price": 430,   "category": "Household",       "brand": "Rosy"},
        {"name": "Brookside Milk 500ml",     "price": 62,    "category": "Groceries",       "brand": "Brookside"},
        {"name": "Omo Detergent 1kg",        "price": 475,   "category": "Household",       "brand": "Omo"},
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
