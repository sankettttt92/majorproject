"""
socket_manager.py
A single Socket.IO server instance, mounted onto the FastAPI app in main.py.
This works fine without Redis as long as you're running ONE backend process.
(If you later scale to multiple backend instances behind a load balancer,
that's when you'd add the Redis adapter so all instances share socket state —
not needed yet.)
"""
import socketio

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")


async def emit_incident(incident_dict: dict):
    """Push a new/updated incident to every connected dashboard client."""
    await sio.emit("incident:new", incident_dict)


@sio.event
async def connect(sid, environ):
    print(f"[socket] dashboard connected: {sid}")


@sio.event
async def disconnect(sid):
    print(f"[socket] dashboard disconnected: {sid}")