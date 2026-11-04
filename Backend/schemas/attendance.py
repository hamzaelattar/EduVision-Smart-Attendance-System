from datetime import date as Date, datetime, timezone
from enum import Enum

from pydantic import Field, field_validator

from schemas.common import ApiModel


class AttendanceStatus(str, Enum):
    PRESENT = "Present"
    ABSENT = "Absent"
    LATE = "Late"
    EXCUSED = "Excused"
    UNVERIFIED = "Unverified"


class SessionCreate(ApiModel):
    class_id: str
    course_id: str
    date: Date = Field(default_factory=lambda: datetime.now(timezone.utc).date())
    start_time: str = Field(default_factory=lambda: datetime.now(timezone.utc).strftime("%H:%M"), pattern=r"^([01]\d|2[0-3]):[0-5]\d$")


class SessionResponse(ApiModel):
    id: str
    class_id: str
    course_id: str
    date: str
    start_time: str
    end_time: str | None
    status: str
    created_by: int
    finalized_by: int | None
    finalized_at: str | None
    teacher_note: str | None


class AttendanceUpdate(ApiModel):
    status: AttendanceStatus
    confirmed: bool

    @field_validator("confirmed")
    @classmethod
    def require_confirmation(cls, value):
        if not value:
            raise ValueError("Teacher confirmation is required")
        return value


class AttendanceResponse(ApiModel):
    id: str
    session_id: str
    student_id: str
    status: AttendanceStatus
    updated_by: int | None
    updated_at: str | None


class FinalizeRequest(ApiModel):
    confirmed: bool
    teacher_note: str | None = Field(default=None, max_length=500)

    @field_validator("confirmed")
    @classmethod
    def require_confirmation(cls, value):
        if not value:
            raise ValueError("Teacher confirmation is required")
        return value
