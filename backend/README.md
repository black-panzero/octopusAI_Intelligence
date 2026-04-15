# SmartBuy Deal Aggregation Engine - Backend API

## Overview

The SmartBuy Deal Aggregation Engine is a robust FastAPI-based backend system designed to manage and aggregate shopping deals from various merchants. This system provides a foundation for a hybrid, AI-powered shopping platform with comprehensive deal management capabilities.

## 🏗️ Architecture

The system follows a modular, domain-driven architecture with clear separation of concerns:

```
backend/
├── app/                    # Main application package
│   ├── core/              # Core configuration and utilities
│   │   ├── __init__.py
│   │   └── config.py      # Application settings and configuration
│   ├── db/                # Database layer
│   │   ├── models/        # SQLAlchemy ORM models
│   │   │   ├── __init__.py
│   │   │   └── deals.py   # Deal entity model
│   │   ├── __init__.py
│   │   └── database.py    # Database configuration and session management
│   ├── routers/           # API route handlers
│   │   ├── __init__.py
│   │   └── deals.py       # Deal endpoints and business logic
│   ├── schemas/           # Pydantic models for validation
│   │   ├── __init__.py
│   │   └── deals.py       # Deal request/response schemas
│   ├── config.py          # Legacy configuration (backward compatibility)
│   └── main.py           # FastAPI application entry point
├── .env                   # Environment configuration
├── .gitignore            # Git ignore rules
├── .python-version       # Python version specification
├── __init__.py           # Package initialization
├── pyproject.toml        # Modern Python project configuration
├── requirements.txt      # Dependency list
├── README.md            # This documentation
└── uv.lock              # UV package manager lockfile
```

## 🚀 Features

### Current Features (Milestone 1)

- **Deal Management**: Create and retrieve shopping deals with comprehensive validation
- **Merchant Filtering**: Filter deals by merchant with case-insensitive search
- **Automatic Calculations**: Real-time computation of discounted prices and savings
- **Expiry Tracking**: Automatic deal expiry status calculation
- **Statistics Dashboard**: Comprehensive deal statistics and analytics
- **Robust Validation**: Pydantic-based input validation with detailed error messages
- **Database Management**: SQLAlchemy ORM with automatic table creation
- **API Documentation**: Auto-generated Swagger UI and ReDoc documentation
- **Health Monitoring**: Built-in health checks and performance metrics
- **Error Handling**: Comprehensive exception handling with proper HTTP status codes

### Domain Model

**Core Entity: Deal**
- Represents shopping offers from various merchants
- Contains product information, pricing, and merchant details
- Tracks deal lifecycle with creation and expiry timestamps
- Calculates discount savings automatically

**Key Workflows:**
1. **Deal Creation**: Validate and store new deals with merchant and product info
2. **Deal Retrieval**: Query deals with filtering and pagination support
3. **Statistics Generation**: Analyze deal trends and merchant performance

## 🛠️ Technical Stack

- **Framework**: FastAPI 0.104+ (Modern, high-performance web framework)
- **Database**: SQLite with SQLAlchemy 2.0+ ORM
- **Validation**: Pydantic 2.5+ for data validation and serialization
- **Configuration**: Pydantic Settings for environment-based configuration
- **Documentation**: Auto-generated OpenAPI/Swagger documentation
- **Package Management**: UV (recommended) or pip
- **Python Version**: 3.12+

## 📋 Prerequisites

- Python 3.12 or higher
- UV package manager (recommended) or pip
- SQLite (included with Python)

## 🚀 Quick Start

### 1. Clone and Setup

```bash
# Navigate to the backend directory
cd backend

# Create virtual environment with UV (recommended)
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Or with standard Python
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

### 2. Install Dependencies

```bash
# With UV (recommended)
uv pip install -r requirements.txt

# Or with pip
pip install -r requirements.txt
```

### 3. Configuration

```bash
# Copy environment template
cp .env.example .env  # If example exists, or create .env manually

# Edit .env file with your preferences
# Default values should work for local development
```

### 4. Run the Application

```bash
# Start the development server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Or run directly
cd app
python main.py
```

### 5. Access the API

- **API Documentation (Swagger)**: http://localhost:8000/docs
- **Alternative Documentation (ReDoc)**: http://localhost:8000/redoc
- **API Root**: http://localhost:8000/
- **Health Check**: http://localhost:8000/health
- **API Information**: http://localhost:8000/api/info

## 📚 API Endpoints

### Deal Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/deals/` | Create a new deal |
| `GET` | `/api/v1/deals/` | List all deals with pagination |
| `GET` | `/api/v1/deals/{deal_id}` | Get specific deal by ID |
| `GET` | `/api/v1/deals/merchant/{merchant_name}` | Get deals by merchant |
| `GET` | `/api/v1/deals/stats/summary` | Get deal statistics |

