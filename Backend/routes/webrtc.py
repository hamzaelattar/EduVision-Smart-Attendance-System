"""Authenticated multi-camera WebRTC signaling and in-memory monitoring."""

import asyncio
import hmac
import io
import secrets
import subprocess
import time
from collections import deque
from dataclasses import dataclass, field

from aiortc import RTCPeerConnection, RTCSessionDescription
from aiortc.contrib.media import MediaRelay
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
import psutil
from sqlalchemy import select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from database.connection import SessionLocal, get_db
from database.models import AttendanceRecord, AttendanceSession, BiometricTemplate, CameraDevice, Student, User
from routes.attendance import check_class_access
from services.auth import require_roles, token_hash, utcnow
from services.biometrics import BiometricUnavailable, match_detections
from services.cv_client import CVInputError, CVUnavailable, cv_client

router = APIRouter(prefix="/api/webrtc", tags=["Cameras"])
admin = require_roles("admin")
operator = require_roles("admin", "teacher")
MAX_CAMERAS = 8
MAX_VIEWERS = 8
ANALYSIS_INTERVAL = 1.0
AUTO_MATCH_FRAMES = 3
AUTO_MATCH_MAX_GAP = 4.0


class Offer(BaseModel):
    sdp: str = Field(min_length=1, max_length=100_000)
    type: str = Field(pattern="^offer$")


class PublishOffer(Offer):
    camera_id: str = Field(alias="cameraId")


class CameraCreate(BaseModel):
    id: str = Field(pattern=r"^CAM-[A-Za-z0-9-]{1,25}$")
    name: str = Field(min_length=1, max_length=120)
    room: str | None = Field(default=None, max_length=80)


class CameraAssignment(BaseModel):
    session_id: str | None = Field(alias="sessionId")


class CameraEnabled(BaseModel):
    enabled: bool


@dataclass
class LiveCamera:
    publisher: RTCPeerConnection
    started_at: float = field(default_factory=time.monotonic)
    relay: MediaRelay = field(default_factory=MediaRelay)
    track: object | None = None
    reader: asyncio.Task | None = None
    analysis: asyncio.Task | None = None
    stats: asyncio.Task | None = None
    viewers: dict[str, RTCPeerConnection] = field(default_factory=dict)
    viewer_users: dict[str, int] = field(default_factory=dict)
    received: int = 0
    skipped: int = 0
    width: int = 0
    height: int = 0
    last_frame_at: float = 0.0
    last_analysis_at: float = 0.0
    analysis_ms: float | None = None
    rtt_ms: float | None = None
    packets_lost: int | None = None
    packet_loss_percent: float | None = None
    error: str | None = None
    candidates: list[dict] = field(default_factory=list)
    match_streaks: dict[str, tuple[int, float]] = field(default_factory=dict)
    auto_recorded: set[str] = field(default_factory=set)
    frame_times: deque = field(default_factory=lambda: deque(maxlen=120))


streams: dict[str, LiveCamera] = {}
_streams_lock = asyncio.Lock()


def _camera(db: Session, camera_id: str) -> CameraDevice:
    camera = db.get(CameraDevice, camera_id)
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    return camera


def _may_view(db: Session, user: User, camera: CameraDevice):
    if user.role == "admin":
        return
    session = db.get(AttendanceSession, camera.session_id) if camera.session_id else None
    if not session:
        raise HTTPException(status_code=403, detail="Camera is not assigned to an accessible session")
    check_class_access(db, user, session.class_id)


def _snapshot(camera: CameraDevice) -> dict:
    live = streams.get(camera.id)
    now = time.monotonic()
    online = bool(live and live.track and now - live.last_frame_at < 5)
    recent = [t for t in live.frame_times if now - t < 5] if live else []
    return {
        "id": camera.id, "name": camera.name, "room": camera.room,
        "enabled": camera.enabled, "sessionId": camera.session_id,
        "online": online, "fps": round(len(recent) / 5, 1) if online else 0,
        "width": live.width if online else None, "height": live.height if online else None,
        "rttMs": live.rtt_ms if online else None,
        "packetsLost": live.packets_lost if online else None,
        "packetLossPercent": live.packet_loss_percent if online else None,
        "analysisMs": live.analysis_ms if online else None,
        "framesReceived": live.received if live else 0,
        "framesSkipped": live.skipped if live else 0,
        "viewers": len(live.viewers) if live else 0,
        "analysisError": live.error if live else None,
        "candidates": live.candidates if online and now - live.last_analysis_at < 10 else [],
    }


