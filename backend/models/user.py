"""
models/user.py
Minimal victim/user table — enough to back identity.py and device_trust.py.
Extend with auth fields (hashed_password, phone OTP, etc) when you add real login.
"""
import uuid
from datetime import datetime

from sqlalchemy import String, Float, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    external_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    phone_number: Mapped[str] = mapped_column(String(20), nullable=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=True)

    registered_device_id: Mapped[str] = mapped_column(String(128), nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    last_known_lat: Mapped[float] = mapped_column(Float, nullable=True)
    last_known_lon: Mapped[float] = mapped_column(Float, nullable=True)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)