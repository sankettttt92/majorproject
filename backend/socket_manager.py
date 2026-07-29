# """
# socket_manager.py
# A single Socket.IO server instance, mounted onto the FastAPI app in main.py.
# This works fine without Redis as long as you're running ONE backend process.
# (If you later scale to multiple backend instances behind a load balancer,
# that's when you'd add the Redis adapter so all instances share socket state —
# not needed yet.)
# """
# import socketio
# from config import CORS_ORIGINS

# sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins=CORS_ORIGINS)


# async def emit_incident(incident_dict: dict):
#     """Push a new/updated incident to every connected dashboard client."""
#     await sio.emit("incident:new", incident_dict)


# async def emit_media(media_dict: dict):
#     """
#     Push a newly created media_uploads row (photo or audio chunk) to every
#     connected dashboard client, so an already-open incident drawer can
#     append it live instead of only picking it up on next fetch.
#     """
#     await sio.emit("media:new", media_dict)


# @sio.event
# async def connect(sid, environ):
#     print(f"[socket] dashboard connected: {sid}")


# @sio.event
# async def disconnect(sid):
#     print(f"[socket] dashboard disconnected: {sid}")

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


async def emit_status_update_to_user(user_id: str, payload: dict):
    """
    Push an incident status update ONLY to the victim's own room —
    not a broadcast. user_id must match the room name the mobile app
    joined via the 'join' event below.
    """
    await sio.emit("incident:status_update", payload, room=str(user_id))


@sio.event
async def connect(sid, environ):
    print(f"[socket] dashboard connected: {sid}")


@sio.event
async def disconnect(sid):
    print(f"[socket] dashboard disconnected: {sid}")


@sio.event
async def join(sid, data):
    """
    Mobile app calls socket.emit('join', { user_id }) right after connecting.
    We put that socket into a room named after the user_id, so later we can
    emit updates to just this one user via emit_status_update_to_user().
    """
    user_id = data.get("user_id")
    if not user_id:
        print(f"[socket] join event missing user_id from {sid}")
        return

    sio.enter_room(sid, str(user_id))
    print(f"[socket] {sid} joined room for user {user_id}")