### System Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | API root information |
| `GET` | `/health` | Health check endpoint |
| `GET` | `/api/info` | Detailed API information |

## 🔧 Usage Examples

### Creating a Deal

```bash
curl -X POST "http://localhost:8000/api/v1/deals/" \
     -H "Content-Type: application/json" \
     -d '{
       "product_name": "Rice 5kg Premium Quality",
       "price": 180.0,
       "discount": 20.0,
       "merchant": "Naivas Supermarket",
       "expiry": "2025-08-20T23:59:59",
       "description": "High-quality premium rice with 20% discount"
     }'
```

### Retrieving Deals

```bash
# Get all deals
curl "http://localhost:8000/api/v1/deals/"

# Get deals with pagination
curl "http://localhost:8000/api/v1/deals/?skip=0&limit=10"

# Filter by merchant
curl "http://localhost:8000/api/v1/deals/merchant/Naivas"

# Get deal statistics
curl "http://localhost:8000/api/v1/deals/stats/summary"
```

## 🗄️ Database Schema

### Deal Table

```sql
CREATE TABLE deals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_name VARCHAR(255) NOT NULL,
    price FLOAT NOT NULL,
    discount FLOAT,
    merchant VARCHAR(100) NOT NULL,
    expiry DATETIME NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🧪 Testing

### Using Swagger UI (Recommended for Milestone 1)

1. Navigate to http://localhost:8000/docs
2. Use the interactive interface to test endpoints
3. Create deals using the POST endpoint
4. Retrieve and filter deals using GET endpoints

### Using curl or HTTP Clients

```bash
# Health check
curl http://localhost:8000/health

# Create sample deal
curl -X POST http://localhost:8000/api/v1/deals/ \
     -H "Content-Type: application/json" \
     -d '{"product_name": "Test Product", "price": 100.0, "merchant": "Test Store", "expiry": "2025-12-31T23:59:59"}'
```

## 🔧 Configuration

The application uses environment-based configuration through `.env` file:

```bash
# Application Settings
APP_NAME="SmartBuy Deal Aggregation Engine"
DEBUG=true
LOG_LEVEL="INFO"

# Database
DATABASE_URL="sqlite:///./database.db"

# API
API_V1_STR="/api/v1"
DOCS_URL="/docs"

# CORS (for future frontend)
BACKEND_CORS_ORIGINS="http://localhost:3000,http://localhost:8000"
```

## 📊 Monitoring and Logging

- **Logs**: Application logs are written to `app.log` and console
- **Performance**: Response times are tracked via `X-Process-Time` header
- **Health Checks**: `/health` endpoint provides database connectivity status
- **Statistics**: `/api/v1/deals/stats/summary` provides deal analytics

## 🚧 Development Guidelines

### Code Structure Principles

1. **Domain-Driven Design**: Models represent real business entities
2. **Separation of Concerns**: Clear boundaries between layers
3. **Dependency Injection**: Use FastAPI's dependency system
4. **Type Safety**: Full type hints and Pydantic validation
5. **Error Handling**: Comprehensive exception handling

### Adding New Features

1. **Models**: Add SQLAlchemy models in `app/db/models/`
2. **Schemas**: Create Pydantic schemas in `app/schemas/`
3. **Routes**: Implement endpoints in `app/routers/`
4. **Tests**: Use Swagger UI for manual testing

## 🔮 Future Roadmap

### Milestone 2 Planned Features

- Deal update and deletion endpoints
- Advanced filtering (price range, category)
- User authentication and authorization
- Deal favorites and watchlists
- Email notifications for deal expiry
- Batch operations for deals

### Long-term Vision

- AI-powered deal recommendations
- External merchant API integrations
- Real-time deal updates via WebSockets
- Machine learning for price predictions
- Mobile app API support
- Microservices architecture migration

## 🤝 Contributing

This is the initial implementation focusing on core functionality. Future contributions should follow:

1. Domain modeling before technical implementation
2. Comprehensive validation and error handling
3. Performance considerations for scalability
4. Clear documentation and examples

## 📄 License

This project is licensed under the MIT License. See the LICENSE file for details.

## 🆘 Support

For issues and questions:

1. Check the API documentation at `/docs`
2. Review the health check at `/health`
3. Examine application logs in `app.log`
4. Use the statistics endpoint for debugging data issues

---

**Built with FastAPI and designed for scalability, performance, and developer experience.** 🚀