@router.get("/cameras")
def list_cameras(db: Session = Depends(get_db), user: User = Depends(operator)):
    result = []
    for camera in db.scalars(select(CameraDevice).order_by(CameraDevice.id)):
        try:
            _may_view(db, user, camera)
        except HTTPException:
            continue
        result.append(_snapshot(camera))
    return result


@router.get("/metrics")
def system_metrics(_user: User = Depends(operator)):
    gpu_percent = None
    try:
        command = subprocess.run(
            ["nvidia-smi", "--query-gpu=utilization.gpu", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=2, check=True,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        gpu_percent = max(int(line.strip()) for line in command.stdout.splitlines() if line.strip())
    except (FileNotFoundError, OSError, ValueError, subprocess.SubprocessError):
        pass
    return {
        "measuredAt": utcnow(),
        "cpuPercent": psutil.cpu_percent(interval=0.1),
        "memoryPercent": psutil.virtual_memory().percent,
        "gpuPercent": gpu_percent,
        "activeCameras": sum(1 for live in streams.values() if live.track and time.monotonic() - live.last_frame_at < 5),
    }


@router.post("/cameras", status_code=201)
def create_camera(data: CameraCreate, db: Session = Depends(get_db), _user: User = Depends(admin)):
    if db.get(CameraDevice, data.id):
        raise HTTPException(status_code=409, detail="Camera ID already exists")
    secret = secrets.token_urlsafe(32)
    camera = CameraDevice(id=data.id, name=data.name, room=data.room,
                          secret_hash=token_hash(secret), enabled=True, created_at=utcnow())
    db.add(camera)
    db.commit()
    return {"camera": _snapshot(camera), "deviceSecret": secret}


@router.post("/cameras/{camera_id}/rotate-secret")
async def rotate_secret(camera_id: str, db: Session = Depends(get_db), _user: User = Depends(admin)):
    camera = _camera(db, camera_id)
    secret = secrets.token_urlsafe(32)
    camera.secret_hash = token_hash(secret)
    db.commit()
    await _close_stream(camera_id)
    return {"deviceSecret": secret}


@router.put("/cameras/{camera_id}/enabled")
async def set_enabled(camera_id: str, data: CameraEnabled, db: Session = Depends(get_db), _user: User = Depends(admin)):
    camera = _camera(db, camera_id)
    camera.enabled = data.enabled
    db.commit()
    if not data.enabled:
        await _close_stream(camera_id)
    return _snapshot(camera)


@router.put("/cameras/{camera_id}/session")
async def assign_session(camera_id: str, data: CameraAssignment,
                         db: Session = Depends(get_db), _user: User = Depends(admin)):
    camera = _camera(db, camera_id)
    if data.session_id is not None:
        session = db.get(AttendanceSession, data.session_id)
        if not session or session.status != "Draft":
            raise HTTPException(status_code=422, detail="Assign an active draft session")
    camera.session_id = data.session_id
    db.commit()
    live = streams.get(camera_id)
    if live:
        live.candidates = []
        live.match_streaks.clear()
        live.auto_recorded.clear()
        live.last_analysis_at = 0
        viewers = list(live.viewers.values())
        live.viewers.clear()
        live.viewer_users.clear()
        for viewer in viewers:
            await viewer.close()
    return _snapshot(camera)


def _analyze_frame(camera_id: str, frame):
    """Run in a worker thread; only one sampled frame per camera is in flight."""
    from PIL import Image

    with SessionLocal() as db:
        camera = db.get(CameraDevice, camera_id)
        session = db.get(AttendanceSession, camera.session_id) if camera and camera.session_id else None
        if not camera or not camera.enabled or not session or session.status != "Draft":
            return None, []
        image = frame.to_image()
        image.thumbnail((960, 720), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        image.save(output, format="JPEG", quality=72)
        detections = cv_client.call("analyze", output.getvalue())
        return session.id, match_detections(db, detections, session.class_id)


def _confirmed_faces(live: LiveCamera, results: list[dict], now: float) -> set[str]:
    """Require three consecutive strong matches of the same enrolled student."""
    matched = {item["candidateStudentId"] for item in results
               if item.get("status") == "Candidate Match" and item.get("candidateStudentId")}
    streaks = {}
    for student_id in matched:
        previous = live.match_streaks.get(student_id)
        count = previous[0] + 1 if previous and now - previous[1] <= AUTO_MATCH_MAX_GAP else 1
        streaks[student_id] = (count, now)
    live.match_streaks = streaks
    return {student_id for student_id, (count, _) in streaks.items()
            if count >= AUTO_MATCH_FRAMES and student_id not in live.auto_recorded}


def _record_auto_presence(camera_id: str, session_id: str, student_ids: set[str]) -> set[str]:
    """Record only undecided students with current consent in the camera's draft session."""
    if not student_ids:
        return set()
    with SessionLocal() as db:
        camera = db.get(CameraDevice, camera_id)
        session = db.get(AttendanceSession, session_id)
        if not camera or not camera.enabled or camera.session_id != session_id or not session or session.status != "Draft":
            return set()
        now = utcnow()
        records = db.scalars(
            select(AttendanceRecord)
            .join(Student, Student.id == AttendanceRecord.student_id)
            .join(BiometricTemplate, BiometricTemplate.student_id == Student.id)
            .where(AttendanceRecord.session_id == session_id,
                   AttendanceRecord.student_id.in_(student_ids),
                   AttendanceRecord.status == "Unverified",
                   Student.class_id == session.class_id,
                   Student.face_registered.is_(True),
                   Student.consent_status == "consented",
                   BiometricTemplate.expires_at > now)
        ).all()
        if not records:
            return set()
        updated = db.scalars(
            update(AttendanceRecord)
            .where(AttendanceRecord.id.in_([record.id for record in records]),
                   AttendanceRecord.status == "Unverified")
            .values(status="Present", updated_by=None, updated_at=now)
            .returning(AttendanceRecord.student_id)
        ).all()
        db.commit()
        return set(updated)


async def _analyze(camera_id: str, live: LiveCamera, frame):
    started = time.monotonic()
    try:
        analyzed_session, results = await asyncio.to_thread(_analyze_frame, camera_id, frame)
        if streams.get(camera_id) is live:
            with SessionLocal() as db:
                current = db.get(CameraDevice, camera_id)
                current_session = db.get(AttendanceSession, analyzed_session) if analyzed_session else None
                valid = bool(current and current.enabled and current.session_id == analyzed_session
                             and current_session and current_session.status == "Draft")
                candidate_ids = {item.get("candidateStudentId") for item in results if item.get("candidateStudentId")}
                current_records = {
                    record.student_id: record for record in db.scalars(
                        select(AttendanceRecord).where(AttendanceRecord.session_id == analyzed_session,
                                                       AttendanceRecord.student_id.in_(candidate_ids))
                    )
                } if valid and candidate_ids else {}
            live.candidates = results if valid else []
            if valid:
                confirmed_ids = _confirmed_faces(live, results, time.monotonic())
                if confirmed_ids and streams.get(camera_id) is live:
                    recorded = await asyncio.to_thread(_record_auto_presence, camera_id, analyzed_session, confirmed_ids)
                    live.auto_recorded.update(recorded)
                else:
                    recorded = set()
                for result in live.candidates:
                    student_id = result.get("candidateStudentId")
                    record = current_records.get(student_id)
                    result["attendanceStatus"] = "Present" if student_id in recorded else record.status if record else "Unverified"
                    result["attendanceSource"] = "automatic" if student_id in recorded or record and record.updated_at and record.updated_by is None else "manual" if record and record.updated_by is not None else None
            else:
                live.match_streaks.clear()
                live.auto_recorded.clear()
            live.last_analysis_at = time.monotonic()
            live.analysis_ms = round((live.last_analysis_at - started) * 1000)
            live.error = None
    except (ValueError, CVInputError, CVUnavailable, BiometricUnavailable, OSError, RuntimeError, SQLAlchemyError):
        if streams.get(camera_id) is live:
            live.candidates = []
            live.error = "Recognition unavailable; manual attendance remains available"


async def _read_video(camera_id: str, live: LiveCamera):
    source = live.relay.subscribe(live.track, buffered=False)
    last_sample = 0.0
    try:
        while True:
            frame = await source.recv()
            now = time.monotonic()
            live.received += 1
            live.last_frame_at = now
            live.frame_times.append(now)
            live.width, live.height = frame.width, frame.height
            if frame.width * frame.height > 2_500_000:
                live.error = "Frame resolution exceeds the 2.5 MP processing limit"
                continue
            if now - last_sample >= ANALYSIS_INTERVAL:
                last_sample = now
                if live.analysis is None or live.analysis.done():
                    live.analysis = asyncio.create_task(_analyze(camera_id, live, frame))
                else:
                    live.skipped += 1
    except asyncio.CancelledError:
        raise
    except Exception:
        await _close_stream(camera_id, expected=live)


async def _sample_stats(camera_id: str, live: LiveCamera):
    try:
        while True:
            await asyncio.sleep(5)
            last_activity = live.last_frame_at or live.started_at
            if time.monotonic() - last_activity > (15 if live.last_frame_at else 30):
                await _close_stream(camera_id, expected=live)
                return
            try:
                report = await live.publisher.getStats()
            except Exception:
                report = {}
            for item in report.values():
                if item.type == "inbound-rtp":
                    lost = getattr(item, "packetsLost", None)
                    received = getattr(item, "packetsReceived", None)
                    if lost is not None and received is not None:
                        live.packets_lost = lost
                        live.packet_loss_percent = round(100 * lost / (lost + received), 2) if lost + received else 0
                if item.type == "remote-inbound-rtp":
                    rtt = getattr(item, "roundTripTime", None)
                elif item.type == "candidate-pair" and getattr(item, "state", None) == "succeeded":
                    rtt = getattr(item, "currentRoundTripTime", None)
                else:
                    continue
                if rtt is not None:
                    live.rtt_ms = round(rtt * 1000)
                    break
            revoke = []
            with SessionLocal() as db:
                camera = db.get(CameraDevice, camera_id)
                for viewer_id, pc in list(live.viewers.items()):
                    user = db.get(User, live.viewer_users.get(viewer_id))
                    try:
                        if not camera or not user or not user.active:
                            raise HTTPException(status_code=403)
                        _may_view(db, user, camera)
                    except HTTPException:
                        live.viewers.pop(viewer_id, None)
                        live.viewer_users.pop(viewer_id, None)
                        revoke.append(pc)
            for pc in revoke:
                await pc.close()
    except asyncio.CancelledError:
        raise
    except Exception:
        live.rtt_ms = None


async def _close_stream(camera_id: str, expected: LiveCamera | None = None):
    async with _streams_lock:
        if expected is not None and streams.get(camera_id) is not expected:
            return
        live = streams.pop(camera_id, None)
    if not live:
        return
    current = asyncio.current_task()
    for task in (live.reader, live.analysis, live.stats):
        if task and task is not current:
            task.cancel()
    for viewer in list(live.viewers.values()):
        await viewer.close()
    await live.publisher.close()


async def close_all_cameras():
    for camera_id in list(streams):
        await _close_stream(camera_id)


@router.post("/offer")
async def publish(offer: PublishOffer, x_camera_secret: str | None = Header(default=None),
                  db: Session = Depends(get_db)):
    camera = _camera(db, offer.camera_id)
    if not camera.enabled or not x_camera_secret or not hmac.compare_digest(camera.secret_hash, token_hash(x_camera_secret)):
        raise HTTPException(status_code=401, detail="Invalid camera credentials")
    previous = streams.get(camera.id)
    if previous and time.monotonic() - (previous.last_frame_at or previous.started_at) > 15:
        await _close_stream(camera.id, expected=previous)
    async with _streams_lock:
        if camera.id in streams:
            raise HTTPException(status_code=409, detail="Camera is already publishing")
        if len(streams) >= MAX_CAMERAS:
            raise HTTPException(status_code=503, detail="Camera capacity reached")
        pc = RTCPeerConnection()
        live = LiveCamera(publisher=pc)
        streams[camera.id] = live

    @pc.on("track")
    def on_track(track):
        if track.kind == "video" and live.track is None:
            live.track = track
            live.reader = asyncio.create_task(_read_video(camera.id, live))
            live.stats = asyncio.create_task(_sample_stats(camera.id, live))

            @track.on("ended")
            def on_ended():
                asyncio.create_task(_close_stream(camera.id, expected=live))

    @pc.on("connectionstatechange")
    async def on_state():
        if pc.connectionState in ("failed", "closed", "disconnected"):
            await _close_stream(camera.id, expected=live)

    try:
        await pc.setRemoteDescription(RTCSessionDescription(sdp=offer.sdp, type=offer.type))
        if live.track is None:
            raise HTTPException(status_code=422, detail="Offer must contain a video track")
        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        return {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type}
    except (ValueError, TypeError) as error:
        await _close_stream(camera.id, expected=live)
        raise HTTPException(status_code=422, detail="Invalid WebRTC offer") from error
    except Exception:
        await _close_stream(camera.id, expected=live)
        raise


@router.post("/cameras/{camera_id}/view")
async def view(camera_id: str, offer: Offer, db: Session = Depends(get_db), user: User = Depends(operator)):
    camera = _camera(db, camera_id)
    _may_view(db, user, camera)
    live = streams.get(camera_id)
    if not camera.enabled or not live or live.track is None:
        raise HTTPException(status_code=409, detail="Camera is offline")
    if len(live.viewers) >= MAX_VIEWERS:
        raise HTTPException(status_code=503, detail="Viewer capacity reached")
    viewer_id = secrets.token_urlsafe(12)
    pc = RTCPeerConnection()
    live.viewers[viewer_id] = pc
    live.viewer_users[viewer_id] = user.id
    pc.addTrack(live.relay.subscribe(live.track, buffered=False))

    @pc.on("connectionstatechange")
    async def on_state():
        if pc.connectionState in ("failed", "closed", "disconnected"):
            live.viewers.pop(viewer_id, None)
            live.viewer_users.pop(viewer_id, None)
            await pc.close()

    try:
        await pc.setRemoteDescription(RTCSessionDescription(sdp=offer.sdp, type=offer.type))
        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        return {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type,
                "viewerId": viewer_id}
    except (ValueError, TypeError) as error:
        live.viewers.pop(viewer_id, None)
        live.viewer_users.pop(viewer_id, None)
        await pc.close()
        raise HTTPException(status_code=422, detail="Invalid WebRTC offer") from error
    except Exception:
        live.viewers.pop(viewer_id, None)
        live.viewer_users.pop(viewer_id, None)
        await pc.close()
        raise


@router.delete("/cameras/{camera_id}/view/{viewer_id}", status_code=204)
async def stop_view(camera_id: str, viewer_id: str, db: Session = Depends(get_db),
                    user: User = Depends(operator)):
    camera = _camera(db, camera_id)
    _may_view(db, user, camera)
    live = streams.get(camera_id)
    pc = live.viewers.pop(viewer_id, None) if live else None
    if live:
        live.viewer_users.pop(viewer_id, None)
    if pc:
        await pc.close()


@router.delete("/cameras/{camera_id}/publish", status_code=204)
async def stop_publish(camera_id: str, x_camera_secret: str | None = Header(default=None),
                       db: Session = Depends(get_db)):
    camera = _camera(db, camera_id)
    if not x_camera_secret or not hmac.compare_digest(camera.secret_hash, token_hash(x_camera_secret)):
        raise HTTPException(status_code=401, detail="Invalid camera credentials")
    await _close_stream(camera_id)
