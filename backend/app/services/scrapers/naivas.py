"""
Naivas scraper — the storefront at naivas.online is Shopify-based, which
exposes a tiny JSON predictive-search endpoint that is both fast and
structured. Fall back to HTML parsing if the JSON endpoint disappears.
"""
from typing import Optional
from urllib.parse import quote_plus

import httpx

from app.services.scrapers.base import (
    BaseScraper, DEFAULT_HEADERS, ScrapedOffer, parse_price, soup,
)


class NaivasScraper(BaseScraper):
    slug = "naivas"
    name = "Naivas"
    base_url = "https://naivas.online"

    async def _predictive(self, query: str) -> Optional[list[dict]]:
        """Shopify's /search/suggest.json gives a structured product list."""
        url = f"{self.base_url}/search/suggest.json"
        params = {
            "q": query,
            "resources[type]": "product",
            "resources[limit]": str(self.max_results),
            "resources[options][unavailable_products]": "last",
        }
        try:
            async with httpx.AsyncClient(
                timeout=self.timeout_seconds,
                headers={**DEFAULT_HEADERS, "Accept": "application/json"},
                follow_redirects=True,
            ) as client:
                r = await client.get(url, params=params)
                if r.status_code >= 400:
                    return None
                data = r.json()
            return (
                data.get("resources", {})
                .get("results", {})
                .get("products", [])
            )
        except Exception:
            return None

    async def search(self, query: str) -> list[ScrapedOffer]:
        q = (query or "").strip()
        if not q:
            return []

        # 1. Try the Shopify predictive-search JSON first.
        products = await self._predictive(q)
        if products:
            offers: list[ScrapedOffer] = []
            for p in products[: self.max_results]:
                price = parse_price(str(p.get("price", "")))
                if price is None or price <= 0:
                    continue
                # Shopify appends ?v=... for cache-busting; pick a sensible size.
                image = p.get("image") or (p.get("featured_image") or {}).get("url")
                offers.append(
                    ScrapedOffer(
                        product_name=p.get("title", "").strip(),
                        price=price,
                        url=self.resolve(p.get("url")),
                        image_url=image,
                        brand=p.get("vendor"),
                        category=p.get("product_type") or None,
                        available=bool(p.get("available", True)),
                    )
                )
            if offers:
                return offers

        # 2. Fall back to the server-rendered /search page.
        html = await self.fetch(f"{self.base_url}/search", params={"q": q, "type": "product"})
        if not html:
            return []
        doc = soup(html)

        offers = []
        selectors = [
            ".product-card", ".product-item", ".grid-product", "[data-product-id]",
        ]
        cards = []
        for sel in selectors:
            cards = doc.select(sel)
            if cards:
                break

        for card in cards[: self.max_results]:
            name_el = (card.select_one(".product-card__title")
                       or card.select_one(".product-title")
                       or card.select_one("a"))
            price_el = (card.select_one(".price__current")
                        or card.select_one(".price .money")
                        or card.select_one("[data-price]")
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
