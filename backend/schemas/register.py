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

from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID

class RegisterCreate(BaseModel):
    fullName: str
    phone: str
    emergencyPhone: str
    address: Optional[str] = None
    password: str

class RegisterOut(BaseModel):
    id: UUID
    fullName: str
    phone: str
    createdAt: datetime

    class Config:
        from_attributes = True