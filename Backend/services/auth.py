"""Password hashing, opaque access tokens, and role checks."""

import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from threading import Lock
from time import monotonic

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from config import AUTH_TOKEN_HOURS
from database.connection import get_db
from database.models import AuthToken, User

PBKDF2_ITERATIONS = 350_000
bearer = HTTPBearer(auto_error=False)
_failed_logins: dict[str, list[float]] = {}
_login_lock = Lock()


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${base64.urlsafe_b64encode(salt).decode()}${base64.urlsafe_b64encode(digest).decode()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, count, salt, expected = stored.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), base64.urlsafe_b64decode(salt), int(count))
        return hmac.compare_digest(digest, base64.urlsafe_b64decode(expected))
    except (ValueError, TypeError):
        return False


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_token(db: Session, user: User) -> tuple[str, str]:
    token = secrets.token_urlsafe(32)
    expires = (datetime.now(timezone.utc) + timedelta(hours=AUTH_TOKEN_HOURS)).isoformat(timespec="seconds")
    db.add(AuthToken(token_hash=token_hash(token), user_id=user.id, expires_at=expires))
    db.commit()
    return token, expires


def authenticate_token(db: Session, token: str | None) -> User | None:
    if not token:
        return None
    row = db.get(AuthToken, token_hash(token))
    if not row or row.expires_at <= utcnow():
        return None
    user = db.get(User, row.user_id)
    return user if user and user.active else None


def require_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> User:
    user = authenticate_token(db, credentials.credentials if credentials and credentials.scheme.lower() == "bearer" else None)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required", headers={"WWW-Authenticate": "Bearer"})
    return user


def require_roles(*roles: str):
    def dependency(user: User = Depends(require_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return dependency


def login_allowed(key: str) -> bool:
    now = monotonic()
    with _login_lock:
        attempts = [x for x in _failed_logins.get(key, []) if now - x < 900]
        _failed_logins[key] = attempts
        return len(attempts) < 5


def record_failed_login(key: str) -> None:
    with _login_lock:
        _failed_logins.setdefault(key, []).append(monotonic())


def clear_failed_logins(key: str) -> None:
    with _login_lock:
        _failed_logins.pop(key, None)
