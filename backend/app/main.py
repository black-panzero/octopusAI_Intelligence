# main.py
"""
SmartBuy Backend - Milestone 1
Deal Aggregation Engine Entry Point
"""
import asyncio
import structlog
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.db.database import create_tables, get_database
from app.routers.admin import router as admin_router
from app.routers.auth import router as auth_router
from app.routers.cart import router as cart_router
from app.routers.chat import router as chat_router
from app.routers.deals import router as deals_router
from app.routers.products import router as products_router
from app.routers.recommendations import router as recommendations_router
from app.routers.rules import router as rules_router
from app.routers.merchant import router as merchant_router
from app.routers.shopping_lists import router as shopping_lists_router
from app.services.background_jobs import job_evaluate_all_rules, job_resolve_images
from app.services.scheduler import BackgroundScheduler

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management - startup and shutdown events."""
    logger.info("Starting SmartBuy Backend - Milestone 1")

    # Initialize database tables
    try:
        await create_tables()
        logger.info("Database tables initialized successfully")
    except Exception as e:
        logger.error("Failed to initialize database", error=str(e))
        raise

    # Boot the background scheduler. Jobs are per-app-instance, not
    # per-worker replica (move to Redis/Celery once we run >1 worker).
    scheduler = BackgroundScheduler()
    scheduler.add("resolve_missing_images", interval_seconds=300, coro=job_resolve_images,
                  first_run_delay=10)
    scheduler.add("evaluate_rules",          interval_seconds=900, coro=job_evaluate_all_rules,
                  first_run_delay=60)
    scheduler.start()
    app.state.scheduler = scheduler

    yield

    # Cleanup on shutdown
    logger.info("Shutting down SmartBuy Backend")
    await scheduler.shutdown()


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="SmartBuy Deal Aggregation Engine",
        description="Milestone 1: Foundation and Deal Aggregation Backend",
        version="1.0.0",
        openapi_url="/api/v1/openapi.json",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
        debug=settings.debug
    )

    # Configure CORS for local development + any GitHub Codespaces URL.
    # The regex matches https://<codespace-name>-<port>.app.github.dev so the
    # frontend at the forwarded :3000 URL can hit the backend without hardcoding
    # a specific Codespace name.
    codespaces_regex = (
        r"^(https?://(localhost|127\.0\.0\.1)(:\d+)?"
        r"|https://[a-z0-9-]+-\d+\.app\.github\.dev"
        r"|https://[a-z0-9-]+-\d+\.githubpreview\.dev)$"
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_origin_regex=codespaces_regex,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allow_headers=["*"],
    )

    # Add routers
    app.include_router(
        auth_router,
        prefix="/api/v1/auth",
        tags=["auth"]
    )
    app.include_router(
        deals_router,
        prefix="/api/v1/deals",
        tags=["deals"]
    )
    app.include_router(
        products_router,
        prefix="/api/v1/products",
        tags=["products"]
    )
    app.include_router(
        cart_router,
        prefix="/api/v1/cart",
        tags=["cart"]
    )
    app.include_router(
        rules_router,
        prefix="/api/v1/rules",
        tags=["rules"]
    )
    app.include_router(
        chat_router,
        prefix="/api/v1/chat",
        tags=["chat"]
    )
    app.include_router(
        recommendations_router,
        prefix="/api/v1/recommendations",
        tags=["recommendations"]
    )
    app.include_router(
        shopping_lists_router,
        prefix="/api/v1/shopping-lists",
        tags=["shopping-lists"]
    )
    app.include_router(
        merchant_router,
        prefix="/api/v1/merchant",
        tags=["merchant"]
    )
    app.include_router(
        admin_router,
        prefix="/api/v1/admin",
        tags=["admin"]
    )

    @app.get("/", response_class=JSONResponse)
    async def root():
        """Root endpoint - health check and basic info."""
        return {
            "message": "SmartBuy Deal Aggregation Engine",
            "milestone": "1 - Foundation and Deal Aggregation",
            "status": "running",
            "docs": "/docs",
            "version": "1.0.0"
        }

    @app.get("/health", response_class=JSONResponse)
    async def health_check():
        """Health check endpoint."""
        try:
            # Test database connection
            async with get_database() as db:
                await db.execute("SELECT 1")
            return {"status": "healthy", "database": "connected"}
        except Exception as e:
            logger.error("Health check failed", error=str(e))
            return {"status": "unhealthy", "database": "disconnected", "error": str(e)}

    return app


# Create the app instance
app = create_app()

if __name__ == "__main__":
    import uvicorn

    settings = get_settings()

    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="info"
    )