"""
Carrefour KE scraper.

Carrefour's Kenyan site runs on MAF/Mafro and ships product tiles as
HTML with semi-stable class names. We look for the public product
listing selectors; if they change we fall back to nothing (so other
scrapers still serve results).
"""
from urllib.parse import quote_plus

from app.services.scrapers.base import BaseScraper, ScrapedOffer, parse_price, soup


class CarrefourKeScraper(BaseScraper):
    slug = "carrefour"
    name = "Carrefour"
    base_url = "https://www.carrefour.ke"

    async def search(self, query: str) -> list[ScrapedOffer]:
        q = (query or "").strip()
        if not q:
            return []

        # Carrefour's search URL takes `keyword`.
        html = await self.fetch(
            f"{self.base_url}/mafken/en/v4/search",
            params={"keyword": q, "currentPage": "0", "pageSize": str(self.max_results)},
        )
        if not html:
            html = await self.fetch(f"{self.base_url}/search/{quote_plus(q)}")
        if not html:
            return []

        doc = soup(html)
        offers: list[ScrapedOffer] = []
        selectors = [
            "article.css-b9nx4l",
            "[data-testid='product_card']",
            ".product-tile",
            ".product_card",
            "[class*='ProductCard']",
        ]
        cards = []
        for sel in selectors:
            cards = doc.select(sel)
            if cards:
                break

        for card in cards[: self.max_results]:
            name_el = (card.select_one("[data-testid='product_name']")
                       or card.select_one("h2, h3")
                       or card.select_one("a"))
            price_el = (card.select_one("[data-testid='product_price']")
                        or card.select_one("[class*='Price']")
                        or card.select_one(".price"))
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
