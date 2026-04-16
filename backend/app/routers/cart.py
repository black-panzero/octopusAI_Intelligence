"""Cart router — get, add, update, remove items, clear."""
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models.user import User
from app.routers.auth import get_current_user
from app.schemas.cart import CartItemIn, CartItemPatch, CartOut
from app.services.cart_service import CartService

logger = structlog.get_logger(__name__)

router = APIRouter()


def get_cart_service(db: AsyncSession = Depends(get_db)) -> CartService:
    return CartService(db)


@router.get("/", response_model=CartOut, summary="View the current user's cart")
async def get_cart(
    user: Annotated[User, Depends(get_current_user)],
    svc: Annotated[CartService, Depends(get_cart_service)],
):
    return await svc.view(user.id)


@router.post(
    "/items",
    response_model=CartOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add an item to the cart (or increment quantity if it exists)",
)
async def add_item(
    payload: CartItemIn,
    user: Annotated[User, Depends(get_current_user)],
    svc: Annotated[CartService, Depends(get_cart_service)],
):
    try:
        return await svc.add_item(user.id, payload.product_id, payload.merchant_id, payload.quantity)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/items/{item_id}", response_model=CartOut, summary="Update item quantity")
async def update_item(
    item_id: int,
    payload: CartItemPatch,
    user: Annotated[User, Depends(get_current_user)],
    svc: Annotated[CartService, Depends(get_cart_service)],
):
    try:
        return await svc.update_quantity(user.id, item_id, payload.quantity)
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart item not found")


@router.delete("/items/{item_id}", response_model=CartOut, summary="Remove a cart item")
async def remove_item(
    item_id: int,
    user: Annotated[User, Depends(get_current_user)],
    svc: Annotated[CartService, Depends(get_cart_service)],
):
    try:
        return await svc.remove_item(user.id, item_id)
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart item not found")


@router.delete("/", response_model=CartOut, summary="Empty the cart")
async def clear_cart(
    user: Annotated[User, Depends(get_current_user)],
    svc: Annotated[CartService, Depends(get_cart_service)],
):
    return await svc.clear(user.id)
