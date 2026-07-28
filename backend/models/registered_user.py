"""
models/registered_user.py

SQLAlchemy model for the registered_users table.
This is the actual table used for user registration and login.
Each user has a UUID which will be referenced by the incidents table.
"""

import uuid
from datetime import datetime

from sqlalchemy import Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Register(Base):
    __tablename__ = "register"

    # Primary Key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # User Information
    full_name: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    phone: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        unique=True,
    )

    emergency_phone: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    address: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Store hashed password (recommended)
    password: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
    )