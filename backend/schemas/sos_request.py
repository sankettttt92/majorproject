# """
# schemas/sos_request.py
# What the victim app sends to POST /sos.
# """
# from pydantic import BaseModel, Field
# from typing import Optional


# class SOSRequest(BaseModel):
#     user_id: str = Field(..., description="External user ID from the victim app")
#     device_id: Optional[str] = Field(None, description="Device fingerprint / install ID")
#     auth_token: str = Field(..., description="Token issued when the app was registered")

#     latitude: float
#     longitude: float
#     accuracy_meters: Optional[float] = None

#     incident_type: str = Field(default="SOS")
#     detail: Optional[str] = Field(None, description="Free text from the victim, if any")

#     class Config:
#         json_schema_extra = {
#             "example": {
#                 "user_id": "victim_8841",
#                 "device_id": "device_abc123",
#                 "auth_token": "tok_live_xxx",
#                 "latitude": 28.5852,
#                 "longitude": 77.31,
#                 "accuracy_meters": 12.5,
#                 "incident_type": "SOS",
#                 "detail": "Trapped on rooftop, water rising",
#             }
#         }

"""
schemas/sos_request.py
What the victim app sends to POST /sos.

NOTE: photo_url was removed. Photos/audio are attached via POST /media
using the same client-generated incident_id, both before and after /sos
is called (see models/media_upload.py for how ordering is handled). Having
a second "convenience" path for a photo on this payload created a silent
bug where the field was accepted but never persisted or linked anywhere.
Keep a single path for attaching media to avoid that class of bug.
"""
from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID


class SOSRequest(BaseModel):
    incident_id: UUID = Field(..., description="Client-generated ID, so media uploaded before SOS can be linked")
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
                "incident_id": "b3f1c2a0-1234-4a5b-9c6d-abcdef123456",
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