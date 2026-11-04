"""Encrypted templates, retention, and candidate matching."""

import base64
import json
import math
from datetime import datetime, timedelta, timezone

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select
from sqlalchemy.orm import Session

from config import BIOMETRIC_KEY, MATCH_THRESHOLD, MAX_FRAME_BYTES, UNCERTAIN_THRESHOLD
from database.models import BiometricTemplate, Student
from services.auth import utcnow


class BiometricUnavailable(Exception):
    pass


def cipher() -> Fernet:
    if not BIOMETRIC_KEY:
        raise BiometricUnavailable("EDUVISION_BIOMETRIC_KEY is not configured")
    try:
        return Fernet(BIOMETRIC_KEY.encode())
    except (ValueError, TypeError):
        raise BiometricUnavailable("EDUVISION_BIOMETRIC_KEY is invalid")


def decode_jpeg(encoded: str) -> bytes:
    if encoded.startswith("data:image/jpeg;base64,"):
        encoded = encoded.split(",", 1)[1]
    if len(encoded) > 2_100_000:
        raise ValueError("Frame exceeds size limit")
    try:
        data = base64.b64decode(encoded, validate=True)
    except ValueError:
        raise ValueError("Frame must be valid base64")
    if len(data) > MAX_FRAME_BYTES or not data.startswith(b"\xff\xd8") or not data.endswith(b"\xff\xd9"):
        raise ValueError("Frame must be a JPEG no larger than the configured limit")
    return data


def normalize_mean(vectors: list[list[float]]) -> list[float]:
    if not vectors or any(len(v) != 512 for v in vectors):
        raise ValueError("Expected 512-dimensional face embeddings")
    result = [sum(vector[i] for vector in vectors) / len(vectors) for i in range(512)]
    norm = math.sqrt(sum(x*x for x in result))
    if norm < 1e-9 or not all(math.isfinite(x) for x in result):
        raise ValueError("Face embedding is invalid")
    return [x / norm for x in result]


def store_template(db: Session, student: Student, vector: list[float], count: int, retention_days: int):
    fernet = cipher()
    normalized = normalize_mean([vector])
    now = datetime.now(timezone.utc)
    expires = (now + timedelta(days=retention_days)).isoformat(timespec="seconds")
    encrypted = fernet.encrypt(json.dumps(normalized, separators=(",", ":")).encode())
    old = db.get(BiometricTemplate, student.id)
    if old:
        db.delete(old)
        db.flush()
    db.add(BiometricTemplate(student_id=student.id, ciphertext=encrypted,
                             consent_at=now.isoformat(timespec="seconds"), expires_at=expires,
                             captured_count=count))
    student.face_registered = True
    student.consent_status = "consented"
    db.commit()
    return expires


def purge_expired(db: Session) -> int:
    expired = db.scalars(select(BiometricTemplate).where(BiometricTemplate.expires_at <= utcnow())).all()
    for item in expired:
        student = db.get(Student, item.student_id)
        if student:
            student.face_registered = False
        db.delete(item)
    if expired:
        db.commit()
    return len(expired)


def revoke_template(db: Session, student: Student, declined: bool = False):
    item = db.get(BiometricTemplate, student.id)
    if item:
        db.delete(item)
    student.face_registered = False
    if declined:
        student.consent_status = "declined"
    db.commit()


def active_templates(db: Session, class_id: str | None = None):
    fernet = cipher()
    query = (select(BiometricTemplate, Student)
             .join(Student, BiometricTemplate.student_id == Student.id)
             .where(BiometricTemplate.expires_at > utcnow(), Student.consent_status == "consented",
                    Student.face_registered.is_(True)))
    if class_id is not None:
        query = query.where(Student.class_id == class_id)
    query = query.limit(2001)
    rows = db.execute(query).all()
    if len(rows) > 2000:
        raise BiometricUnavailable("Too many active face templates")
    templates = []
    for item, student in rows:
        try:
            vector = json.loads(fernet.decrypt(item.ciphertext))
        except (InvalidToken, ValueError):
            raise BiometricUnavailable("A face template cannot be decrypted")
        if len(vector) != 512:
            raise BiometricUnavailable("A face template has an invalid shape")
        templates.append((student, vector))
    return templates


def match_detections(db: Session, detections: list[dict], class_id: str | None = None) -> list[dict]:
    templates = active_templates(db, class_id)
    results = []
    for detection in detections:
        vector = detection.get("embedding")
        result = {"box": detection["box"], "confidence": detection.get("confidence"),
                  "candidateStudentId": None, "candidateStudentName": None,
                  "similarityScore": None, "status": "Unknown", "attendanceStatus": "Unverified"}
        if vector and len(vector) == 512 and templates:
            scores = sorted(((sum(a*b for a,b in zip(vector, known)), student) for student, known in templates),
                            key=lambda item: item[0], reverse=True)
            score, student = scores[0]
            margin = score - (scores[1][0] if len(scores) > 1 else -1.0)
            if score >= UNCERTAIN_THRESHOLD:
                result.update(candidateStudentId=student.id, candidateStudentName=student.name,
                              similarityScore=round(score, 4))
                result["status"] = "Candidate Match" if score >= MATCH_THRESHOLD and margin >= 0.05 else "Needs Verification"
        results.append(result)
    return results
