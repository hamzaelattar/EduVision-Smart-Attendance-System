
"""EduVision FastAPI entry point. Run from the Backend directory with uvicorn main:app."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import ALLOWED_ORIGINS
from database.migrate import migrate_database
from routes.auth import router as auth_router
from routes.academics import classes_router, courses_router
from routes.attendance import attendance_router, sessions_router
from routes.reports import dashboard_router, reports_router
from routes.biometrics import biometrics_router, students_biometrics_router
from routes.recognition import recognition_socket
from database.connection import SessionLocal
from services.biometrics import purge_expired
from services.cv_client import cv_client
from routes.students import router as students_router
from routes.webrtc import close_all_cameras, router as webrtc_router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    migrate_database()

    with SessionLocal() as db:
        purge_expired(db)

    try:
        yield
    finally:
        await close_all_cameras()
        cv_client.close()


# 1. Create FastAPI application
app = FastAPI(
    title="EduVision API",
    description="Authenticated student attendance service. Candidate face matches never decide attendance.",
    version="2.0.0",
    lifespan=lifespan,
)


# 2. Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(ALLOWED_ORIGINS),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    expose_headers=["X-Total-Count", "X-Limit", "X-Offset"],
)


# 3. Basic API routes
@app.get("/")
def home():
    return {
        "application": "EduVision",
        "version": "2.0.0",
        "docs": "/docs"
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "EduVision API"
    }


# 4. Register existing routes
app.include_router(auth_router)
app.include_router(students_router)
app.include_router(classes_router)
app.include_router(courses_router)
app.include_router(sessions_router)
app.include_router(attendance_router)
app.include_router(dashboard_router)
app.include_router(reports_router)
app.include_router(students_biometrics_router)
app.include_router(biometrics_router)

app.add_api_websocket_route(
    "/ws/recognition",
    recognition_socket
)


# 5. Register WebRTC routes
app.include_router(webrtc_router)
