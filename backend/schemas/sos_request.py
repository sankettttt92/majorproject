"""
schemas/sos_request.py
What the victim app sends to POST /sos.
"""
from pydantic import BaseModel, Field
from typing import Optional


class SOSRequest(BaseModel):
    user_id: str = Field(..., description="External user ID from the victim app")
    device_id: Optional[str] = Field(None, description="Device fingerprint / install ID")
    auth_token: str = Field(..., description="Token issued when the app was registered")

    latitude: float
    longitude: float
    accuracy_meters: Optional[float] = None

    incident_type: str = Field(default="SOS")
    detail: Optional[str] = Field(None, description="Free text from the victim, if any")

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "victim_8841",
                "device_id": "device_abc123",
                "auth_token": "tok_live_xxx",
                "latitude": 28.5852,
                "longitude": 77.31,
                "accuracy_meters": 12.5,
                "incident_type": "SOS",
                "detail": "Trapped on rooftop, water rising",
            }
        }