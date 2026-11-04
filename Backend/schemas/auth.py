from pydantic import Field

from schemas.common import ApiModel


class LoginRequest(ApiModel):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=1024)


class UserCreate(ApiModel):
    username: str = Field(min_length=3, max_length=80, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=12, max_length=1024)
    role: str = Field(pattern=r"^(admin|teacher)$")


class UserResponse(ApiModel):
    id: int
    username: str
    role: str
    active: bool


class TokenResponse(ApiModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: str
    user: UserResponse
