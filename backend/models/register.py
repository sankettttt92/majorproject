# 

import uuid
from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from database import Base

class Register(Base):
    __tablename__ = "register"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    full_name = Column(String(150), nullable=False)
    phone = Column(String(20), nullable=False)
    emergency_phone = Column(String(20), nullable=False)
    address = Column(Text, nullable=True)
    password = Column(String(255), nullable=False)  # should be a hashed value, not plaintext
    created_at = Column(DateTime(timezone=True), server_default=func.now())