"""
Jumia Kenya scraper.

Jumia's catalog search is server-rendered enough that a plain HTTP GET
gets us the product tiles. Product cards are `article.prd` with
`.name`, `.prc`, `a.core`.
"""
from urllib.parse import quote_plus

from app.services.scrapers.base import BaseScraper, ScrapedOffer, parse_price, soup


class JumiaKeScraper(BaseScraper):
    slug = "jumia_ke"
    name = "Jumia Kenya"
    base_url = "https://www.jumia.co.ke"

    async def search(self, query: str) -> list[ScrapedOffer]:
        q = (query or "").strip()
        if not q:
            return []
        html = await self.fetch(f"{self.base_url}/catalog/", params={"q": q})
        if not html:
            return []

        doc = soup(html)
        offers: list[ScrapedOffer] = []

        for card in doc.select("article.prd")[: self.max_results]:
            name_el = card.select_one(".name")
            price_el = card.select_one(".prc")
            link_el = card.select_one("a.core")
            image_el = card.select_one("img.img")
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
                        image_el.get("data-src") or image_el.get("src")
                        if image_el else None
                    ),
                )
            )

        return offers
