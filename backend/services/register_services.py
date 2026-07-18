# service file is the file that actually talks to the databbase 
# router/register.py gets the HTTP req and it send to the sevice layer and it takes thr clean data and insert to the db
from sqlalchemy.ext.asyncio import AsyncSession
from models.register import Register
from schemas.register import RegisterCreate
from sqlalchemy import select

# takes the validate data from router and db and insert a new row 
async def create_registration(db:AsyncSession , data: RegisterCreate)->Register:
    # get the vlaues form the field 
    entry =Register(
        full_name = data.fullName,
        phone = data.phone,
        address = data.address,  
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry
async def get_registration_by_phone(db:AsyncSession , phone:str) -> Register | None:
    result= await db.execute(select(Register).where(Register.phone== phone))
    return result.scalar_one_or_none()