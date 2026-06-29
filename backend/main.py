"""
main.py
App entrypoint. Run with:
    uvicorn main:socket_app --reload --host 0.0.0.0 --port 8000

IMPORTANT: always run `socket_app`, not `app` — socket_app wraps FastAPI
with Socket.IO so both HTTP routes and the websocket live on the same port.
"""


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio

from sqlalchemy import text
from routers import sos, incidents, resources, teams, missions
from config import CORS_ORIGINS
from database import engine
from socket_manager import sio


app = FastAPI(title="Disaster Response API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sos.router)
app.include_router(resources.router)
app.include_router(incidents.router)
app.include_router(teams.router)
app.include_router(missions.router)



@app.get("/health")
async def health():
    return {"status": "ok"}


@app.on_event("startup")
async def on_startup():
    """
    Tables are created manually by running schema.sql (see README).
    On startup we just confirm the expected tables already exist.

    teams + incident_allocations back the Resource Allocation Center
    (routers/resources.py) — added alongside users/incidents. Run
    schema_additions.sql against your database if these are missing.
    """
    async with engine.begin() as conn:
        result = await conn.execute(
            text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_name IN "
                "('users', 'incidents', 'teams', 'incident_allocations')"
            )
        )
        found = {row[0] for row in result.fetchall()}

    missing = {"users", "incidents", "teams", "incident_allocations"} - found
    if missing:
        raise RuntimeError(
            f"Missing table(s): {', '.join(sorted(missing))}. "
            f"Run schema.sql (and schema_additions.sql, for teams/incident_allocations) "
            f"against your database before starting the app."
        )

    print("[startup] Tables verified: users, incidents, teams, incident_allocations ✓")
    print("[startup] Socket.IO ready on socket_app ✓")


# Wrap FastAPI with Socket.IO — this is what you must run with uvicorn.
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)