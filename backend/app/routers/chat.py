"""Chat router — conversational shopping assistant with tool calling."""
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.database import get_db
from app.db.models.user import User
from app.routers.auth import get_current_user
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.ai.chat_service import run_chat

logger = structlog.get_logger(__name__)

router = APIRouter()


@router.get("/status", summary="Is the AI assistant configured?")
async def status():
    settings = get_settings()
    return {
        "configured": bool(settings.llm_api_key),
        "provider": settings.llm_provider,
        "model": settings.llm_model,
    }


@router.post(
    "/",
    response_model=ChatResponse,
    summary="Chat with the SmartBuy AI assistant",
)
async def chat(
    payload: ChatRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await run_chat(
        messages=[m.model_dump(exclude_none=True) for m in payload.messages],
        db=db,
        user=user,
    )
    return ChatResponse(**result)
