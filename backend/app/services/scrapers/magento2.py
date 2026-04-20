"""
Shared parsing for Magento 2 storefronts — Masoko, Hotpoint etc.

Magento 2 ships a fairly stable product-tile structure:
  <li class="item product product-item">
    <div class="product-item-info">
      <a class="product-item-link"> Name </a>
      <span class="price"> KSh 1,299 </span>
      <img class="product-image-photo" data-src|src="...">
"""
from typing import Optional
from urllib.parse import urlencode

from bs4 import BeautifulSoup

from app.services.scrapers.base import BaseScraper, ScrapedOffer, parse_price, soup


class Magento2Scraper(BaseScraper):
    """Concrete scrapers inherit this and only override slug/name/base_url."""

    search_path: str = "/catalogsearch/result/"

    async def search(self, query: str) -> list[ScrapedOffer]:
        q = (query or "").strip()
        if not q:
            return []

        html = await self.fetch(f"{self.base_url}{self.search_path}", params={"q": q})
        if not html:
            return []
        return self._parse(html)

    def _parse(self, html: str) -> list[ScrapedOffer]:
        doc: BeautifulSoup = soup(html)
        offers: list[ScrapedOffer] = []

        tiles = doc.select(".product-item-info")
        if not tiles:
            tiles = doc.select("li.product-item")
        if not tiles:
            tiles = doc.select("[data-product-id]")

        for tile in tiles[: self.max_results]:
            name_el = (tile.select_one(".product-item-link")
                       or tile.select_one(".product-item-name a")
                       or tile.select_one("a.product-name")
                       or tile.select_one("a"))
            price_el = (tile.select_one(".price-wrapper .price")
                        or tile.select_one(".price"))
            link_el = tile.select_one("a.product-item-link") or tile.select_one("a[href]")
            image_el = tile.select_one(".product-image-photo") or tile.select_one("img")

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
