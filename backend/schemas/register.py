from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class RegisterCreate(BaseModel):
    fullName: str
    phone: str
    emergencyPhone: str
    address: Optional[str] = None

class RegisterOut(BaseModel):
    id: int
    fullName: str
    phone: str
    createdAt: datetime

    class Config:
        from_attributes = True