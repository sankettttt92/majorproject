from fastapi import APIRouter , HTTPException , Depends
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from schemas.register import RegisterCreate
from services.register_services import create_registration
from services.register_services import get_registration_by_phone
from pydantic import BaseModel
class LoginRequest(BaseModel):
   phone:str

# create a api route for the register 
router = APIRouter(prefix="/api" , tags=["register"])
# we have to post the values to the router so we will use the post method of the api

@router.post("/register")
async def register(data: RegisterCreate , db: AsyncSession  = Depends(get_db)):
# data -> get the data from JSON object and validate though the RegisterCreate schema in service layer 
#  db -> create a post reg for each session via get db 
 try:
     
    #  store the data to the postgress via service layer 
    entry = await create_registration(db , data)
    # send bacl the saved record as a JSON 
    return{
        "id" : entry.id,
        "fullName": entry.full_name,
        "phone": entry.phone,
        "createdAt" :entry.created_at,
    }
 except Exception as e:
    #  any error in api retunr me the HTTP req
    raise HTTPException(status_code=500 , detail=str(e)) 

# login api 
@router.post("/login")
async def login(data:LoginRequest , db:AsyncSession= Depends(get_db)):
   entry = await get_registration_by_phone(data.phone , db)
   if not entry:
      raise HTTPException(status_code=404 , detail="No account found for this phone number")
   return{
      "id":entry.id,
      "fullName":entry.full_name,
      "phone": entry.phone,
      "emergencyPhone": entry.emergency_phone,
      "address": entry.address,
      "createdAt": entry.created_at,
   }