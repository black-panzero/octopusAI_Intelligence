"""Pydantic schemas for price rules."""
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class PriceRuleIn(BaseModel):
    product_id: int = Field(..., gt=0)
    action: Literal["alert", "add_to_cart"] = "alert"
    target_price: Optional[float] = Field(default=None, ge=0)


class PriceRuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    product_name: str
    brand: Optional[str] = None
    category: Optional[str] = None
    action: str
    target_price: Optional[float] = None
    is_active: bool
    current_price: Optional[float] = None
    current_merchant: Optional[str] = None
    triggered: bool
    last_triggered_at: Optional[datetime] = None
    created_at: datetime


class RuleTriggerOut(BaseModel):
    rule_id: int
    product_id: int
    merchant: str
    merchant_slug: str
    current_price: float
    target_price: float
    action_taken: str


class EvaluateResponse(BaseModel):
    evaluated_at: datetime
    triggered: list[RuleTriggerOut]
