"""Masoko (Safaricom) — Magento 2 storefront."""
from app.services.scrapers.magento2 import Magento2Scraper


class MasokoScraper(Magento2Scraper):
    slug = "masoko"
    name = "Masoko"
    base_url = "https://www.masoko.com"
