"""Shopping list router — full CRUD + send-to-cart."""
from typing import Annotated, Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models.user import User
from app.routers.auth import get_current_user
from app.schemas.shopping_list import (
    SendToCartResult,
    ShoppingListCreateIn,
    ShoppingListItemIn,
    ShoppingListItemPatch,
    ShoppingListOut,
    ShoppingListPatch,
)
from app.services.shopping_list_service import ShoppingListService

logger = structlog.get_logger(__name__)

router = APIRouter()


def get_service(db: AsyncSession = Depends(get_db)) -> ShoppingListService:
    return ShoppingListService(db)


@router.get("/", response_model=list[ShoppingListOut], summary="List user's lists")
async def list_lists(
    user: Annotated[User, Depends(get_current_user)],
    svc: Annotated[ShoppingListService, Depends(get_service)],
    include_archived: bool = Query(default=False),
    kind: Optional[str] = Query(default=None, description="shopping | wishlist"),
):
    return await svc.list_for_user(user.id, include_archived=include_archived, kind=kind)


@router.post(
    "/",
    response_model=ShoppingListOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new list",
)
async def create_list(
    payload: ShoppingListCreateIn,
    user: Annotated[User, Depends(get_current_user)],
    svc: Annotated[ShoppingListService, Depends(get_service)],
):
    items = [i.model_dump(exclude_none=True) for i in (payload.items or [])]
    return await svc.create(user.id, title=payload.title, kind=payload.kind, items=items)


@router.get("/{list_id}", response_model=ShoppingListOut, summary="Get a list with its items")
async def get_list(
    list_id: int,
    user: Annotated[User, Depends(get_current_user)],
    svc: Annotated[ShoppingListService, Depends(get_service)],
):
    lst = await svc.get_serialized(user.id, list_id)
    if lst is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "List not found")
    return lst


@router.patch("/{list_id}", response_model=ShoppingListOut, summary="Rename / archive")
async def patch_list(
    list_id: int,
    payload: ShoppingListPatch,
    user: Annotated[User, Depends(get_current_user)],
    svc: Annotated[ShoppingListService, Depends(get_service)],
):
    result = await svc.update(
        user.id, list_id,
        title=payload.title, kind=payload.kind, is_archived=payload.is_archived,
    )
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "List not found")
    return result


@router.delete("/{list_id}", summary="Delete a list")
async def delete_list(
    list_id: int,
    user: Annotated[User, Depends(get_current_user)],
    svc: Annotated[ShoppingListService, Depends(get_service)],
):
    ok = await svc.delete(user.id, list_id)
    if not ok:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "List not found")
    return {"deleted": list_id}


@router.post(
    "/{list_id}/items",
    response_model=ShoppingListOut,
    summary="Append an item to the list",
)
async def add_item(
    list_id: int,
    payload: ShoppingListItemIn,
    user: Annotated[User, Depends(get_current_user)],
    svc: Annotated[ShoppingListService, Depends(get_service)],
):
    if payload.note is None and payload.product_id is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Provide either a note or a product_id",
        )
    try:
        return await svc.add_item(
            user.id, list_id,
            note=payload.note, product_id=payload.product_id, quantity=payload.quantity,
        )
    except LookupError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))


@router.patch(
    "/{list_id}/items/{item_id}",
    response_model=ShoppingListOut,
    summary="Update an item (quantity / completed / note / sort_order)",
)
async def update_item(
    list_id: int, item_id: int,
    payload: ShoppingListItemPatch,
    user: Annotated[User, Depends(get_current_user)],
    svc: Annotated[ShoppingListService, Depends(get_service)],
):
    try:
        return await svc.update_item(
            user.id, list_id, item_id,
            note=payload.note, product_id=payload.product_id,
            quantity=payload.quantity, completed=payload.completed,
            sort_order=payload.sort_order,
        )
    except LookupError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))


@router.delete(
    "/{list_id}/items/{item_id}",
    response_model=ShoppingListOut,
    summary="Remove an item",
)
async def remove_item(
    list_id: int, item_id: int,
    user: Annotated[User, Depends(get_current_user)],
    svc: Annotated[ShoppingListService, Depends(get_service)],
):
    try:
        return await svc.remove_item(user.id, list_id, item_id)
    except LookupError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))


@router.post(
    "/{list_id}/send-to-cart",
    response_model=SendToCartResult,
    summary="Resolve every item and add to the user's universal cart",
)
async def send_to_cart(
    list_id: int,
    user: Annotated[User, Depends(get_current_user)],
    svc: Annotated[ShoppingListService, Depends(get_service)],
):
    try:
        return await svc.send_to_cart(user.id, list_id)
    except LookupError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))
