# app/routers/deals.py
"""
Deal API routes for the SmartBuy deal aggregation engine
"""
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.schemas.deals import DealCreate, DealResponse, DealListResponse
from app.services.deal_service import DealService

logger = structlog.get_logger(__name__)

router = APIRouter()


def get_deal_service(db: AsyncSession = Depends(get_db)) -> DealService:
    """Dependency to get deal service instance."""
    return DealService(db)


@router.post(
    "/",
    response_model=DealResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new deal",
    description="Add a new deal to the SmartBuy aggregation engine",
    response_description="The created deal with generated ID and timestamps"
)
async def create_deal(
    deal_data: DealCreate,
    deal_service: DealService = Depends(get_deal_service)
) -> DealResponse:
    """
    Create a new deal in the system.
    
    This endpoint allows adding new deals to the SmartBuy platform.
    All deals are automatically marked as active upon creation.
    
    Args:
        deal_data: The deal information to create
        
    Returns:
        The created deal with generated ID and metadata
        
    Raises:
        HTTPException: If deal creation fails
    """
    try:
        logger.info(
            "Creating new deal",
            product_name=deal_data.product_name,
            merchant=deal_data.merchant,
            price=deal_data.price
        )
        
        deal = await deal_service.create_deal(deal_data)
        
        logger.info(
            "Deal created successfully",
            deal_id=deal.id,
            product_name=deal.product_name
        )
        
        return DealResponse.model_validate(deal)
        
    except Exception as e:
        logger.error("Failed to create deal", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create deal: {str(e)}"
        )


@router.get(
    "/",
    response_model=DealListResponse,
    summary="Get all deals",
    description="Retrieve deals with optional filtering and pagination",
    response_description="Paginated list of deals with metadata"
)
async def get_deals(
    page: int = Query(default=1, ge=1, description="Page number (starts at 1)"),
    size: int = Query(default=20, ge=1, le=100, description="Number of deals per page"),
    merchant: Optional[str] = Query(
        default=None,
        description="Filter by merchant name (case-insensitive partial match)"
    ),
    category: Optional[str] = Query(
        default=None,
        description="Filter by category (case-insensitive partial match)"
    ),
    active_only: bool = Query(
        default=True,
        description="Include only active deals"
    ),
    include_expired: bool = Query(
        default=False,
        description="Include expired deals in results"
    ),
    deal_service: DealService = Depends(get_deal_service)
) -> DealListResponse:
    """
    Retrieve deals with filtering and pagination support.
    
    This endpoint provides flexible deal retrieval with support for:
    - Pagination (page and size parameters)
    - Merchant filtering (partial name matching)
    - Category filtering (partial name matching)
    - Active/inactive deal filtering
    - Expired deal inclusion/exclusion
    
    Args:
        page: Page number (1-based)
        size: Number of deals per page (1-100)
        merchant: Merchant name filter
        category: Category name filter
        active_only: Whether to include only active deals
        include_expired: Whether to include expired deals
        
    Returns:
        Paginated list of deals matching the criteria
        
    Raises:
        HTTPException: If retrieval fails
    """
    try:
        # Calculate offset for pagination
        skip = (page - 1) * size
        
        logger.debug(
            "Retrieving deals",
            page=page,
            size=size,
            skip=skip,
            merchant=merchant,
            category=category,
            active_only=active_only,
            include_expired=include_expired
        )
        
        deals, total = await deal_service.get_deals(
            skip=skip,
            limit=size,
            merchant=merchant,
            category=category,
            active_only=active_only,
            include_expired=include_expired
        )
        
        # Calculate pagination metadata
        has_next = skip + size < total
        has_prev = page > 1
        
        # Convert deals to response models
        deal_responses = [DealResponse.model_validate(deal) for deal in deals]
        
        response = DealListResponse(
            deals=deal_responses,
            total=total,
            page=page,
            size=size,
            has_next=has_next,
            has_prev=has_prev
        )
        
        logger.info(
            "Deals retrieved successfully",
            count=len(deals),
            total=total,
            page=page,
            merchant=merchant,
            category=category
        )
        
        return response
        
    except Exception as e:
        logger.error("Failed to retrieve deals", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve deals: {str(e)}"
        )


@router.get(
    "/{deal_id}",
    response_model=DealResponse,
    summary="Get deal by ID",
    description="Retrieve a specific deal by its unique identifier",
    response_description="The deal information"
)
async def get_deal(
    deal_id: int,
    deal_service: DealService = Depends(get_deal_service)
) -> DealResponse:
    """
    Retrieve a specific deal by its ID.
    
    Args:
        deal_id: The unique identifier of the deal
        
    Returns:
        The deal information
        
    Raises:
        HTTPException: If deal is not found or retrieval fails
    """
    try:
        logger.debug("Retrieving deal by ID", deal_id=deal_id)
        
        deal = await deal_service.get_deal_by_id(deal_id)
        
        if not deal:
            logger.warning("Deal not found", deal_id=deal_id)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Deal with ID {deal_id} not found"
            )
        
        logger.info("Deal retrieved successfully", deal_id=deal_id)
        return DealResponse.model_validate(deal)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to retrieve deal", deal_id=deal_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve deal: {str(e)}"
        )


@router.get(
    "/merchant/{merchant_name}",
    response_model=list[DealResponse],
    summary="Get deals by merchant",
    description="Retrieve deals from a specific merchant",
    response_description="List of deals from the specified merchant"
)
async def get_deals_by_merchant(
    merchant_name: str,
    limit: int = Query(default=10, ge=1, le=50, description="Maximum number of deals to return"),
    deal_service: DealService = Depends(get_deal_service)
) -> list[DealResponse]:
    """
    Retrieve deals from a specific merchant.
    
    Args:
        merchant_name: Name of the merchant
        limit: Maximum number of deals to return
        
    Returns:
        List of deals from the specified merchant
        
    Raises:
        HTTPException: If retrieval fails
    """
    try:
        logger.debug("Retrieving deals by merchant", merchant=merchant_name, limit=limit)
        
        deals = await deal_service.get_deals_by_merchant(merchant_name, limit)
        
        # Convert to response models
        deal_responses = [DealResponse.model_validate(deal) for deal in deals]
        
        logger.info(
            "Deals by merchant retrieved successfully",
            merchant=merchant_name,
            count=len(deals)
        )
        
        return deal_responses
        
    except Exception as e:
        logger.error(
            "Failed to retrieve deals by merchant",
            merchant=merchant_name,
            error=str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve deals by merchant: {str(e)}"
        )


@router.get(
    "/stats/summary",
    summary="Get deal statistics",
    description="Get summary statistics about deals in the system"
)
async def get_deal_stats(
    deal_service: DealService = Depends(get_deal_service)
):
    """
    Get summary statistics about deals in the system.
    
    Returns:
        Dictionary containing deal statistics
        
    Raises:
        HTTPException: If statistics retrieval fails
    """
    try:
        logger.debug("Retrieving deal statistics")

        stats = await deal_service.get_summary_stats()

        # Serialize recent deals for JSON response
        recent = [DealResponse.model_validate(d).model_dump() for d in stats["recent_deals"]]
        response = {**stats, "recent_deals": recent}

        logger.info(
            "Deal statistics retrieved successfully",
            total=response["total_deals"],
            active=response["active_deals"],
            merchants=response["unique_merchants"],
            categories=response["unique_categories"],
        )
        return response
        
    except Exception as e:
        logger.error("Failed to retrieve deal statistics", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve deal statistics: {str(e)}"
        )


