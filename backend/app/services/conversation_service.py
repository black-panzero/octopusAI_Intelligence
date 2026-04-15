"""
Conversation persistence — list, fetch, rename, delete, replace-turns.

`replace_turns` is the hot path after each chat call: we wipe the
conversation's existing turns and write the full transcript returned by
the chat runner, pairing invocations to the assistant turns that triggered
them.
"""
from datetime import datetime, timezone
from typing import Optional

import structlog
from sqlalchemy import delete, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.conversation import ChatTurn, Conversation

logger = structlog.get_logger(__name__)


def suggest_title(first_user_message: str) -> str:
    """Auto-title a conversation from its opening user message."""
    text = (first_user_message or "").strip()
    if not text:
        return "New conversation"
    text = " ".join(text.split())
    if len(text) <= 60:
        return text
    truncated = text[:60].rsplit(" ", 1)[0]
    return (truncated or text[:60]) + "…"


class ConversationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------
    async def list_for_user(self, user_id: int) -> list[dict]:
        stmt = (
            select(Conversation)
            .where(Conversation.user_id == user_id)
            .order_by(desc(Conversation.updated_at))
        )
        convs = (await self.db.execute(stmt)).scalars().all()
        return [self._conv_summary(c) for c in convs]

    async def get(self, user_id: int, conv_id: int) -> Optional[Conversation]:
        stmt = select(Conversation).where(
            Conversation.id == conv_id, Conversation.user_id == user_id,
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def get_with_turns(self, user_id: int, conv_id: int) -> Optional[dict]:
        conv = await self.get(user_id, conv_id)
        if conv is None:
            return None
        messages, invocations = [], []
        for t in conv.turns:
            msg = {"role": t.role}
            if t.content is not None:
                msg["content"] = t.content
            if t.tool_calls:
                msg["tool_calls"] = t.tool_calls
            if t.tool_call_id:
                msg["tool_call_id"] = t.tool_call_id
            if t.name:
                msg["name"] = t.name
            messages.append(msg)
            if t.invocations:
                invocations.extend(t.invocations)
        return {
            **self._conv_summary(conv),
            "messages": messages,
            "invocations": invocations,
        }

    async def create(self, user_id: int, title: str = "New conversation") -> Conversation:
        conv = Conversation(user_id=user_id, title=title)
        self.db.add(conv)
        await self.db.commit()
        await self.db.refresh(conv)
        return conv

    async def delete(self, user_id: int, conv_id: int) -> bool:
        conv = await self.get(user_id, conv_id)
        if conv is None:
            return False
        await self.db.delete(conv)
        await self.db.commit()
        return True

    async def rename(self, user_id: int, conv_id: int, title: str) -> Optional[Conversation]:
        conv = await self.get(user_id, conv_id)
        if conv is None:
            return None
        conv.title = (title or "").strip()[:200] or "New conversation"
        await self.db.commit()
        await self.db.refresh(conv)
        return conv

    # ------------------------------------------------------------------
    # Transcript persistence
    # ------------------------------------------------------------------
    async def replace_turns(
        self, conv_id: int, messages: list[dict], invocations: list[dict],
    ) -> None:
        """Delete all existing turns for this conversation and store the
        new transcript in one transaction."""
        inv_by_id = {inv.get("id"): inv for inv in (invocations or []) if inv.get("id")}

        await self.db.execute(
            delete(ChatTurn).where(ChatTurn.conversation_id == conv_id)
        )

        for idx, m in enumerate(messages or []):
            role = m.get("role", "user")
            paired_invs = None
            if role == "assistant" and m.get("tool_calls"):
                paired_invs = []
                for tc in m["tool_calls"]:
                    inv = inv_by_id.get(tc.get("id"))
                    if inv is not None:
                        paired_invs.append(inv)
                if not paired_invs:
                    paired_invs = None

            self.db.add(ChatTurn(
                conversation_id=conv_id,
                seq=idx,
                role=role,
                content=m.get("content"),
                tool_calls=m.get("tool_calls"),
                tool_call_id=m.get("tool_call_id"),
                name=m.get("name"),
                invocations=paired_invs,
            ))

        # Bump the conversation's updated_at so sidebars sort correctly.
        conv = (await self.db.execute(
            select(Conversation).where(Conversation.id == conv_id)
        )).scalar_one_or_none()
        if conv is not None:
            conv.updated_at = datetime.now(timezone.utc)

        await self.db.commit()

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------
    def _conv_summary(self, conv: Conversation) -> dict:
        return {
            "id": conv.id,
            "title": conv.title,
            "created_at": conv.created_at.isoformat() if conv.created_at else None,
            "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
        }
