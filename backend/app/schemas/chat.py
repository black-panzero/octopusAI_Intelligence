"""Chat API schemas."""
from typing import Any, Optional

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """A single message in the conversation. Mirrors the OpenAI schema."""

    role: str = Field(..., description="user | assistant | tool")
    content: Optional[str] = Field(default=None)
    tool_calls: Optional[list[dict]] = Field(default=None)
    tool_call_id: Optional[str] = Field(default=None)
    name: Optional[str] = Field(default=None)


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


class ToolInvocation(BaseModel):
    id: str
    tool: str
    arguments: dict
    result: Any


class ChatResponse(BaseModel):
    messages: list[ChatMessage]
    invocations: list[ToolInvocation]
    reply: str
