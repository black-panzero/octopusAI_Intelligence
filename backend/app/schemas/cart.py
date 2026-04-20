"""Pydantic schemas for the cart API."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class CartItemIn(BaseModel):
    product_id: int = Field(..., gt=0)
    merchant_id: int = Field(..., gt=0)
    quantity: int = Field(default=1, ge=1, le=99)


class CartItemPatch(BaseModel):
    quantity: int = Field(..., ge=0, le=99)


class CartItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    merchant_id: int
    product_name: str
    brand: Optional[str] = None
    category: Optional[str] = None
    merchant: str
    merchant_slug: Optional[str] = None
    price: float
    quantity: int
    subtotal: float
    added_at: datetime


class MerchantTotal(BaseModel):
    merchant: str
    merchant_slug: Optional[str] = None
    total: float
    item_count: int


class CartOut(BaseModel):
    id: int
    items: list[CartItemOut]
    merchant_totals: list[MerchantTotal]
    total: float
    item_count: int
    savings_vs_worst_split: float
    updated_at: datetime
