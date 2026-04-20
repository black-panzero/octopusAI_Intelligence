"""
Persistent chat conversation + its turns.

A Conversation belongs to a user; ChatTurn stores one message in order.
Each assistant turn that triggered tool calls keeps its `invocations`
inline so reloading a conversation later can rebuild the full widget UI.
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False, default="New conversation")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now(),
    )

    turns: Mapped[list["ChatTurn"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan",
        order_by="ChatTurn.seq", lazy="selectin",
    )


class ChatTurn(Base):
    __tablename__ = "chat_turns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    seq: Mapped[int] = mapped_column(Integer, nullable=False)

    role: Mapped[str] = mapped_column(String(16), nullable=False)  # user | assistant | tool
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Raw OpenAI-format tool-call request on an assistant turn.
    tool_calls: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    # For tool-role turns: the id of the tool call we're answering.
    tool_call_id: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)

    # Structured invocations rendered by the UI widgets, paired with this
    # assistant turn's tool_calls by tool_call_id.
    invocations: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )

    conversation: Mapped[Conversation] = relationship(back_populates="turns")
