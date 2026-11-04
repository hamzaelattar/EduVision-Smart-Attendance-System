from pydantic import Field

from schemas.common import ApiModel


class ClassCreate(ApiModel):
    name: str = Field(min_length=1, max_length=120)
    code: str = Field(min_length=1, max_length=30, pattern=r"^[A-Za-z0-9_-]+$")
    teacher: str | None = Field(default=None, max_length=120)
    room: str | None = Field(default=None, max_length=80)
    teacher_user_id: int | None = None


class ClassUpdate(ApiModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    code: str | None = Field(default=None, min_length=1, max_length=30, pattern=r"^[A-Za-z0-9_-]+$")
    teacher: str | None = Field(default=None, max_length=120)
    room: str | None = Field(default=None, max_length=80)
    teacher_user_id: int | None = None


class ClassResponse(ApiModel):
    id: str
    name: str
    code: str
    teacher: str | None
    room: str | None
    teacher_user_id: int | None
    student_count: int = 0
    course_count: int = 0


class CourseCreate(ApiModel):
    class_id: str
    name: str = Field(min_length=1, max_length=120)
    code: str = Field(min_length=1, max_length=30, pattern=r"^[A-Za-z0-9_-]+$")
    schedule: str | None = Field(default=None, max_length=120)


class CourseUpdate(ApiModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    code: str | None = Field(default=None, min_length=1, max_length=30, pattern=r"^[A-Za-z0-9_-]+$")
    schedule: str | None = Field(default=None, max_length=120)


class CourseResponse(ApiModel):
    id: str
    class_id: str
    name: str
    code: str
    schedule: str | None
