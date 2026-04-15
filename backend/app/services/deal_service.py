# app/services/deal_service.py
"""
Deal service layer for business logic and data operations
"""
from datetime import datetime
from typing import Optional, Sequence

import structlog
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.deals import Deal
from app.schemas.deals import DealCreate, DealUpdate

logger = structlog.get_logger(__name__)


class DealService:
    """Service class for deal-related business operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_deal(self, deal_data: DealCreate) -> Deal:
        """
        Create a new deal.

        Args:
            deal_data: Deal creation data

        Returns:
            Created deal instance

        Raises:
            Exception: If deal creation fails
        """
        try:
            # Create new deal instance
            deal = Deal(
                product_name=deal_data.product_name,
                price=deal_data.price,
                discount=deal_data.discount,
                merchant=deal_data.merchant,
                expiry=deal_data.expiry,
                description=deal_data.description,
                category=deal_data.category,
                original_url=deal_data.original_url,
                is_active=True
            )

            # Add to session and commit
            self.db.add(deal)
            await self.db.commit()
            await self.db.refresh(deal)

            logger.info(
                "Deal created successfully",
                deal_id=deal.id,
                product_name=deal.product_name,
                merchant=deal.merchant
            )

            return deal

        except Exception as e:
            await self.db.rollback()
            logger.error(
                "Failed to create deal",
                error=str(e),
                product_name=deal_data.product_name,
                merchant=deal_data.merchant
            )
            raise

    async def get_deal_by_id(self, deal_id: int) -> Optional[Deal]:
        """
        Retrieve a deal by its ID.

        Args:
            deal_id: Deal identifier

        Returns:
            Deal instance if found, None otherwise
        """
        try:
            stmt = select(Deal).where(Deal.id == deal_id)
            result = await self.db.execute(stmt)
            deal = result.scalar_one_or_none()

            if deal:
                logger.debug("Deal retrieved successfully", deal_id=deal_id)
            else:
                logger.debug("Deal not found", deal_id=deal_id)

            return deal

        except Exception as e:
            logger.error("Failed to retrieve deal", deal_id=deal_id, error=str(e))
            raise

    async def get_deals(
            self,
            skip: int = 0,
            limit: int = 100,
            merchant: Optional[str] = None,
            category: Optional[str] = None,
            active_only: bool = True,
            include_expired: bool = False
    ) -> tuple[Sequence[Deal], int]:
        """
        Retrieve deals with filtering and pagination.

        Args:
            skip: Number of records to skip
            limit: Maximum number of records to return
            merchant: Filter by merchant name
            category: Filter by category
            active_only: Include only active deals
            include_expired: Include expired deals

        Returns:
            Tuple of (deals list, total count)
        """
        try:
            # Build base query
            stmt = select(Deal)
            count_stmt = select(func.count(Deal.id))

            # Apply filters
            conditions = []

            if active_only:
                conditions.append(Deal.is_active == True)

            if not include_expired:
                # Exclude expired deals (where expiry is not null and in the past)
                conditions.append(
                    (Deal.expiry.is_(None)) | (Deal.expiry > datetime.utcnow())
                )

            if merchant:
                conditions.append(Deal.merchant.ilike(f"%{merchant}%"))

            if category:
                conditions.append(Deal.category.ilike(f"%{category}%"))

            # Apply conditions to both statements
            if conditions:
                stmt = stmt.where(*conditions)
                count_stmt = count_stmt.where(*conditions)

            # Order by created_at descending (newest first)
            stmt = stmt.order_by(desc(Deal.created_at))

            # Apply pagination
            stmt = stmt.offset(skip).limit(limit)

            # Execute queries
            result = await self.db.execute(stmt)
            deals = result.scalars().all()

            count_result = await self.db.execute(count_stmt)
            total = count_result.scalar()

            logger.debug(
                "Deals retrieved successfully",
                count=len(deals),
                total=total,
                skip=skip,
                limit=limit,
                merchant=merchant,
                category=category
            )

            return deals, total

        except Exception as e:
            logger.error(
                "Failed to retrieve deals",
                error=str(e),
                skip=skip,
                limit=limit,
                merchant=merchant,
                category=category
            )
            raise

    async def update_deal(self, deal_id: int, deal_data: DealUpdate) -> Optional[Deal]:
        """
        Update an existing deal.

        Args:
            deal_id: Deal identifier
            deal_data: Updated deal data

        Returns:
            Updated deal instance if found, None otherwise
        """
        try:
            # Get existing deal
            deal = await self.get_deal_by_id(deal_id)
            if not deal:
                return None

            # Update fields that are provided
            update_data = deal_data.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                setattr(deal, field, value)

            # Update the updated_at timestamp
            deal.updated_at = datetime.utcnow()

            # Commit changes
            await self.db.commit()
            await self.db.refresh(deal)

            logger.info(
                "Deal updated successfully",
                deal_id=deal_id,
                updated_fields=list(update_data.keys())
            )

            return deal

        except Exception as e:
            await self.db.rollback()
            logger.error("Failed to update deal", deal_id=deal_id, error=str(e))
            raise

    async def delete_deal(self, deal_id: int) -> bool:
        """
        Delete a deal (soft delete by marking as inactive).

        Args:
            deal_id: Deal identifier

        Returns:
            True if deal was deleted, False if not found
        """
        try:
            deal = await self.get_deal_by_id(deal_id)
            if not deal:
                return False

            # Soft delete by marking as inactive
            deal.is_active = False
            deal.updated_at = datetime.utcnow()

            await self.db.commit()

            logger.info("Deal deleted successfully", deal_id=deal_id)
            return True

        except Exception as e:
            await self.db.rollback()
            logger.error("Failed to delete deal", deal_id=deal_id, error=str(e))
            raise

    async def get_active_deals_count(self) -> int:
        """Get count of active deals."""
        try:
            stmt = select(func.count(Deal.id)).where(Deal.is_active == True)
            result = await self.db.execute(stmt)
            count = result.scalar()

            logger.debug("Active deals count retrieved", count=count)
            return count

        except Exception as e:
            logger.error("Failed to get active deals count", error=str(e))
            raise

    async def get_summary_stats(self, recent_limit: int = 5) -> dict:
        """
        Get aggregated deal statistics for the dashboard.

        Returns:
            dict with total_deals, active_deals, inactive_deals,
            unique_merchants, unique_categories, recent_deals.
        """
        try:
            total = (await self.db.execute(select(func.count(Deal.id)))).scalar() or 0
            active = (
                await self.db.execute(
                    select(func.count(Deal.id)).where(Deal.is_active == True)  # noqa: E712
                )
            ).scalar() or 0

            merchants = (
                await self.db.execute(
                    select(func.count(func.distinct(Deal.merchant)))
                )
            ).scalar() or 0
            categories = (
                await self.db.execute(
                    select(func.count(func.distinct(Deal.category))).where(
                        Deal.category.is_not(None)
                    )
                )
            ).scalar() or 0

            recent_stmt = (
                select(Deal)
                .where(Deal.is_active == True)  # noqa: E712
                .order_by(desc(Deal.created_at))
                .limit(recent_limit)
            )
            recent = (await self.db.execute(recent_stmt)).scalars().all()

            return {
                "total_deals": total,
                "active_deals": active,
                "inactive_deals": max(total - active, 0),
                "unique_merchants": merchants,
                "unique_categories": categories,
                "recent_deals": recent,
            }
        except Exception as e:
            logger.error("Failed to build summary stats", error=str(e))
            raise

    async def get_deals_by_merchant(self, merchant: str, limit: int = 10) -> Sequence[Deal]:
        """Get deals by merchant name."""
        try:
            stmt = (
                select(Deal)
                .where(Deal.merchant.ilike(f"%{merchant}%"))
                .where(Deal.is_active == True)
                .order_by(desc(Deal.created_at))
                .limit(limit)
            )

            result = await self.db.execute(stmt)
            deals = result.scalars().all()

            logger.debug(
                "Deals by merchant retrieved",
                merchant=merchant,
                count=len(deals)
            )

            return deals

        except Exception as e:
            logger.error(
                "Failed to get deals by merchant",
                merchant=merchant,
                error=str(e)
            )
            raise


