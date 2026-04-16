"""
Phone Place Kenya — WooCommerce storefront.

WooCommerce renders search results under `.products > li.product`. We try
both the classic /shop/?s= and the WordPress ?s= global search.
"""
from app.services.scrapers.base import BaseScraper, ScrapedOffer, parse_price, soup


class PhonePlaceKenyaScraper(BaseScraper):
    slug = "phone_place_kenya"
    name = "Phone Place Kenya"
    base_url = "https://phoneplacekenya.com"

    async def search(self, query: str) -> list[ScrapedOffer]:
        q = (query or "").strip()
        if not q:
            return []

        html = await self.fetch(f"{self.base_url}/", params={"s": q, "post_type": "product"})
        if not html:
            html = await self.fetch(f"{self.base_url}/shop/", params={"s": q})
        if not html:
            return []

        doc = soup(html)
        offers: list[ScrapedOffer] = []
        selectors = [
            "ul.products li.product",
            ".products .product",
            "li.product",
            "[class*='ProductCard']",
        ]
        cards: list = []
        for sel in selectors:
            cards = doc.select(sel)
            if cards:
                break

        for card in cards[: self.max_results]:
            name_el = (card.select_one(".woocommerce-loop-product__title")
                       or card.select_one("h2, h3")
                       or card.select_one("a"))
            price_el = (card.select_one(".woocommerce-Price-amount")
                        or card.select_one(".price"))
            link_el = card.select_one("a.woocommerce-LoopProduct-link") or card.select_one("a[href]")
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
