"""Authenticated, bounded live recognition WebSocket.

This endpoint emits candidates only. It never writes attendance decisions.
"""

import asyncio
import time

from fastapi import HTTPException, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from config import ALLOWED_ORIGINS, MAX_FRAME_BYTES, MAX_FRAME_RATE
from database.connection import SessionLocal
from database.models import AttendanceSession
from schemas.recognition import FrameMessage
from services.auth import authenticate_token
from services.biometrics import BiometricUnavailable, decode_jpeg, match_detections
from services.cv_client import CVInputError, CVUnavailable, cv_client
from routes.attendance import check_class_access

MAX_CONNECTIONS = 4
MAX_FRAMES = 500
MAX_ERRORS = 10
_slots = asyncio.Semaphore(MAX_CONNECTIONS)


async def _error(socket: WebSocket, code: str, message: str):
    await socket.send_json({"type": "error", "code": code, "message": message})


async def recognition_socket(socket: WebSocket):
    origin = socket.headers.get("origin")
    if origin not in ALLOWED_ORIGINS:
        await socket.close(code=1008)
        return
    authorization = socket.headers.get("authorization", "")
    token = socket.cookies.get("eduvision_ws")
    if not token and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
    with SessionLocal() as db:
        user = authenticate_token(db, token)
        if not user or user.role not in ("admin", "teacher"):
            await socket.close(code=1008)
            return
        try:
            await asyncio.wait_for(_slots.acquire(), timeout=0.05)
        except asyncio.TimeoutError:
            await socket.close(code=1013)
            return
        try:
            await socket.accept()
            await socket.send_json({"type": "ready", "maxFrameBytes": MAX_FRAME_BYTES,
                                    "maxFramesPerSecond": MAX_FRAME_RATE, "attendanceDecisions": "manual-only"})
            last_frame = 0.0
            frames = 0
            errors = 0
            while frames < MAX_FRAMES and errors < MAX_ERRORS:
                try:
                    packet = await asyncio.wait_for(socket.receive(), timeout=60)
                except asyncio.TimeoutError:
                    await socket.close(code=1000, reason="Idle timeout")
                    return
                if packet["type"] == "websocket.disconnect":
                    return
                message = packet.get("text")
                if message is None:
                    errors += 1
                    await _error(socket, "invalidFrame", "Send JSON text frames, not binary messages")
                    continue
                if len(message) > 2_100_500:
                    await socket.close(code=1009, reason="Message too large")
                    return
                try:
                    frame = FrameMessage.model_validate_json(message)
                except ValidationError:
                    errors += 1
                    await _error(socket, "invalidFrame", "Send a valid frame message with sessionId, sequence, and JPEG image")
                    continue
                now = time.monotonic()
                if now - last_frame < 1 / MAX_FRAME_RATE:
                    errors += 1
                    await _error(socket, "rateLimit", "Frame rate limit exceeded")
                    continue
                last_frame = now
                session = db.get(AttendanceSession, frame.session_id)
                if not session or session.status != "Draft":
                    errors += 1
                    await _error(socket, "invalidSession", "An active draft session is required")
                    continue
                try:
                    check_class_access(db, user, session.class_id)
                except HTTPException:
                    errors += 1
                    await _error(socket, "forbiddenSession", "Session is not available to this user")
                    continue
                try:
                    raw = decode_jpeg(frame.image)
                    detections = await asyncio.to_thread(cv_client.call, "analyze", raw)
                    results = match_detections(db, detections, session.class_id)
                except ValueError:
                    errors += 1
                    await _error(socket, "invalidImage", "Frame must be a valid bounded JPEG")
                    continue
                except CVInputError:
                    errors += 1
                    await _error(socket, "cvInput", "Frame could not be processed")
                    continue
                except (CVUnavailable, BiometricUnavailable):
                    errors += 1
                    await _error(socket, "serviceUnavailable", "Recognition service is unavailable")
                    continue
                frames += 1
                await socket.send_json({"type": "recognition", "sessionId": session.id,
                                        "sequence": frame.sequence, "results": results})
            await socket.close(code=1000, reason="Connection processing limit reached")
        except WebSocketDisconnect:
            pass
        finally:
            _slots.release()
