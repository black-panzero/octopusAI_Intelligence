"""
Real-merchant adapter registry.

Empty by default — the search endpoint now reads from the seeded DB
catalog (app/db/seed.py). To plug a live scraper in later:
  1. Create <slug>.py implementing MerchantAdapter.search()
  2. Append an instance to `ADAPTERS` below
  3. Wire a background job that calls each adapter on a schedule and
     INSERTs PriceSnapshot rows — the catalog service will surface
     them automatically.
"""
from app.services.aggregation.base import MerchantAdapter

ADAPTERS: list[MerchantAdapter] = []
