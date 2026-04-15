"""
Registry of available merchant adapters.

To add a new merchant: create an adapter file, import it here, and append
an instance to `DEFAULT_ADAPTERS`. The AggregationService will pick it up.
"""
from app.services.aggregation.adapters.carrefour import MockCarrefourAdapter
from app.services.aggregation.adapters.naivas import MockNaivasAdapter
from app.services.aggregation.adapters.quickmart import MockQuickmartAdapter
from app.services.aggregation.base import MerchantAdapter


DEFAULT_ADAPTERS: list[MerchantAdapter] = [
    MockNaivasAdapter(),
    MockCarrefourAdapter(),
    MockQuickmartAdapter(),
]

__all__ = [
    "DEFAULT_ADAPTERS",
    "MockNaivasAdapter",
    "MockCarrefourAdapter",
    "MockQuickmartAdapter",
]
