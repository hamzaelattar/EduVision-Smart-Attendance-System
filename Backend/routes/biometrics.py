"""Administrator-only consent and encrypted registration APIs."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from config import BIOMETRIC_KEY, CV_PYTHON
from database.connection import get_db
from database.models import BiometricTemplate, Student, User
from schemas.biometrics import (ConsentRequest, FaceRegistrationRequest,
                                LegacyImportRequest, RegistrationResponse)
from services.auth import require_roles
from services.biometrics import (BiometricUnavailable, decode_jpeg,
                                  normalize_mean, purge_expired,
                                  revoke_template, store_template)
from services.cv_client import CVInputError, CVUnavailable, cv_client

students_biometrics_router = APIRouter(prefix="/api/students", tags=["Biometrics"])
biometrics_router = APIRouter(prefix="/api/biometrics", tags=["Biometrics"])
admin = require_roles("admin")


def student_or_404(db: Session, student_id: str):
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


def registration_response(db: Session, student: Student):
    item = db.get(BiometricTemplate, student.id)
    return RegistrationResponse(student_id=student.id, face_registered=student.face_registered,
                                consent_status=student.consent_status, expires_at=item.expires_at if item else None,
                                captured_count=item.captured_count if item else 0)


def cv_error(error):
    if isinstance(error, CVUnavailable):
        raise HTTPException(status_code=503, detail="Computer Vision worker unavailable")
    if isinstance(error, BiometricUnavailable):
        raise HTTPException(status_code=503, detail=str(error))
    if isinstance(error, CVInputError):
        raise HTTPException(status_code=422, detail="Image could not be processed; provide one clear face")
    raise HTTPException(status_code=422, detail=str(error))


@students_biometrics_router.post("/{student_id}/consent", response_model=RegistrationResponse)
def set_consent(student_id: str, data: ConsentRequest, db: Session = Depends(get_db),
                _admin: User = Depends(admin)):
    student = student_or_404(db, student_id)
    if data.consented:
        student.consent_status = "consented"
        db.commit()
    else:
        revoke_template(db, student, declined=True)
    return registration_response(db, student)


@students_biometrics_router.post("/{student_id}/face-registration", response_model=RegistrationResponse)
def register_face(student_id: str, data: FaceRegistrationRequest, db: Session = Depends(get_db),
                  _admin: User = Depends(admin)):
    student = student_or_404(db, student_id)
    try:
        from services.biometrics import cipher
        cipher()
        vectors = [cv_client.call("register", decode_jpeg(image)) for image in data.images]
        vector = normalize_mean(vectors)
        store_template(db, student, vector, len(data.images), data.retention_days)
    except (CVUnavailable, CVInputError, BiometricUnavailable, ValueError) as error:
        cv_error(error)
    return registration_response(db, student)


@students_biometrics_router.post("/{student_id}/face-registration/import-legacy", response_model=RegistrationResponse)
def import_legacy(student_id: str, data: LegacyImportRequest, db: Session = Depends(get_db),
                  _admin: User = Depends(admin)):
    student = student_or_404(db, student_id)
    try:
        from services.biometrics import cipher
        cipher()
        entries = cv_client.call("legacy")
        entry = next((item for item in entries if item["id"] == student_id), None)
        if not entry:
            raise HTTPException(status_code=404, detail="No legacy embedding for this student ID")
        store_template(db, student, entry["embedding"], 0, data.retention_days)
    except (CVUnavailable, CVInputError, BiometricUnavailable, ValueError) as error:
        cv_error(error)
    return registration_response(db, student)


@students_biometrics_router.delete("/{student_id}/face-registration", status_code=204)
def delete_registration(student_id: str, db: Session = Depends(get_db), _admin: User = Depends(admin)):
    revoke_template(db, student_or_404(db, student_id))


@biometrics_router.post("/purge-expired")
def purge(db: Session = Depends(get_db), _admin: User = Depends(admin)):
    return {"purged": purge_expired(db)}


@biometrics_router.get("/status")
def status(db: Session = Depends(get_db), _admin: User = Depends(admin)):
    purge_expired(db)
    return {"encryptionConfigured": bool(BIOMETRIC_KEY), "workerAvailable": CV_PYTHON.is_file(),
            "activeRegistrations": db.scalar(select(func.count()).select_from(BiometricTemplate)) or 0}
