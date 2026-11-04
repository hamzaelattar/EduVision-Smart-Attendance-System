"""Classes, courses, and student assignment."""

from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import AttendanceSession, Course, SchoolClass, Student, User
from schemas.academics import (ClassCreate, ClassResponse, ClassUpdate,
                               CourseCreate, CourseResponse, CourseUpdate)
from services.auth import require_roles

classes_router = APIRouter(prefix="/api/classes", tags=["Classes"])
courses_router = APIRouter(prefix="/api/courses", tags=["Courses"])
reader = require_roles("admin", "teacher")
admin = require_roles("admin")


def get_class_or_404(db: Session, class_id: str) -> SchoolClass:
    item = db.get(SchoolClass, class_id)
    if not item:
        raise HTTPException(status_code=404, detail="Class not found")
    return item


def get_course_or_404(db: Session, course_id: str) -> Course:
    item = db.get(Course, course_id)
    if not item:
        raise HTTPException(status_code=404, detail="Course not found")
    return item


def class_response(db: Session, item: SchoolClass) -> ClassResponse:
    return ClassResponse(
        id=item.id, name=item.name, code=item.code, teacher=item.teacher, room=item.room,
        teacher_user_id=item.teacher_user_id,
        student_count=db.scalar(select(func.count(Student.id)).where(Student.class_id == item.id)) or 0,
        course_count=db.scalar(select(func.count(Course.id)).where(Course.class_id == item.id)) or 0,
    )


def check_class_visible(item: SchoolClass, user: User):
    if user.role == "teacher" and item.teacher_user_id is not None and item.teacher_user_id != user.id:
        raise HTTPException(status_code=403, detail="Class is not assigned to this teacher")


def check_teacher(db: Session, user_id: int | None):
    if user_id is not None:
        user = db.get(User, user_id)
        if not user or not user.active or user.role != "teacher":
            raise HTTPException(status_code=422, detail="teacherUserId must identify an active teacher")


def commit_unique(db: Session, message: str):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=message)


@classes_router.get("", response_model=list[ClassResponse])
def list_classes(response: Response, q: str | None = Query(default=None, max_length=100),
                 limit: int = Query(default=50, ge=1, le=100), offset: int = Query(default=0, ge=0),
                 db: Session = Depends(get_db), user: User = Depends(reader)):
    statement = select(SchoolClass)
    if user.role == "teacher":
        statement = statement.where((SchoolClass.teacher_user_id.is_(None)) | (SchoolClass.teacher_user_id == user.id))
    if q:
        statement = statement.where(func.lower(SchoolClass.name).contains(q.strip().lower(), autoescape=True))
    response.headers["X-Total-Count"] = str(db.scalar(select(func.count()).select_from(statement.subquery())) or 0)
    return [class_response(db, item) for item in db.scalars(statement.order_by(SchoolClass.code).limit(limit).offset(offset))]


@classes_router.get("/{class_id}", response_model=ClassResponse)
def get_class(class_id: str, db: Session = Depends(get_db), user: User = Depends(reader)):
    item = get_class_or_404(db, class_id)
    check_class_visible(item, user)
    return class_response(db, item)


@classes_router.post("", response_model=ClassResponse, status_code=201)
def create_class(data: ClassCreate, db: Session = Depends(get_db), _admin: User = Depends(admin)):
    check_teacher(db, data.teacher_user_id)
    item = SchoolClass(id=str(uuid4()), name=data.name.strip(), code=data.code.upper(),
                       teacher=data.teacher, room=data.room, teacher_user_id=data.teacher_user_id)
    db.add(item)
    commit_unique(db, "Class code already exists")
    return class_response(db, item)


@classes_router.put("/{class_id}", response_model=ClassResponse)
def update_class(class_id: str, data: ClassUpdate, db: Session = Depends(get_db), _admin: User = Depends(admin)):
    item = get_class_or_404(db, class_id)
    patch = data.model_dump(exclude_unset=True)
    if not patch:
        raise HTTPException(status_code=422, detail="Provide at least one field to update")
    if any(patch.get(key) is None for key in ("name", "code") if key in patch):
        raise HTTPException(status_code=422, detail="Name and code cannot be null")
    if "teacher_user_id" in patch:
        check_teacher(db, patch["teacher_user_id"])
    if "code" in patch and patch["code"]:
        patch["code"] = patch["code"].upper()
    for key, value in patch.items():
        setattr(item, key, value)
    commit_unique(db, "Class code already exists")
    return class_response(db, item)


