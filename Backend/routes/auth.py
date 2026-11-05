from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from config import AUTH_TOKEN_HOURS
from database.connection import get_db
from database.models import AuthToken, User
from schemas.auth import LoginRequest, TokenResponse, UserCreate, UserResponse
from services.auth import (authenticate_token, clear_failed_logins, create_token,
                           hash_password, login_allowed, record_failed_login,
                           require_roles, require_user, token_hash, verify_password)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    key = f"{request.client.host if request.client else 'unknown'}:{data.username.lower()}"
    if not login_allowed(key):
        raise HTTPException(status_code=429, detail="Too many login attempts; try again later")
    user = db.scalar(select(User).where(User.username == data.username))
    if not user or not user.active or not verify_password(data.password, user.password_hash):
        record_failed_login(key)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    clear_failed_logins(key)
    raw, expires = create_token(db, user)
    response.set_cookie("eduvision_ws", raw, max_age=AUTH_TOKEN_HOURS * 3600,
                        httponly=True, secure=request.url.scheme == "https",
                        samesite="strict", path="/ws/recognition")
    return TokenResponse(access_token=raw, expires_at=expires, user=UserResponse.model_validate(user))


@router.post("/logout", status_code=204)
def logout(response: Response, request: Request, db: Session = Depends(get_db), user: User = Depends(require_user)):
    authorization = request.headers.get("authorization", "")
    if authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
        row = db.get(AuthToken, token_hash(token))
        if row and row.user_id == user.id:
            db.delete(row)
            db.commit()
    response.delete_cookie("eduvision_ws", path="/ws/recognition")


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(require_user)):
    return user


@router.post("/users", response_model=UserResponse, status_code=201)
def create_user(data: UserCreate, db: Session = Depends(get_db), _admin: User = Depends(require_roles("admin"))):
    user = User(username=data.username, password_hash=hash_password(data.password), role=data.role, active=True)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Username already exists")
    db.refresh(user)
    return user


@router.get("/users", response_model=list[UserResponse])
def list_users(db: Session = Depends(get_db), _admin: User = Depends(require_roles("admin"))):
    return db.scalars(select(User).order_by(User.username).limit(500)).all()
