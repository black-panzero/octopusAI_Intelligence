# app/schemas/deal.py
"""
Pydantic schemas for Deal data validation and serialization
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict, field_validator


class DealBase(BaseModel):
    """Base schema for Deal with common fields."""
    
    product_name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Name of the product or service on offer",
        examples=["Rice 5kg", "Samsung Galaxy S24", "MacBook Air M3"]
    )
    
    price: float = Field(
        ...,
        gt=0,
        description="Original price of the product",
        examples=[180.0, 15000.0, 89999.99]
    )
    
    discount: Optional[float] = Field(
        default=None,
        ge=0,
        description="Discount percentage (0-100) or fixed amount",
        examples=[20.0, 10.5, 1500.0]
    )
    
    merchant: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Store or provider offering the deal",
        examples=["Naivas", "Jumia", "Carrefour", "Kilimall"]
    )
    
    expiry: Optional[datetime] = Field(
        default=None,
        description="Expiration date and time of the deal",
        examples=["2025-08-20T23:59:59"]
    )
    
    description: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Optional description of the deal"
    )
    
    category: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Product category",
        examples=["Groceries", "Electronics", "Clothing", "Home & Garden"]
    )
    
    original_url: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Original URL where the deal was found"
    )
    
    @field_validator('discount')
    @classmethod
    def validate_discount(cls, v):
        """Validate discount value."""
        if v is not None and v < 0:
            raise ValueError('Discount cannot be negative')
        return v

    @field_validator('expiry')
    @classmethod
    def validate_expiry_date(cls, v):
        """Validate expiry date is not in the past (tz-safe)."""
        if v is None:
            return v
        now = datetime.now(v.tzinfo) if v.tzinfo else datetime.now()
        if v < now:
            raise ValueError('Expiry date cannot be in the past')
        return v


class DealCreate(DealBase):
    """Schema for creating a new deal."""

    model_config = ConfigDict(
        json_encoders={
            datetime: lambda v: v.isoformat() if v else None
        },
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "product_name": "Rice 5kg Premium Quality",
                "price": 180.0,
                "discount": 20.0,
                "merchant": "Naivas Supermarket",
                "expiry": "2025-08-20T23:59:59",
                "description": "High quality basmati rice, perfect for family meals",
                "category": "Groceries",
                "original_url": "https://naivas.co.ke/deals/rice-5kg"
            }
        }
    )


class DealUpdate(BaseModel):
    """Schema for updating an existing deal."""
    
    model_config = ConfigDict(
        str_strip_whitespace=True
    )
    
    product_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    price: Optional[float] = Field(default=None, gt=0)
    discount: Optional[float] = Field(default=None, ge=0)
    merchant: Optional[str] = Field(default=None, min_length=1, max_length=100)
    expiry: Optional[datetime] = Field(default=None)
    description: Optional[str] = Field(default=None, max_length=1000)
    category: Optional[str] = Field(default=None, max_length=100)
    original_url: Optional[str] = Field(default=None, max_length=500)
    is_active: Optional[bool] = Field(default=None)


class DealResponse(DealBase):
    """Schema for Deal responses including database fields."""
    
    model_config = ConfigDict(
        from_attributes=True,
        json_encoders={
            datetime: lambda v: v.isoformat() if v else None
        }
    )
    
    id: int = Field(description="Unique identifier for the deal")
    created_at: datetime = Field(description="When the deal was created")
    updated_at: datetime = Field(description="When the deal was last updated")
    is_active: bool = Field(description="Whether the deal is currently active")
    
    # Computed fields
    @property
    def discounted_price(self) -> Optional[float]:
        """Calculate discounted price."""
        if self.discount is None:
            return None
        
        if 0 < self.discount <= 100:
            # Percentage discount
            return self.price * (1 - self.discount / 100)
        elif self.discount > 0:
            # Fixed amount discount
            return max(0, self.price - self.discount)
        
        return self.price
    
    @property
    def savings_amount(self) -> Optional[float]:
        """Calculate savings amount."""
        discounted = self.discounted_price
        if discounted is None:
            return None
        return self.price - discounted
    
    @property
    def savings_percentage(self) -> Optional[float]:
        """Calculate savings as percentage."""
        savings = self.savings_amount
        if savings is None or self.price == 0:
            return None
        return (savings / self.price) * 100
    
    @property
    def is_expired(self) -> bool:
        """Check if deal is expired."""
        if self.expiry is None:
            return False
        return datetime.now() > self.expiry


class DealListResponse(BaseModel):
    """Schema for paginated deal list responses."""
    
    deals: list[DealResponse] = Field(description="List of deals")
    total: int = Field(description="Total number of deals")
    page: int = Field(description="Current page number")
    size: int = Field(description="Number of deals per page")
    has_next: bool = Field(description="Whether there are more pages")
    has_prev: bool = Field(description="Whether there are previous pages")


