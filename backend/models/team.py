"""
models/team.py
The PostgreSQL table that stores every field asset — rescue teams, boats,
medical units, and police/NGO security units. Mirrors the resource grid
shown on the dashboard's Resource Allocation Center page.
"""
import uuid
import enum
from datetime import datetime

from sqlalchemy import String, Float, DateTime, Enum, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class TeamCategory(str, enum.Enum):
    RESCUE_TEAM = "rescue_team"
    BOAT = "boat"
    MEDICAL_UNIT = "medical_unit"
    SECURITY_UNIT = "security_unit"


class TeamOrgType(str, enum.Enum):
    NDRF = "NDRF"
    SDRF = "SDRF"
    POLICE = "POLICE"
    NGO = "NGO"
    RED_CROSS = "RED_CROSS"
    FIRE = "FIRE"
    MEDICAL = "MEDICAL"
    CIVIL_DEFENCE = "CIVIL_DEFENCE"


class TeamStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    DEPLOYED = "DEPLOYED"
    MAINTENANCE = "MAINTENANCE"
    OFFLINE = "OFFLINE"
    COMPLETED = "COMPLETED"


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[TeamCategory] = mapped_column(
        Enum(TeamCategory, values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        nullable=False,
    )
    org_type: Mapped[TeamOrgType] = mapped_column(
        Enum(TeamOrgType, values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        nullable=False,
    )
    status: Mapped[TeamStatus] = mapped_column(
        Enum(TeamStatus, values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        default=TeamStatus.AVAILABLE,
    )

    capacity: Mapped[int] = mapped_column(Integer, nullable=True)
    base: Mapped[str] = mapped_column(String(128), nullable=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=True)
    longitude: Mapped[float] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    current_lat: Mapped[float] = mapped_column(Float, nullable=True)
    current_lng: Mapped[float] = mapped_column(Float, nullable=True)
    last_ping_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)