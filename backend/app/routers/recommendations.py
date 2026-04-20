"""Recommendations router — Dashboard 'Best deals / Drops / Top rated'."""
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models.user import User
from app.routers.auth import get_current_user
from app.services.recommendation_service import RecommendationService

router = APIRouter()


def get_service(db: AsyncSession = Depends(get_db)) -> RecommendationService:
    return RecommendationService(db)


@router.get("/", summary="Best deals, biggest drops and top-rated products")
async def recommendations(
    user: Annotated[User, Depends(get_current_user)],
    svc: Annotated[RecommendationService, Depends(get_service)],
):
    return await svc.for_user(user.id)
