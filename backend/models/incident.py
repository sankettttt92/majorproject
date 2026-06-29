"""
models/incident.py
The PostgreSQL table that stores every SOS / incident.
This is the single source of truth right now (no Redis cache in front of it yet).
"""
import uuid
import enum
from datetime import datetime

from sqlalchemy import String, Float, DateTime, Enum, Text, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class IncidentSeverity(str, enum.Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class IncidentStatus(str, enum.Enum):
    PENDING = "PENDING"          # just received, not yet triaged
    VERIFIED = "VERIFIED"        # passed validation checks
    DISPATCHED = "DISPATCHED"    # a team has been sent
    RESOLVED = "RESOLVED"
    REJECTED = "REJECTED"        # failed validation (e.g. spoofed location)


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Who sent it
    user_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    device_id: Mapped[str] = mapped_column(String(128), nullable=True)

    # Where
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    accuracy_meters: Mapped[float] = mapped_column(Float, nullable=True)
    address: Mapped[str] = mapped_column(Text, nullable=True)
    zone: Mapped[str] = mapped_column(String(128), nullable=True)  # e.g. "DELHI SECTOR 4"

    # What
    incident_type: Mapped[str] = mapped_column(String(64), default="SOS")
    severity: Mapped[IncidentSeverity] = mapped_column(
        Enum(IncidentSeverity), default=IncidentSeverity.MODERATE
    )
    status: Mapped[IncidentStatus] = mapped_column(
        Enum(IncidentStatus), default=IncidentStatus.PENDING
    )
    detail: Mapped[str] = mapped_column(Text, nullable=True)

    # Scoring (filled in by validation/scorer.py)
    trust_score: Mapped[int] = mapped_column(Integer, default=0)   # 0-100, is this a real user?
    risk_score: Mapped[int] = mapped_column(Integer, default=0)    # 0-100, how urgent is it?
    priority: Mapped[int] = mapped_column(Integer, default=0)      # final rank used for sorting

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )