"""Hotpoint Africa — electronics; Magento-flavoured."""
from app.services.scrapers.magento2 import Magento2Scraper


class HotpointScraper(Magento2Scraper):
    slug = "hotpoint"
    name = "Hotpoint"
    base_url = "https://hotpointafrica.com"
