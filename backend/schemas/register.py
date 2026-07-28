# from pydantic import BaseModel
# from typing import Optional
# from datetime import datetime

# class RegisterCreate(BaseModel):
#     fullName: str
#     phone: str
#     emergencyPhone: str
#     address: Optional[str] = None

# class RegisterOut(BaseModel):
#     id: int
#     fullName: str
#     phone: str
#     createdAt: datetime

#     class Config:
#         from_attributes = True

from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime
from uuid import UUID


class RegisterCreate(BaseModel):
    fullName: str
    phone: str
    emergencyPhone: str
    address: Optional[str] = None
    password: str = Field(..., min_length=6)

    @field_validator("password")
    @classmethod
    def validate_password_length(cls, v: str) -> str:
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 bytes long")
        return v
class RegisterOut(BaseModel):
    id: UUID
    fullName: str
    phone: str
    createdAt: datetime

    class Config:
        from_attributes = True