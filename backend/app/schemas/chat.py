"""Chat + conversation API schemas."""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str = Field(..., description="user | assistant | tool")
    content: Optional[str] = Field(default=None)
    tool_calls: Optional[list[dict]] = Field(default=None)
    tool_call_id: Optional[str] = Field(default=None)
    name: Optional[str] = Field(default=None)


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    conversation_id: Optional[int] = None


class ToolInvocation(BaseModel):
    id: str
    tool: str
    arguments: dict
    result: Any


class ChatResponse(BaseModel):
    conversation_id: int
    conversation_title: str
    messages: list[ChatMessage]
    invocations: list[ToolInvocation]
    reply: str


class ConversationSummary(BaseModel):
    id: int
    title: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ConversationDetail(ConversationSummary):
    messages: list[ChatMessage]
    invocations: list[ToolInvocation]


class RenameConversationIn(BaseModel):
    title: str
