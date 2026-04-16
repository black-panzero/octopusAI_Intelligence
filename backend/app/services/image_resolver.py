"""
Image resolver.

Given a merchant product URL, extract a clean product image from:
  1. <meta property="og:image">
  2. <meta name="twitter:image">
  3. JSON-LD Product schema (schema.org/Product)
  4. Common on-page selectors (.product-image img, itemprop=image, etc.)

Used by the scraping pipeline after every persist (when a fresh Product
has no image yet) and by the background scheduler for legacy rows. Never
raises — returns None when nothing resolvable is found.
"""
from __future__ import annotations

import asyncio
import json
import re
from typing import Iterable, Optional
from urllib.parse import urljoin

import httpx
import structlog
from bs4 import BeautifulSoup
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.merchant import Merchant
from app.db.models.price_snapshot import PriceSnapshot
from app.db.models.product import Product
from app.services.scrapers.base import DEFAULT_HEADERS

logger = structlog.get_logger(__name__)

DEFAULT_TIMEOUT = 10.0


def _extract_from_jsonld(ld_text: str) -> Optional[str]:
    try:
        data = json.loads(ld_text)
    except (ValueError, TypeError):
        return None

    def _image_from(obj) -> Optional[str]:
        if not isinstance(obj, dict):
            return None
        if obj.get("@type") in ("Product", "ProductModel"):
            img = obj.get("image")
            if isinstance(img, str):
                return img
            if isinstance(img, list) and img:
                first = img[0]
                if isinstance(first, str):
                    return first
                if isinstance(first, dict):
                    return first.get("url") or first.get("contentUrl")
            if isinstance(img, dict):
                return img.get("url") or img.get("contentUrl")
        return None

    if isinstance(data, list):
        for item in data:
            hit = _image_from(item)
            if hit:
                return hit
    else:
        hit = _image_from(data)
        if hit:
            return hit
        # Some sites embed Product inside @graph
        graph = data.get("@graph") if isinstance(data, dict) else None
        if isinstance(graph, list):
            for item in graph:
                hit = _image_from(item)
                if hit:
                    return hit
    return None


async def _fetch_image_from_url(client: httpx.AsyncClient, url: str) -> Optional[str]:
    try:
        response = await client.get(url)
        if response.status_code >= 400:
            return None
        html = response.text
    except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPError):
        return None

    try:
        doc = BeautifulSoup(html, "lxml")
    except Exception:
        doc = BeautifulSoup(html, "html.parser")

    # 1. OG / Twitter meta
    for key in (
        {"property": "og:image:secure_url"},
        {"property": "og:image"},
        {"name": "twitter:image"},
        {"name": "twitter:image:src"},
    ):
        tag = doc.find("meta", attrs=key)
        if tag and tag.get("content"):
            return urljoin(url, tag["content"].strip())

    # 2. JSON-LD Product schema
    for ld in doc.find_all("script", type="application/ld+json"):
        text = ld.string or ld.text or ""
        if not text:
            continue
        found = _extract_from_jsonld(text)
        if found:
            return urljoin(url, found)

    # 3. Common on-page selectors
    candidates = [
        '[itemprop="image"]',
        ".product-image-photo",
        ".product-image img",
        ".product-main-image img",
        ".gallery__image",
        ".woocommerce-product-gallery__image img",
        "img.lazyload[data-src]",
    ]
    for sel in candidates:
        el = doc.select_one(sel)
        if el is None:
            continue
        src = el.get("content") or el.get("src") or el.get("data-src") or el.get("data-original")
        if src and not src.startswith("data:"):
            return urljoin(url, src.strip())

    return None


async def resolve_image_for_url(url: str, *, timeout: float = DEFAULT_TIMEOUT) -> Optional[str]:
    """Single-URL convenience wrapper."""
    async with httpx.AsyncClient(
        timeout=timeout,
        headers={**DEFAULT_HEADERS, "Accept": "text/html,application/xhtml+xml"},
        follow_redirects=True,
    ) as client:
        return await _fetch_image_from_url(client, url)


async def resolve_image_for_product(
    db: AsyncSession, product: Product, *, client: Optional[httpx.AsyncClient] = None,
) -> Optional[str]:
    """Try every candidate URL we have for the product until one resolves.

    Returns the new image_url (also persisted) or None.
    """
    if product.image_url:
        return product.image_url

    # Pull the latest snapshot URL per merchant — most recent first.
    stmt = (
        select(PriceSnapshot.url)
        .where(PriceSnapshot.product_id == product.id, PriceSnapshot.url.is_not(None))
        .order_by(PriceSnapshot.captured_at.desc())
        .limit(5)
    )
    urls = [row[0] for row in (await db.execute(stmt)).all() if row[0]]
    if not urls:
        return None

    owned_client = client is None
    if owned_client:
        client = httpx.AsyncClient(
            timeout=DEFAULT_TIMEOUT,
            headers={**DEFAULT_HEADERS, "Accept": "text/html,application/xhtml+xml"},
            follow_redirects=True,
        )

    try:
        for url in urls:
            image_url = await _fetch_image_from_url(client, url)
            if image_url:
                product.image_url = image_url
                await db.commit()
                logger.info("image.resolved", product_id=product.id, url=image_url[:120])
                return image_url
    finally:
        if owned_client:
            await client.aclose()

    return None


async def resolve_missing_images(db: AsyncSession, *, batch_size: int = 20) -> int:
    """Walk Products with no image_url and try to resolve each in parallel.

    Returns the number of images successfully filled in this run.
    """
    stmt = (
        select(Product)
        .where(Product.image_url.is_(None))
        .limit(batch_size)
    )
    products = (await db.execute(stmt)).scalars().all()
    if not products:
        return 0

    async with httpx.AsyncClient(
        timeout=DEFAULT_TIMEOUT,
        headers={**DEFAULT_HEADERS, "Accept": "text/html,application/xhtml+xml"},
        follow_redirects=True,
    ) as client:
        resolved = 0
        # Run in small parallel batches — polite to the sites.
        async def _one(product: Product):
            nonlocal resolved
            url = await resolve_image_for_product(db, product, client=client)
            if url:
                resolved += 1

        for i in range(0, len(products), 4):
            await asyncio.gather(*(_one(p) for p in products[i:i + 4]))

    if resolved:
        logger.info("image.batch_resolved", resolved=resolved, total=len(products))
    return resolved
