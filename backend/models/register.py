from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from database import Base  # shared declarative base from database.py

class Register(Base):
    __tablename__ = "register"
    id = Column(Integer , primary_key=True , index=True)
    full_name = Column(String(150) , nullable=False)
    phone = Column(String(20) , nullable=False)
    emergency_phone = Column(String(20),nullable=False)
    address = Column(Text , nullable=True)
    created_at = Column(DateTime(timezone=True),server_default=func.now())