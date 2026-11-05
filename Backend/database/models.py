"""ORM mappings for the migrated schema."""

from sqlalchemy import Boolean, ForeignKey, Integer, LargeBinary, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from database.connection import Base


class Student(Base):
    __tablename__ = "students"
    id: Mapped[str] = mapped_column(String(30), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)  # preserved legacy column
    first_name: Mapped[str | None] = mapped_column(String(60))
    last_name: Mapped[str | None] = mapped_column(String(60))
    email: Mapped[str | None] = mapped_column(String(254))
    phone: Mapped[str | None] = mapped_column(String(40))
    class_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("classes.id", ondelete="SET NULL"))
    face_registered: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    consent_status: Mapped[str] = mapped_column(String(16), default="unknown", nullable=False)
    joined_at: Mapped[str | None] = mapped_column(String(32))


class SchoolClass(Base):
    __tablename__ = "classes"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    code: Mapped[str] = mapped_column(String(30), nullable=False, unique=True)
    teacher: Mapped[str | None] = mapped_column(String(120))
    room: Mapped[str | None] = mapped_column(String(80))
    teacher_user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"))


class Course(Base):
    __tablename__ = "courses"
    __table_args__ = (UniqueConstraint("class_id", "code", name="uq_course_class_code"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    class_id: Mapped[str] = mapped_column(String(36), ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    code: Mapped[str] = mapped_column(String(30), nullable=False)
    schedule: Mapped[str | None] = mapped_column(String(120))


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class AuthToken(Base):
    __tablename__ = "auth_tokens"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    expires_at: Mapped[str] = mapped_column(String(32), nullable=False)


class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    class_id: Mapped[str] = mapped_column(String(36), ForeignKey("classes.id"), nullable=False)
    course_id: Mapped[str] = mapped_column(String(36), ForeignKey("courses.id"), nullable=False)
    date: Mapped[str] = mapped_column(String(10), nullable=False)
    start_time: Mapped[str] = mapped_column(String(5), nullable=False)
    end_time: Mapped[str | None] = mapped_column(String(5))
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="Draft")
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    finalized_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    finalized_at: Mapped[str | None] = mapped_column(String(32))
    teacher_note: Mapped[str | None] = mapped_column(String(500))


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    __table_args__ = (UniqueConstraint("session_id", "student_id", name="uq_attendance_session_student"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("attendance_sessions.id", ondelete="CASCADE"), nullable=False)
    student_id: Mapped[str] = mapped_column(String(30), ForeignKey("students.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="Unverified")
    updated_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    updated_at: Mapped[str | None] = mapped_column(String(32))


class BiometricTemplate(Base):
    __tablename__ = "biometric_templates"
    student_id: Mapped[str] = mapped_column(String(30), ForeignKey("students.id", ondelete="CASCADE"), primary_key=True)
    ciphertext: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    consent_at: Mapped[str] = mapped_column(String(32), nullable=False)
    expires_at: Mapped[str] = mapped_column(String(32), nullable=False)
    captured_count: Mapped[int] = mapped_column(Integer, nullable=False)


class CameraDevice(Base):
    __tablename__ = "camera_devices"
    id: Mapped[str] = mapped_column(String(30), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    room: Mapped[str | None] = mapped_column(String(80))
    secret_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    session_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("attendance_sessions.id", ondelete="SET NULL"))
    created_at: Mapped[str] = mapped_column(String(32), nullable=False)
