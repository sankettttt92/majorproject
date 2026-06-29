"""
database.py
Async SQLAlchemy engine + session factory for PostgreSQL.
Every router gets a DB session through the get_db() dependency.

NOTE: Tables are NOT auto-created by this app. The schema is created
manually by running schema.sql against your Postgres database (see
README.md, "Manual schema setup"). The SQLAlchemy models in models/ are
used only to build queries (select/insert/update) — they must stay in sync
with schema.sql by hand, since there's no migration tool wired up yet.
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

from config import DATABASE_URL

# echo=False in prod. Set True locally if you want to see generated SQL.
engine = create_async_engine(DATABASE_URL, echo=False, future=True)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()


async def get_db():
    """FastAPI dependency — yields a DB session per request, closes it after."""
    async with AsyncSessionLocal() as session:
        yield session