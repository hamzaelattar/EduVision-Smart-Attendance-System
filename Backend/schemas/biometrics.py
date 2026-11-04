from pydantic import Field, field_validator

from config import DEFAULT_RETENTION_DAYS
from schemas.common import ApiModel


class ConsentRequest(ApiModel):
    consented: bool


class FaceRegistrationRequest(ApiModel):
    consent: bool
    images: list[str] = Field(min_length=1, max_length=10)
    retention_days: int = Field(default=DEFAULT_RETENTION_DAYS, ge=1, le=365)

    @field_validator("consent")
    @classmethod
    def consent_required(cls, value):
        if not value:
            raise ValueError("Explicit student consent is required")
        return value

    @field_validator("images")
    @classmethod
    def image_limits(cls, values):
        if any(len(value) > 2_100_000 for value in values):
            raise ValueError("Each image must be 1.5 MB or smaller")
        return values


class LegacyImportRequest(ApiModel):
    consent: bool
    retention_days: int = Field(default=DEFAULT_RETENTION_DAYS, ge=1, le=365)

    @field_validator("consent")
    @classmethod
    def consent_required(cls, value):
        if not value:
            raise ValueError("Explicit student consent is required")
        return value


class RegistrationResponse(ApiModel):
    student_id: str
    face_registered: bool
    consent_status: str
    expires_at: str | None = None
    captured_count: int = 0
