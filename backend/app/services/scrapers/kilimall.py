"""
Kilimall scraper.

Kilimall's search at /new/commoditysearch/ ships product tiles as HTML
with data attributes. Multiple tile selectors tried for resilience.
"""
from app.services.scrapers.base import BaseScraper, ScrapedOffer, parse_price, soup


class KilimallScraper(BaseScraper):
    slug = "kilimall"
    name = "Kilimall"
    base_url = "https://www.kilimall.co.ke"

    async def search(self, query: str) -> list[ScrapedOffer]:
        q = (query or "").strip()
        if not q:
            return []

        # The site has several search URL shapes depending on the locale;
        # the /search endpoint is the most stable.
        html = await self.fetch(f"{self.base_url}/search", params={"q": q})
        if not html:
            html = await self.fetch(f"{self.base_url}/new/commoditysearch", params={"q": q})
        if not html:
            return []

        doc = soup(html)
        offers: list[ScrapedOffer] = []
        selectors = [
            ".product-item",
            ".product",
            ".pro-list",
            "a[href*='/listing/']",
        ]
        cards: list = []
        for sel in selectors:
            cards = doc.select(sel)
            if cards:
                break

        for card in cards[: self.max_results]:
            name_el = (card.select_one(".product-title")
                       or card.select_one(".name")
                       or card.select_one("h3, h4")
                       or card.select_one("a"))
            price_el = (card.select_one(".product-price")
                        or card.select_one(".price")
                        or card.select_one("[class*='price']"))
            link_el = card if card.name == "a" else card.select_one("a[href]")
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
