"""
socket_manager.py
A single Socket.IO server instance, mounted onto the FastAPI app in main.py.
This works fine without Redis as long as you're running ONE backend process.
(If you later scale to multiple backend instances behind a load balancer,
that's when you'd add the Redis adapter so all instances share socket state —
not needed yet.)
"""
import socketio
from config import CORS_ORIGINS

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins=CORS_ORIGINS)


async def emit_incident(incident_dict: dict):
    """Push a new/updated incident to every connected dashboard client."""
    await sio.emit("incident:new", incident_dict)


async def emit_media(media_dict: dict):
    """
    Push a newly created media_uploads row (photo or audio chunk) to every
    connected dashboard client, so an already-open incident drawer can
    append it live instead of only picking it up on next fetch.
    """
    await sio.emit("media:new", media_dict)


@sio.event
async def connect(sid, environ):
    print(f"[socket] dashboard connected: {sid}")


@sio.event
async def disconnect(sid):
    print(f"[socket] dashboard disconnected: {sid}")