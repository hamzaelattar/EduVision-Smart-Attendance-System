from datetime import date as Date, datetime, timezone

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import User
from schemas.reports import DashboardStats, ReportResponse
from services.auth import require_roles
from services.reports import csv_bytes, report_data, xlsx_bytes

dashboard_router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])
reports_router = APIRouter(prefix="/api/reports", tags=["Reports"])
reader = require_roles("admin", "teacher")


def filters(from_date: Date | None = Query(default=None, alias="from"),
            to_date: Date | None = Query(default=None, alias="to"),
            class_id: str | None = Query(default=None, alias="classId"),
            course_id: str | None = Query(default=None, alias="courseId")):
    return {"from_date": from_date, "to_date": to_date, "class_id": class_id, "course_id": course_id}


@dashboard_router.get("/stats", response_model=DashboardStats)
def dashboard_stats(db: Session = Depends(get_db), user: User = Depends(reader)):
    today = datetime.now(timezone.utc).date()
    report, _ = report_data(db, user, today, today)
    return DashboardStats(
        total_students=report["total_students"], present_today=report["present"],
        absent_today=report["absent"], late_today=report["late"],
        excused_today=report["excused"], unverified_today=report["unverified_draft_records"],
        attendance_rate=report["attendance_rate"], finalized_sessions_today=report["finalized_sessions"],
    )


@reports_router.get("", response_model=ReportResponse)
def reports(params: dict = Depends(filters), db: Session = Depends(get_db), user: User = Depends(reader)):
    return report_data(db, user, **params)[0]


@reports_router.get("/export.csv")
def export_csv(params: dict = Depends(filters), db: Session = Depends(get_db), user: User = Depends(reader)):
    rows = report_data(db, user, **params)[1]
    return Response(csv_bytes(rows), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": 'attachment; filename="eduvision-attendance.csv"'})


@reports_router.get("/export.xlsx")
def export_xlsx(params: dict = Depends(filters), db: Session = Depends(get_db), user: User = Depends(reader)):
    rows = report_data(db, user, **params)[1]
    return Response(xlsx_bytes(rows), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": 'attachment; filename="eduvision-attendance.xlsx"'})
