"""
config.py
Loads environment variables for the whole app.
Reads from a .env file in local dev; in production these come from
real environment variables set by your host (Render, Railway, EC2, etc).
"""
import os
from dotenv import load_dotenv

load_dotenv()  # reads .env if present, no-ops in prod if you set real env vars

DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/disaster_response",
)

# Redis is NOT used yet — kept here so adding it later is a one-line change.
REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me-in-production")

# Comma separated list of origins allowed to call this API (your dashboard URL, app URL)
CORS_ORIGINS: list[str] = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")

# Max allowed distance (meters) between GPS fix and last known location before
# it's flagged as suspicious in validation/location.py
MAX_LOCATION_JUMP_METERS: int = int(os.getenv("MAX_LOCATION_JUMP_METERS", "50000"))