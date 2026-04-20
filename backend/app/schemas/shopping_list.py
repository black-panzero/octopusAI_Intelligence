"""Shopping list API schemas."""
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class ShoppingListItemIn(BaseModel):
    note: Optional[str] = Field(default=None, max_length=255)
    product_id: Optional[int] = None
    quantity: int = Field(default=1, ge=1, le=99)


class ShoppingListCreateIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    kind: Literal["shopping", "wishlist"] = "shopping"
    items: Optional[list[ShoppingListItemIn]] = None


class ShoppingListPatch(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    kind: Optional[Literal["shopping", "wishlist"]] = None
    is_archived: Optional[bool] = None


class ShoppingListItemPatch(BaseModel):
    note: Optional[str] = Field(default=None, max_length=255)
    product_id: Optional[int] = None
    quantity: Optional[int] = Field(default=None, ge=1, le=99)
    completed: Optional[bool] = None
    sort_order: Optional[int] = None


class ShoppingListItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    list_id: int
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    product_image_url: Optional[str] = None
    current_best_price: Optional[float] = None
    current_best_merchant: Optional[str] = None
    note: Optional[str] = None
    quantity: int
    completed: bool
    sort_order: int


class ShoppingListOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    kind: str
    is_archived: bool
    item_count: int
    items: list[ShoppingListItemOut]
    created_at: datetime
    updated_at: datetime


class SendToCartResult(BaseModel):
    list_id: int
    list_title: str
    added_count: int
    skipped_count: int
    items_added: list[dict]
    items_skipped: list[dict]
