"""
Pydantic schemas for authentication endpoints.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRegister(BaseModel):
    """Payload for /auth/register."""

    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=8, max_length=128, description="Plain password")
    full_name: Optional[str] = Field(default=None, max_length=120)


class UserLogin(BaseModel):
    """Payload for /auth/login (JSON variant)."""

    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class UserResponse(BaseModel):
    """Public user representation."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: Optional[str] = None
    is_active: bool
    is_superuser: bool
    created_at: datetime


class Token(BaseModel):
    """OAuth2 bearer token response."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Lifetime of the token, in seconds")
    user: UserResponse
