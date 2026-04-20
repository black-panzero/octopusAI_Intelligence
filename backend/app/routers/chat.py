"""Chat router — conversational assistant + persistent conversations."""
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.database import get_db
from app.db.models.user import User
from app.routers.auth import get_current_user
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ConversationDetail,
    ConversationSummary,
    RenameConversationIn,
)
from app.services.ai.chat_service import run_chat
from app.services.conversation_service import ConversationService, suggest_title

logger = structlog.get_logger(__name__)

router = APIRouter()


def get_conversation_service(db: AsyncSession = Depends(get_db)) -> ConversationService:
    return ConversationService(db)


# ---------------------------------------------------------------------------
# Status + conversations
# ---------------------------------------------------------------------------
@router.get("/status", summary="Is the AI assistant configured?")
async def status():
    settings = get_settings()
    return {
        "configured": bool(settings.llm_api_key),
        "provider": settings.llm_provider,
        "model": settings.llm_model,
    }


@router.get(
    "/conversations",
    response_model=list[ConversationSummary],
    summary="List the current user's saved conversations (latest first)",
)
async def list_conversations(
    user: Annotated[User, Depends(get_current_user)],
    svc: Annotated[ConversationService, Depends(get_conversation_service)],
):
    return await svc.list_for_user(user.id)


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationDetail,
    summary="Load a conversation with its full message transcript",
)
async def get_conversation(
    conversation_id: int,
    user: Annotated[User, Depends(get_current_user)],
    svc: Annotated[ConversationService, Depends(get_conversation_service)],
):
    data = await svc.get_with_turns(user.id, conversation_id)
    if data is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    return data


@router.delete(
    "/conversations/{conversation_id}",
    summary="Delete a conversation",
)
async def delete_conversation(
    conversation_id: int,
    user: Annotated[User, Depends(get_current_user)],
    svc: Annotated[ConversationService, Depends(get_conversation_service)],
):
    ok = await svc.delete(user.id, conversation_id)
    if not ok:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    return {"deleted": conversation_id}


@router.patch(
    "/conversations/{conversation_id}",
    response_model=ConversationSummary,
    summary="Rename a conversation",
)
async def rename_conversation(
    conversation_id: int,
    payload: RenameConversationIn,
    user: Annotated[User, Depends(get_current_user)],
    svc: Annotated[ConversationService, Depends(get_conversation_service)],
):
    conv = await svc.rename(user.id, conversation_id, payload.title)
    if conv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    return svc._conv_summary(conv)


# ---------------------------------------------------------------------------
# Send a message
# ---------------------------------------------------------------------------
@router.post(
    "/",
    response_model=ChatResponse,
    summary="Send a chat message (creates a new conversation if none given)",
)
async def chat(
    payload: ChatRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    svc: Annotated[ConversationService, Depends(get_conversation_service)],
):
    # Resolve or create the conversation the message belongs to.
    conversation_id = payload.conversation_id
    if conversation_id is None:
        first_user = next(
            (m.content for m in payload.messages if m.role == "user" and m.content), "",
        )
        conv = await svc.create(user.id, title=suggest_title(first_user))
        conversation_id = conv.id
        title = conv.title
    else:
        conv = await svc.get(user.id, conversation_id)
        if conv is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
        title = conv.title

    result = await run_chat(
        messages=[m.model_dump(exclude_none=True) for m in payload.messages],
        db=db,
        user=user,
    )

    # Persist the new transcript for this conversation.
    try:
        await svc.replace_turns(conversation_id, result["messages"], result["invocations"])
    except Exception as e:
        logger.warning("chat.persist_failed", conv=conversation_id, error=str(e))

    return ChatResponse(
        conversation_id=conversation_id,
        conversation_title=title,
        messages=result["messages"],
        invocations=result["invocations"],
        reply=result["reply"],
    )
