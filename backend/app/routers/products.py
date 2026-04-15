"""Product search router — DB-backed cross-merchant price comparison."""
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models.user import User
from app.routers.auth import get_current_user
from app.schemas.products import ProductSearchResponse
from app.services.catalog_service import CatalogService

logger = structlog.get_logger(__name__)

router = APIRouter()


def get_catalog_service(db: AsyncSession = Depends(get_db)) -> CatalogService:
    return CatalogService(db)


@router.get(
    "/search",
    response_model=ProductSearchResponse,
    summary="Search products across merchants",
    description=(
        "Queries the seeded catalog (products + latest price_snapshots per "
        "merchant) and returns grouped results with min/max price and savings "
        "percentage. No mock data — every row comes from the database."
    ),
)
async def search_products(
    current_user: Annotated[User, Depends(get_current_user)],
    catalog: Annotated[CatalogService, Depends(get_catalog_service)],
    q: str = Query(..., min_length=1, max_length=120),
) -> ProductSearchResponse:
    try:
        results = await catalog.search(q)
    except Exception as e:
        logger.error("Catalog search failed", error=str(e), query=q)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Search failed",
        )

    logger.info(
        "Product search complete",
        user_id=current_user.id, query=q, matches=len(results),
    )
    return ProductSearchResponse(query=q, count=len(results), results=results)
