"""
Quickmart scraper.

Quickmart's storefront is simpler than the others — a plain product grid
that yields to CSS-selector parsing. Multiple selector candidates are
tried to survive small theme bumps.
"""
from urllib.parse import quote_plus

from app.services.scrapers.base import BaseScraper, ScrapedOffer, parse_price, soup


class QuickmartScraper(BaseScraper):
    slug = "quickmart"
    name = "Quickmart"
    base_url = "https://quickmart.co.ke"

    async def search(self, query: str) -> list[ScrapedOffer]:
        q = (query or "").strip()
        if not q:
            return []

        html = await self.fetch(f"{self.base_url}/search", params={"q": q})
        if not html:
            html = await self.fetch(f"{self.base_url}/?s={quote_plus(q)}")
        if not html:
            return []

        doc = soup(html)
        offers: list[ScrapedOffer] = []
        selectors = [
            ".product-grid-item",
            ".product-card",
            ".product",
            "[class*='ProductCard']",
            "li.product",
        ]
        cards = []
        for sel in selectors:
            cards = doc.select(sel)
            if cards:
                break

        for card in cards[: self.max_results]:
            name_el = (card.select_one(".product-title, .woocommerce-loop-product__title, h2, h3, a"))
            price_el = (card.select_one(".price, .woocommerce-Price-amount, [class*='Price']"))
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
                    image_url=(image_el.get("src") if image_el else None),
                )
            )
        return offers
