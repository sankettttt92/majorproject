"""
schemas/location_ping.py
Request/response shapes for the GPS ping endpoint (victim app -> backend,
every 5-10 sec) and for the prediction response (backend -> dashboard/volunteer app).
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class LocationPingCreate(BaseModel):
    latitude: float
    longitude: float
    speed: Optional[float] = Field(None, description="m/s")
    heading: Optional[float] = Field(None, description="0-360 degrees")
    accuracy: Optional[float] = Field(None, description="GPS accuracy in meters")

    class Config:
        json_schema_extra = {
            "example": {
                "latitude": 19.2184,
                "longitude": 73.2385,
                "speed": 1.3,
                "heading": 91,
                "accuracy": 8.0,
            }
        }


class LocationPingOut(BaseModel):
    id: UUID
    incident_id: UUID
    latitude: float
    longitude: float
    speed: Optional[float]
    heading: Optional[float]
    accuracy: Optional[float]
    recorded_at: datetime

    class Config:
        from_attributes = True


class PredictionOut(BaseModel):
    incident_id: UUID
    last_latitude: float
    last_longitude: float
    last_recorded_at: datetime
    offline_minutes: float
    average_speed: Optional[float]
    heading: Optional[float]
    estimated_distance_meters: Optional[float]
    is_offline: bool
    history: List[LocationPingOut]