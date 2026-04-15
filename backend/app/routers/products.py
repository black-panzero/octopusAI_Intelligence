"""Product search router — cross-merchant price comparison."""
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models.user import User
from app.routers.auth import get_current_user
from app.schemas.products import ProductSearchResponse
from app.services.aggregation.adapters import DEFAULT_ADAPTERS
from app.services.aggregation.service import AggregationService

logger = structlog.get_logger(__name__)

router = APIRouter()


def get_aggregation_service(db: AsyncSession = Depends(get_db)) -> AggregationService:
    return AggregationService(db=db, adapters=DEFAULT_ADAPTERS)


@router.get(
    "/search",
    response_model=ProductSearchResponse,
    summary="Search products across all merchants",
    description=(
        "Runs the query against every configured merchant adapter, "
        "persists a PriceSnapshot per offer, and returns grouped results "
        "with min/max price and savings percentage."
    ),
)
async def search_products(
    current_user: Annotated[User, Depends(get_current_user)],
    aggregator: Annotated[AggregationService, Depends(get_aggregation_service)],
    q: str = Query(..., min_length=1, max_length=120, description="Search query"),
) -> ProductSearchResponse:
    try:
        results = await aggregator.search(q)
    except Exception as e:
        logger.error("Aggregation search failed", error=str(e), query=q)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Search failed, please try again",
        )

    logger.info(
        "Product search complete",
        user_id=current_user.id, query=q, matches=len(results),
    )
    return ProductSearchResponse(query=q, count=len(results), results=results)
