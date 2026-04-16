"""
Copia Kenya scraper — attempts the public search page; many sites now
render the result list client-side, so this can come back empty. That's
fine; the orchestrator tolerates it.
"""
from app.services.scrapers.base import BaseScraper, ScrapedOffer, parse_price, soup


class CopiaScraper(BaseScraper):
    slug = "copia"
    name = "Copia"
    base_url = "https://copiakenya.com"

    async def search(self, query: str) -> list[ScrapedOffer]:
        q = (query or "").strip()
        if not q:
            return []

        html = await self.fetch(f"{self.base_url}/search", params={"q": q})
        if not html:
            html = await self.fetch(f"{self.base_url}/", params={"s": q})
        if not html:
            return []

        doc = soup(html)
        offers: list[ScrapedOffer] = []
        selectors = [
            ".product-card",
            ".product-item",
            "article.product",
            "[class*='ProductCard']",
        ]
        cards: list = []
        for sel in selectors:
            cards = doc.select(sel)
            if cards:
                break

        for card in cards[: self.max_results]:
            name_el = card.select_one(".product-title, h3, h4, a")
            price_el = card.select_one(".price, [class*='price']")
            link_el = card.select_one("a[href]")
            image_el = card.select_one("img")

            if not name_el or not price_el:
                continue
            price = parse_price(price_el.get_text(" ", strip=True))
            if price is None or price <= 0:
                continue

            offers.append(
                ScrapedOffer(
                    product_name=name_el.get_text(" ", strip=True),
                    price=price,
                    url=self.resolve(link_el.get("href") if link_el else None),
                    image_url=(
                        (image_el.get("data-src") or image_el.get("src"))
                        if image_el else None
                    ),
                )
            )
        return offers