@classes_router.delete("/{class_id}", status_code=204)
def delete_class(class_id: str, db: Session = Depends(get_db), _admin: User = Depends(admin)):
    item = get_class_or_404(db, class_id)
    if db.scalar(select(AttendanceSession.id).where(AttendanceSession.class_id == class_id).limit(1)):
        raise HTTPException(status_code=409, detail="Class has attendance sessions; preserve history")
    db.query(Student).filter(Student.class_id == class_id).update({Student.class_id: None})
    db.delete(item)
    db.commit()


@classes_router.put("/{class_id}/students/{student_id}", response_model=ClassResponse)
def assign_student(class_id: str, student_id: str, db: Session = Depends(get_db), _admin: User = Depends(admin)):
    item = get_class_or_404(db, class_id)
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    student.class_id = class_id
    db.commit()
    return class_response(db, item)


@classes_router.delete("/{class_id}/students/{student_id}", status_code=204)
def remove_student(class_id: str, student_id: str, db: Session = Depends(get_db), _admin: User = Depends(admin)):
    get_class_or_404(db, class_id)
    student = db.get(Student, student_id)
    if not student or student.class_id != class_id:
        raise HTTPException(status_code=404, detail="Student not assigned to this class")
    student.class_id = None
    db.commit()


@courses_router.get("", response_model=list[CourseResponse])
def list_courses(response: Response, class_id: str | None = Query(default=None, alias="classId"),
                 limit: int = Query(default=50, ge=1, le=100), offset: int = Query(default=0, ge=0),
                 db: Session = Depends(get_db), user: User = Depends(reader)):
    statement = select(Course)
    if user.role == "teacher":
        statement = statement.join(SchoolClass, Course.class_id == SchoolClass.id).where(
            (SchoolClass.teacher_user_id.is_(None)) | (SchoolClass.teacher_user_id == user.id)
        )
    if class_id:
        statement = statement.where(Course.class_id == class_id)
    response.headers["X-Total-Count"] = str(db.scalar(select(func.count()).select_from(statement.subquery())) or 0)
    return db.scalars(statement.order_by(Course.code).limit(limit).offset(offset)).all()


@courses_router.get("/{course_id}", response_model=CourseResponse)
def get_course(course_id: str, db: Session = Depends(get_db), user: User = Depends(reader)):
    item = get_course_or_404(db, course_id)
    check_class_visible(get_class_or_404(db, item.class_id), user)
    return item


@courses_router.post("", response_model=CourseResponse, status_code=201)
def create_course(data: CourseCreate, db: Session = Depends(get_db), _admin: User = Depends(admin)):
    get_class_or_404(db, data.class_id)
    item = Course(id=str(uuid4()), class_id=data.class_id, name=data.name.strip(),
                  code=data.code.upper(), schedule=data.schedule)
    db.add(item)
    commit_unique(db, "Course code already exists in this class")
    return item


@courses_router.put("/{course_id}", response_model=CourseResponse)
def update_course(course_id: str, data: CourseUpdate, db: Session = Depends(get_db), _admin: User = Depends(admin)):
    item = get_course_or_404(db, course_id)
    patch = data.model_dump(exclude_unset=True)
    if not patch:
        raise HTTPException(status_code=422, detail="Provide at least one field to update")
    if any(patch.get(key) is None for key in ("name", "code") if key in patch):
        raise HTTPException(status_code=422, detail="Name and code cannot be null")
    if "code" in patch and patch["code"]:
        patch["code"] = patch["code"].upper()
    for key, value in patch.items():
        setattr(item, key, value)
    commit_unique(db, "Course code already exists in this class")
    return item


@courses_router.delete("/{course_id}", status_code=204)
def delete_course(course_id: str, db: Session = Depends(get_db), _admin: User = Depends(admin)):
    item = get_course_or_404(db, course_id)
    if db.scalar(select(AttendanceSession.id).where(AttendanceSession.course_id == course_id).limit(1)):
        raise HTTPException(status_code=409, detail="Course has attendance sessions; preserve history")
    db.delete(item)
    db.commit()
