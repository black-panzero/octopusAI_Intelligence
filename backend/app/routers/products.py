"""Product search router — DB + optional live scraping."""
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models.user import User
from app.routers.auth import get_current_user
from app.schemas.products import ProductSearchResponse
from app.services.catalog_service import CatalogService
from app.services.scraping_service import ScrapingService

logger = structlog.get_logger(__name__)

router = APIRouter()


def get_catalog_service(db: AsyncSession = Depends(get_db)) -> CatalogService:
    return CatalogService(db)


def get_scraping_service(db: AsyncSession = Depends(get_db)) -> ScrapingService:
    return ScrapingService(db)


@router.get(
    "/search",
    response_model=ProductSearchResponse,
    summary="Search products across merchants",
    description=(
        "Returns grouped cross-merchant offers from the catalog. Pass "
        "`live=true` to hit every registered scraper in parallel first, so "
        "the results reflect real-time prices from Naivas / Carrefour / "
        "Quickmart / Jumia Kenya."
    ),
)
async def search_products(
    current_user: Annotated[User, Depends(get_current_user)],
    catalog: Annotated[CatalogService, Depends(get_catalog_service)],
    scraping: Annotated[ScrapingService, Depends(get_scraping_service)],
    q: str = Query(..., min_length=1, max_length=120),
    live: bool = Query(default=False, description="Refresh from live merchants before searching"),
) -> ProductSearchResponse:
    scrape_summary = None
    if live:
        try:
            scrape_summary = await scraping.refresh_for_query(q)
        except Exception as e:
            logger.warning("live_refresh_failed", query=q, error=str(e))
            scrape_summary = {"error": str(e)}

    try:
        results = await catalog.search(q)
    except Exception as e:
        logger.error("catalog_search_failed", error=str(e), query=q)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Search failed",
        )

    logger.info(
        "Product search complete",
        user_id=current_user.id, query=q, matches=len(results),
        live=live, scrape_summary=scrape_summary,
    )
    response = ProductSearchResponse(query=q, count=len(results), results=results)
    return response


@router.post(
    "/refresh",
    summary="Force a live scrape of every merchant for a query",
)
async def refresh_live(
    q: str,
    current_user: Annotated[User, Depends(get_current_user)],
    scraping: Annotated[ScrapingService, Depends(get_scraping_service)],
):
    return await scraping.refresh_for_query(q)


@router.get(
    "/{product_id}/history",
    summary="Price history for a product across all merchants",
)
async def product_history(
    product_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    catalog: Annotated[CatalogService, Depends(get_catalog_service)],
):
    data = await catalog.price_history(product_id)
    if data["product"] is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return data
