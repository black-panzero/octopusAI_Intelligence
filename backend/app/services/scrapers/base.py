"""
Base class + registry for HTTP product scrapers.

Every concrete scraper implements `search(query)` and returns a list of
`ScrapedOffer`s. The base class does the polite HTTP fetch (proper UA,
timeouts, redirect following) and exposes helpers for price and URL
parsing so concrete scrapers stay short.

Scrapers must never raise on network/site errors — they return an empty
list so one broken merchant can't take the whole aggregation down.
"""
from __future__ import annotations

import asyncio
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urljoin

import httpx
import structlog
from bs4 import BeautifulSoup

logger = structlog.get_logger(__name__)


@dataclass
class ScrapedOffer:
    product_name: str
    price: float
    currency: str = "KES"
    url: Optional[str] = None
    image_url: Optional[str] = None
    available: bool = True
    brand: Optional[str] = None
    category: Optional[str] = None
    rating: Optional[float] = None
    review_count: Optional[int] = None
    size: Optional[str] = None
    specs: Optional[dict] = None
    extra: dict = field(default_factory=dict)


DEFAULT_UA = (
    "SmartBuyBot/0.1 (+https://smartbuy.ke/bot; shopping-comparison; "
    "contact=support@smartbuy.ke)"
)
DEFAULT_HEADERS = {
    "User-Agent": DEFAULT_UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-KE,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "DNT": "1",
}


PRICE_RE = re.compile(r"[-+]?\d[\d,]*(?:\.\d+)?")


def parse_price(text: str | None) -> Optional[float]:
    """Pull the first number out of a price label like 'KSh 1,299.00'."""
    if not text:
        return None
    match = PRICE_RE.search(text.replace("\xa0", " "))
    if not match:
        return None
    try:
        return float(match.group(0).replace(",", ""))
    except ValueError:
        return None


def soup(html: str) -> BeautifulSoup:
    """Parse HTML once — try lxml, fall back to the stdlib parser."""
    try:
        return BeautifulSoup(html, "lxml")
    except Exception:
        return BeautifulSoup(html, "html.parser")


class BaseScraper(ABC):
    slug: str = ""
    name: str = ""
    base_url: str = ""
    timeout_seconds: float = 12.0
    max_results: int = 10

    async def fetch(self, url: str, *, params: Optional[dict] = None) -> Optional[str]:
        """GET a URL with the shared polite profile. Returns the HTML or None."""
        try:
            async with httpx.AsyncClient(
                timeout=self.timeout_seconds,
                headers=DEFAULT_HEADERS,
                follow_redirects=True,
                http2=False,
            ) as client:
                response = await client.get(url, params=params)
                if response.status_code >= 400:
                    logger.info("scraper.http_error", scraper=self.slug,
                                status=response.status_code, url=url)
                    return None
                return response.text
        except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPError) as e:
            logger.info("scraper.fetch_failed", scraper=self.slug, url=url, error=str(e))
            return None
        except Exception as e:  # pragma: no cover — defensive, scrapers must never bubble up
            logger.warning("scraper.unexpected_error", scraper=self.slug, error=str(e))
            return None

    def resolve(self, path: Optional[str]) -> Optional[str]:
        if not path:
            return None
        return urljoin(self.base_url, path)

    @abstractmethod
    async def search(self, query: str) -> list[ScrapedOffer]:
        raise NotImplementedError
