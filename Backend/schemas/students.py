import re

from pydantic import Field, field_validator, model_validator

from schemas.common import ApiModel

ID_PATTERN = r"^[A-Za-z0-9_-]{1,30}$"


class StudentCreate(ApiModel):
    id: str = Field(pattern=ID_PATTERN)
    name: str | None = Field(default=None, min_length=1, max_length=100)
    first_name: str | None = Field(default=None, min_length=1, max_length=60)
    last_name: str | None = Field(default=None, max_length=60)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=40)
    class_id: str | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, value):
        if value is not None and not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Enter a valid email address")
        return value

    @model_validator(mode="after")
    def complete_name(self):
        if self.name and not self.first_name:
            parts = self.name.strip().split(" ", 1)
            self.first_name = parts[0]
            self.last_name = parts[1] if len(parts) > 1 else ""
        elif self.first_name:
            self.name = f"{self.first_name} {self.last_name or ''}".strip()
        else:
            raise ValueError("Provide name or firstName")
        return self


class StudentUpdate(ApiModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    first_name: str | None = Field(default=None, min_length=1, max_length=60)
    last_name: str | None = Field(default=None, max_length=60)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=40)
    class_id: str | None = None

    _validate_email = field_validator("email")(StudentCreate.validate_email.__func__)


class StudentResponse(ApiModel):
    id: str
    name: str
    first_name: str | None
    last_name: str | None
    email: str | None
    phone: str | None
    class_id: str | None
    face_registered: bool
    consent_status: str
    joined_at: str | None
