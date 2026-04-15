"""Price rule router — list, create/update, delete, evaluate."""
from datetime import datetime, timezone
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models.user import User
from app.routers.auth import get_current_user
from app.schemas.rules import EvaluateResponse, PriceRuleIn, PriceRuleOut
from app.services.rules_service import RulesService

logger = structlog.get_logger(__name__)

router = APIRouter()


def get_rules_service(db: AsyncSession = Depends(get_db)) -> RulesService:
    return RulesService(db)


@router.get(
    "/",
    response_model=list[PriceRuleOut],
    summary="List the current user's tracking + automation rules",
)
async def list_rules(
    user: Annotated[User, Depends(get_current_user)],
    svc: Annotated[RulesService, Depends(get_rules_service)],
):
    return await svc.list_for_user(user.id)


@router.post(
    "/",
    response_model=list[PriceRuleOut],
    status_code=status.HTTP_201_CREATED,
    summary="Create (or replace) a rule for a product",
)
async def create_rule(
    payload: PriceRuleIn,
    user: Annotated[User, Depends(get_current_user)],
    svc: Annotated[RulesService, Depends(get_rules_service)],
):
    try:
        await svc.create(
            user_id=user.id,
            product_id=payload.product_id,
            action=payload.action,
            target_price=payload.target_price,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return await svc.list_for_user(user.id)


@router.delete(
    "/{rule_id}",
    response_model=list[PriceRuleOut],
    summary="Delete a rule",
)
async def delete_rule(
    rule_id: int,
    user: Annotated[User, Depends(get_current_user)],
    svc: Annotated[RulesService, Depends(get_rules_service)],
):
    ok = await svc.delete(user.id, rule_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")
    return await svc.list_for_user(user.id)


@router.post(
    "/evaluate",
    response_model=EvaluateResponse,
    summary="Evaluate every active rule now and auto-execute where configured",
)
async def evaluate(
    user: Annotated[User, Depends(get_current_user)],
    svc: Annotated[RulesService, Depends(get_rules_service)],
):
    triggered = await svc.evaluate_all(user.id)
    return EvaluateResponse(
        evaluated_at=datetime.now(timezone.utc),
        triggered=triggered,
    )
