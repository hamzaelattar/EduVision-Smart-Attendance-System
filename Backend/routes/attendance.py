"""Attendance sessions and manually confirmed records."""

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import AttendanceRecord, AttendanceSession, Course, SchoolClass, Student, User
from schemas.attendance import (AttendanceResponse, AttendanceStatus,
                                AttendanceUpdate, FinalizeRequest,
                                SessionCreate, SessionResponse)
from services.auth import require_roles, utcnow

sessions_router = APIRouter(prefix="/api/sessions", tags=["Sessions"])
attendance_router = APIRouter(prefix="/api/attendance", tags=["Attendance"])
reader = require_roles("admin", "teacher")


def check_class_access(db: Session, user: User, class_id: str):
    item = db.get(SchoolClass, class_id)
    if not item:
        raise HTTPException(status_code=404, detail="Class not found")
    if user.role == "teacher" and item.teacher_user_id is not None and item.teacher_user_id != user.id:
        raise HTTPException(status_code=403, detail="Teacher is not assigned to this class")
    return item


def visible_sessions(statement, user: User):
    if user.role == "admin":
        return statement
    return statement.join(SchoolClass, AttendanceSession.class_id == SchoolClass.id).where(
        or_(SchoolClass.teacher_user_id.is_(None), SchoolClass.teacher_user_id == user.id)
    )


def get_session_or_404(db: Session, session_id: str, user: User) -> AttendanceSession:
    item = db.get(AttendanceSession, session_id)
    if not item:
        raise HTTPException(status_code=404, detail="Session not found")
    check_class_access(db, user, item.class_id)
    return item


@sessions_router.get("", response_model=list[SessionResponse])
def list_sessions(response: Response, class_id: str | None = Query(default=None, alias="classId"),
                  course_id: str | None = Query(default=None, alias="courseId"),
                  date: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
                  status: str | None = Query(default=None, pattern=r"^(Draft|Finalized)$"),
                  limit: int = Query(default=50, ge=1, le=100), offset: int = Query(default=0, ge=0),
                  db: Session = Depends(get_db), user: User = Depends(reader)):
    statement = visible_sessions(select(AttendanceSession), user)
    for column, value in ((AttendanceSession.class_id, class_id), (AttendanceSession.course_id, course_id),
                          (AttendanceSession.date, date), (AttendanceSession.status, status)):
        if value is not None:
            statement = statement.where(column == value)
    response.headers["X-Total-Count"] = str(db.scalar(select(func.count()).select_from(statement.subquery())) or 0)
    return db.scalars(statement.order_by(AttendanceSession.date.desc(), AttendanceSession.start_time.desc()).limit(limit).offset(offset)).all()


@sessions_router.get("/{session_id}", response_model=SessionResponse)
def get_session(session_id: str, db: Session = Depends(get_db), user: User = Depends(reader)):
    return get_session_or_404(db, session_id, user)


@sessions_router.post("", response_model=SessionResponse, status_code=201)
def create_session(data: SessionCreate, db: Session = Depends(get_db), user: User = Depends(reader)):
    check_class_access(db, user, data.class_id)
    course = db.get(Course, data.course_id)
    if not course or course.class_id != data.class_id:
        raise HTTPException(status_code=422, detail="Course must belong to the selected class")
    item = AttendanceSession(id=str(uuid4()), class_id=data.class_id, course_id=data.course_id,
                             date=data.date.isoformat(), start_time=data.start_time, status="Draft", created_by=user.id)
    db.add(item)
    db.flush()
    for student_id in db.scalars(select(Student.id).where(Student.class_id == data.class_id)):
        db.add(AttendanceRecord(id=str(uuid4()), session_id=item.id, student_id=student_id, status="Unverified"))
    db.commit()
    db.refresh(item)
    return item


@sessions_router.put("/{session_id}/end", response_model=SessionResponse)
def end_session(session_id: str, db: Session = Depends(get_db), user: User = Depends(reader)):
    item = get_session_or_404(db, session_id, user)
    if item.status == "Finalized":
        raise HTTPException(status_code=409, detail="Finalized session cannot be changed")
    item.end_time = datetime.now(timezone.utc).strftime("%H:%M")
    db.commit()
    return item


@sessions_router.post("/{session_id}/finalize", response_model=SessionResponse)
def finalize_session(session_id: str, data: FinalizeRequest, db: Session = Depends(get_db), user: User = Depends(reader)):
    item = get_session_or_404(db, session_id, user)
    if item.status == "Finalized":
        raise HTTPException(status_code=409, detail="Session is already finalized")
    records = db.scalars(select(AttendanceRecord).where(AttendanceRecord.session_id == session_id)).all()
    if not records:
        raise HTTPException(status_code=409, detail="Session has no attendance records")
    if any(record.status == AttendanceStatus.UNVERIFIED.value for record in records):
        raise HTTPException(status_code=409, detail="Resolve every Unverified student before finalizing")
    item.status = "Finalized"
    item.finalized_by = user.id
    item.finalized_at = utcnow()
    item.teacher_note = data.teacher_note
    item.end_time = item.end_time or datetime.now(timezone.utc).strftime("%H:%M")
    db.commit()
    return item


@attendance_router.get("", response_model=list[AttendanceResponse])
def list_attendance(response: Response, session_id: str | None = Query(default=None, alias="sessionId"),
                    class_id: str | None = Query(default=None, alias="classId"),
                    course_id: str | None = Query(default=None, alias="courseId"),
                    date: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
                    status: AttendanceStatus | None = None,
                    limit: int = Query(default=100, ge=1, le=500), offset: int = Query(default=0, ge=0),
                    db: Session = Depends(get_db), user: User = Depends(reader)):
    statement = select(AttendanceRecord).join(AttendanceSession, AttendanceRecord.session_id == AttendanceSession.id)
    statement = visible_sessions(statement, user)
    for column, value in ((AttendanceRecord.session_id, session_id), (AttendanceSession.class_id, class_id),
                          (AttendanceSession.course_id, course_id), (AttendanceSession.date, date)):
        if value is not None:
            statement = statement.where(column == value)
    if status is not None:
        statement = statement.where(AttendanceRecord.status == status.value)
    response.headers["X-Total-Count"] = str(db.scalar(select(func.count()).select_from(statement.subquery())) or 0)
    return db.scalars(statement.order_by(AttendanceSession.date.desc(), AttendanceRecord.student_id).limit(limit).offset(offset)).all()


@attendance_router.put("/{record_id}", response_model=AttendanceResponse)
def update_attendance(record_id: str, data: AttendanceUpdate, db: Session = Depends(get_db), user: User = Depends(reader)):
    record = db.get(AttendanceRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    session = get_session_or_404(db, record.session_id, user)
    if session.status == "Finalized":
        raise HTTPException(status_code=409, detail="Finalized attendance cannot be changed")
    record.status = data.status.value
    record.updated_by = user.id
    record.updated_at = utcnow()
    db.commit()
    return record
