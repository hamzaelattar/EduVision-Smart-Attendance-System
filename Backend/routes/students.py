"""Student CRUD, search, class filtering, and pagination."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import AttendanceRecord, SchoolClass, Student, User
from schemas.students import StudentCreate, StudentResponse, StudentUpdate
from services.auth import require_roles

router = APIRouter(prefix="/api/students", tags=["Students"])
reader = require_roles("admin", "teacher")
admin = require_roles("admin")


def _student(db: Session, student_id: str) -> Student:
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


def _class_exists(db: Session, class_id: str | None):
    if class_id is not None and db.get(SchoolClass, class_id) is None:
        raise HTTPException(status_code=404, detail="Class not found")


def _visible_to_teacher(db: Session, student: Student, user: User):
    if user.role == "admin":
        return
    school_class = db.get(SchoolClass, student.class_id) if student.class_id else None
    if not school_class or (school_class.teacher_user_id is not None and school_class.teacher_user_id != user.id):
        raise HTTPException(status_code=403, detail="Student is not assigned to an accessible class")


@router.get("", response_model=list[StudentResponse])
def get_students(
    response: Response,
    q: str | None = Query(default=None, max_length=100),
    class_id: str | None = Query(default=None, alias="classId"),
    face_registered: bool | None = Query(default=None, alias="faceRegistered"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(reader),
):
    statement = select(Student)
    if user.role == "teacher":
        statement = statement.join(SchoolClass, Student.class_id == SchoolClass.id).where(
            or_(SchoolClass.teacher_user_id.is_(None), SchoolClass.teacher_user_id == user.id)
        )
    if q:
        needle = q.strip().lower()
        statement = statement.where(or_(
            func.lower(Student.id).contains(needle, autoescape=True),
            func.lower(Student.name).contains(needle, autoescape=True),
            func.lower(Student.email).contains(needle, autoescape=True),
        ))
    if class_id is not None:
        statement = statement.where(Student.class_id == class_id)
    if face_registered is not None:
        statement = statement.where(Student.face_registered == face_registered)
    response.headers["X-Total-Count"] = str(db.scalar(select(func.count()).select_from(statement.subquery())) or 0)
    response.headers["X-Limit"] = str(limit)
    response.headers["X-Offset"] = str(offset)
    return db.scalars(statement.order_by(Student.id).limit(limit).offset(offset)).all()


@router.get("/{student_id}", response_model=StudentResponse)
def get_student(student_id: str, db: Session = Depends(get_db), user: User = Depends(reader)):
    student = _student(db, student_id)
    _visible_to_teacher(db, student, user)
    return student


@router.post("", response_model=StudentResponse, status_code=201)
def add_student(data: StudentCreate, db: Session = Depends(get_db), _admin: User = Depends(admin)):
    if db.get(Student, data.id):
        raise HTTPException(status_code=409, detail="Student ID already exists")
    _class_exists(db, data.class_id)
    student = Student(
        id=data.id, name=data.name, first_name=data.first_name, last_name=data.last_name,
        email=data.email, phone=data.phone, class_id=data.class_id,
        face_registered=False, consent_status="unknown",
        joined_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
    )
    db.add(student)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Student ID already exists")
    db.refresh(student)
    return student


@router.put("/{student_id}", response_model=StudentResponse)
def update_student(student_id: str, data: StudentUpdate, db: Session = Depends(get_db), _admin: User = Depends(admin)):
    student = _student(db, student_id)
    patch = data.model_dump(exclude_unset=True)
    if not patch:
        raise HTTPException(status_code=422, detail="Provide at least one field to update")
    if "name" in patch and patch["name"] is None:
        raise HTTPException(status_code=422, detail="Name cannot be null")
    if "class_id" in patch:
        _class_exists(db, patch["class_id"])
    if "name" in patch and patch["name"] is not None:
        parts = patch["name"].strip().split(" ", 1)
        patch["first_name"] = parts[0]
        patch["last_name"] = parts[1] if len(parts) > 1 else ""
    elif "first_name" in patch or "last_name" in patch:
        first = patch.get("first_name", student.first_name) or ""
        last = patch.get("last_name", student.last_name) or ""
        if not first:
            raise HTTPException(status_code=422, detail="First name cannot be empty")
        patch["name"] = f"{first} {last}".strip()
    for key, value in patch.items():
        setattr(student, key, value)
    db.commit()
    db.refresh(student)
    return student


@router.delete("/{student_id}", status_code=204)
def delete_student(student_id: str, db: Session = Depends(get_db), _admin: User = Depends(admin)):
    student = _student(db, student_id)
    if db.scalar(select(AttendanceRecord.id).where(AttendanceRecord.student_id == student_id).limit(1)):
        raise HTTPException(status_code=409, detail="Student has attendance history; deletion would erase a record")
    db.delete(student)
    db.commit()
