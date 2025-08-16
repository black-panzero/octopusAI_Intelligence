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
from app.routers.deals import router as deals_router

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

    yield

    # Cleanup on shutdown
    logger.info("Shutting down SmartBuy Backend")


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

    # Configure CORS for local development

    origins = [
        "http://localhost:3000",
        "https://shiny-giggle-7vvjp5gv747xcrjww-3000.app.github.dev"
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    # Add routers
    app.include_router(
        deals_router,
        prefix="/api/v1/deals",
        tags=["deals"]
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