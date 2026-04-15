"""
Jumia Kenya scraper — reads HTML tiles at /catalog/?q=…

Captures image, rating (stars out of 5), and review count along with
name+price so the Product row gets populated with real metadata over time.
"""
import re
from typing import Optional

from app.services.scrapers.base import BaseScraper, ScrapedOffer, parse_price, soup


_RATING_RE = re.compile(r"(\d+(?:\.\d+)?)\s*(?:out of|/)\s*5", re.I)
_REVIEW_COUNT_RE = re.compile(r"\((\d+)\)")


def _extract_rating(card) -> tuple[Optional[float], Optional[int]]:
    """Parse the little stars + (12) bit inside Jumia's .stars/.rev block."""
    rating = None
    reviews = None
    stars_el = card.select_one(".stars") or card.select_one("[class*='stars']")
    if stars_el:
        text = stars_el.get_text(" ", strip=True)
        m = _RATING_RE.search(text)
        if m:
            try: rating = float(m.group(1))
            except ValueError: pass
        m2 = _REVIEW_COUNT_RE.search(text)
        if m2:
            try: reviews = int(m2.group(1))
            except ValueError: pass
        # Some themes expose stars via inline style width: 80% → 4.0 / 5
        if rating is None:
            span_style = (stars_el.select_one("span[style]") or stars_el).get("style", "")
            pct_match = re.search(r"width:\s*([\d.]+)%", span_style or "")
            if pct_match:
                try: rating = round(float(pct_match.group(1)) / 20.0, 2)
                except ValueError: pass
    if reviews is None:
        rev_el = card.select_one(".rev") or card.select_one("[class*='rating-count']")
        if rev_el:
            m = _REVIEW_COUNT_RE.search(rev_el.get_text(" ", strip=True))
            if m:
                try: reviews = int(m.group(1))
                except ValueError: pass
    return rating, reviews


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
            image_el = card.select_one("img.img") or card.select_one("img")
            if not name_el or not price_el:
                continue
            price = parse_price(price_el.get_text(" ", strip=True))
            if price is None or price <= 0:
                continue

            image_url = None
            if image_el:
                image_url = (
                    image_el.get("data-src")
                    or image_el.get("src")
                    or image_el.get("data-srcset", "").split(" ")[0]
                )

            rating, reviews = _extract_rating(card)
            brand = None
            brand_el = card.select_one(".brand")
            if brand_el:
                brand = brand_el.get_text(" ", strip=True)

            offers.append(
                ScrapedOffer(
                    product_name=name_el.get_text(" ", strip=True),
                    price=price,
                    url=self.resolve(link_el.get("href") if link_el else None),
                    image_url=image_url,
                    rating=rating,
                    review_count=reviews,
                    brand=brand,
                )
            )

        return offers
