# # """
# # routers/sos.py
# # POST /sos — the endpoint the victim app calls when someone presses the SOS button.

# # v2 addition: after persisting the incident, fires run_suggest_pipeline as a
# # background task so the A* dispatcher suggestion is emitted over the socket
# # without blocking the SOS response.
# # """
# # from fastapi import APIRouter, Depends, BackgroundTasks
# # from sqlalchemy.ext.asyncio import AsyncSession

# # from database import get_db
# # from models.incident import Incident
# # from schemas.sos_request import SOSRequest
# # from schemas.incident_out import IncidentOut

# # from validation.device_trust import check_device_trust
# # from validation.identity import check_identity
# # from validation.location import check_location
# # from validation.geo import resolve_zone
# # from validation.crowd import check_crowd_density
# # from validation.scorer import score_incident

# # from tasks.persist import persist_incident
# # from tasks.notify import notify_rescue_team
# # from tasks.suggest import run_suggest_pipeline          # ← v2
# # from socket_manager import emit_incident

# # router = APIRouter(prefix="/sos", tags=["sos"])


# # @router.post("", response_model=IncidentOut)
# # async def create_sos(
# #     payload: SOSRequest,
# #     background_tasks: BackgroundTasks,
# #     db: AsyncSession = Depends(get_db),
# # ):
# #     device_result = check_device_trust(payload.auth_token, payload.device_id)
# #     identity_result = await check_identity(db, payload.user_id)

# #     last_lat = identity_result.user.last_known_lat if identity_result.user else None
# #     last_lon = identity_result.user.last_known_lon if identity_result.user else None
# #     last_seen = identity_result.user.last_seen_at if identity_result.user else None

# #     location_result = check_location(
# #         payload.latitude, payload.longitude, payload.accuracy_meters,
# #         last_lat, last_lon, last_seen,
# #     )

# #     geo_result = resolve_zone(payload.latitude, payload.longitude)
# #     crowd_result = await check_crowd_density(db, payload.latitude, payload.longitude)

# #     score = score_incident(device_result, identity_result, location_result, crowd_result)

# #     incident = Incident(
# #         user_id=payload.user_id,
# #         device_id=payload.device_id,
# #         latitude=payload.latitude,
# #         longitude=payload.longitude,
# #         accuracy_meters=payload.accuracy_meters,
# #         zone=geo_result.zone,
# #         address=geo_result.address,
# #         incident_type=payload.incident_type,
# #         detail=payload.detail,
# #         trust_score=score.trust_score,
# #         risk_score=score.risk_score,
# #         priority=score.priority,
# #         severity=score.severity,
# #         status=score.status,
# #     )
# #     incident = await persist_incident(db, incident)

# #     incident_out = IncidentOut.model_validate(incident)
# #     background_tasks.add_task(emit_incident, incident_out.model_dump(mode="json"))
# #     background_tasks.add_task(notify_rescue_team, str(incident.id), incident.zone)

# #     # v2: fire A* suggestion pipeline — emits "incident:suggestion" to dashboard
# #     background_tasks.add_task(
# #         run_suggest_pipeline,
# #         str(incident.id),
# #         incident.latitude,
# #         incident.longitude,
# #     )

# #     return incident_out

# """
# routers/sos.py
# POST /sos — the endpoint the victim app calls when someone presses the SOS button.

# v2 addition: after persisting the incident, fires run_suggest_pipeline as a
# background task so the A* dispatcher suggestion is emitted over the socket
# without blocking the SOS response.

# v3 fix: media (photos/audio) is attached exclusively via POST /media using
# the same client-generated incident_id. This works whether /media is called
# before or after /sos, since media_uploads.incident_id no longer has a
# strict FK — see models/media_upload.py for details. The old photo_url
# convenience field on SOSRequest has been removed; it was accepted but
# never actually persisted anywhere.
# """
# from fastapi import APIRouter, Depends, BackgroundTasks
# from sqlalchemy.ext.asyncio import AsyncSession
# from database import get_db
# from models.incident import Incident
# from schemas.sos_request import SOSRequest
# from schemas.incident_out import IncidentOut
# from validation.device_trust import check_device_trust
# from validation.identity import check_identity
# from validation.location import check_location
# from validation.geo import resolve_zone
# from validation.crowd import check_crowd_density
# from validation.scorer import score_incident
# from tasks.persist import persist_incident
# from tasks.notify import notify_rescue_team
# from tasks.suggest import run_suggest_pipeline          # ← v2
# from socket_manager import emit_incident

# router = APIRouter(prefix="/sos", tags=["sos"])


# @router.post("", response_model=IncidentOut)
# async def create_sos(
#     payload: SOSRequest,
#     background_tasks: BackgroundTasks,
#     db: AsyncSession = Depends(get_db),
# ):
#     device_result = check_device_trust(payload.auth_token, payload.device_id)
#     identity_result = await check_identity(db, payload.user_id)

#     last_lat = identity_result.user.last_known_lat if identity_result.user else None
#     last_lon = identity_result.user.last_known_lon if identity_result.user else None
#     last_seen = identity_result.user.last_seen_at if identity_result.user else None

#     location_result = check_location(
#         payload.latitude, payload.longitude, payload.accuracy_meters,
#         last_lat, last_lon, last_seen,
#     )
#     geo_result = resolve_zone(payload.latitude, payload.longitude)
#     crowd_result = await check_crowd_density(db, payload.latitude, payload.longitude)

#     score = score_incident(device_result, identity_result, location_result, crowd_result)

#     incident = Incident(
#         id=payload.incident_id,          # client-generated ID so it matches media_uploads
#         user_id=payload.user_id,
#         device_id=payload.device_id,
#         latitude=payload.latitude,
#         longitude=payload.longitude,
#         accuracy_meters=payload.accuracy_meters,
#         zone=geo_result.zone,
#         address=geo_result.address,
#         incident_type=payload.incident_type,
#         detail=payload.detail,
#         trust_score=score.trust_score,
#         risk_score=score.risk_score,
#         priority=score.priority,
#         severity=score.severity,
#         status=score.status,
#     )
#     incident = await persist_incident(db, incident)
#     incident_out = IncidentOut.model_validate(incident)

#     background_tasks.add_task(emit_incident, incident_out.model_dump(mode="json"))
#     background_tasks.add_task(notify_rescue_team, str(incident.id), incident.zone)

#     # v2: fire A* suggestion pipeline — emits "incident:suggestion" to dashboard
#     background_tasks.add_task(
#         run_suggest_pipeline,
#         str(incident.id),
#         incident.latitude,
#         incident.longitude,
#     )

#     return incident_out

"""
routers/sos.py
POST /sos — the endpoint the victim app calls when someone presses the SOS button.

v2 addition: after persisting the incident, fires run_suggest_pipeline as a
background task so the A* dispatcher suggestion is emitted over the socket
without blocking the SOS response.

v3 fix: media (photos/audio) is attached exclusively via POST /media using
the same client-generated incident_id. This works whether /media is called
before or after /sos, since media_uploads.incident_id no longer has a
strict FK — see models/media_upload.py for details. The old photo_url
convenience field on SOSRequest has been removed; it was accepted but
never actually persisted anywhere.

v4 fix: the mobile app reuses a single client-generated incident_id for the
lifetime of its screen state. If the same id is ever POSTed twice (e.g. SOS
pressed a second time before the app regenerates a fresh id, or a retry
after a flaky network response), the DB's primary key constraint on
incidents.id previously caused an unhandled IntegrityError -> raw 500.
That's now caught explicitly and returned as a clean 409, since a duplicate
id here is a client-side reuse issue, not a server fault.
"""
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models.incident import Incident
from schemas.sos_request import SOSRequest
from schemas.incident_out import IncidentOut
from validation.device_trust import check_device_trust
from validation.identity import check_identity
from validation.location import check_location
from validation.geo import resolve_zone
from validation.crowd import check_crowd_density
from validation.scorer import score_incident
from tasks.persist import persist_incident
from tasks.notify import notify_rescue_team
from tasks.suggest import run_suggest_pipeline          # ← v2
from socket_manager import emit_incident

router = APIRouter(prefix="/sos", tags=["sos"])


@router.post("", response_model=IncidentOut)
async def create_sos(
    payload: SOSRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    device_result = check_device_trust(payload.auth_token, payload.device_id)
    identity_result = await check_identity(db, payload.user_id)

    last_lat = identity_result.user.last_known_lat if identity_result.user else None
    last_lon = identity_result.user.last_known_lon if identity_result.user else None
    last_seen = identity_result.user.last_seen_at if identity_result.user else None

    location_result = check_location(
        payload.latitude, payload.longitude, payload.accuracy_meters,
        last_lat, last_lon, last_seen,
    )
    geo_result = resolve_zone(payload.latitude, payload.longitude)
    crowd_result = await check_crowd_density(db, payload.latitude, payload.longitude)

    score = score_incident(device_result, identity_result, location_result, crowd_result)

    incident = Incident(
        id=payload.incident_id,          # client-generated ID so it matches media_uploads
        user_id=payload.user_id,
        device_id=payload.device_id,
        latitude=payload.latitude,
        longitude=payload.longitude,
        accuracy_meters=payload.accuracy_meters,
        zone=geo_result.zone,
        address=geo_result.address,
        incident_type=payload.incident_type,
        detail=payload.detail,
        trust_score=score.trust_score,
        risk_score=score.risk_score,
        priority=score.priority,
        severity=score.severity,
        status=score.status,
    )

    try:
        incident = await persist_incident(db, incident)
    except IntegrityError:
        # incident_id already exists — most likely the client reused an id
        # from a previous SOS in the same app session (see v4 note above).
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail=(
                "An incident with this incident_id already exists. "
                "The client should generate a new incident_id for each "
                "new SOS trigger."
            ),
        )

    incident_out = IncidentOut.model_validate(incident)

    background_tasks.add_task(emit_incident, incident_out.model_dump(mode="json"))
    background_tasks.add_task(notify_rescue_team, str(incident.id), incident.zone)

    # v2: fire A* suggestion pipeline — emits "incident:suggestion" to dashboard
    background_tasks.add_task(
        run_suggest_pipeline,
        str(incident.id),
        incident.latitude,
        incident.longitude,
    )

    return incident_out