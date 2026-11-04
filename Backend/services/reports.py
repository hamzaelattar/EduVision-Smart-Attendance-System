"""Finalized attendance aggregation and safe exports."""

import csv
import io
import zipfile
from collections import defaultdict
from datetime import date as Date
from xml.sax.saxutils import escape

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from database.models import AttendanceRecord, AttendanceSession, Course, SchoolClass, Student, User

MAX_REPORT_ROWS = 10_000
HEADERS = ["Date", "Class", "Course", "Student ID", "Student", "Status", "Session ID"]


def _rate(counts: dict[str, int]) -> float:
    denominator = counts["Present"] + counts["Late"] + counts["Absent"]
    return round(100 * (counts["Present"] + counts["Late"]) / denominator, 1) if denominator else 0.0


def _counts():
    return {"Present": 0, "Absent": 0, "Late": 0, "Excused": 0}


def report_data(db: Session, user: User, from_date: Date | None = None, to_date: Date | None = None,
                class_id: str | None = None, course_id: str | None = None):
    if from_date and to_date and from_date > to_date:
        raise HTTPException(status_code=422, detail="from must be on or before to")
    if from_date and to_date and (to_date - from_date).days > 366:
        raise HTTPException(status_code=422, detail="Report range must be at most 366 days")
    statement = (select(AttendanceRecord, AttendanceSession, Student, SchoolClass, Course)
                 .join(AttendanceSession, AttendanceRecord.session_id == AttendanceSession.id)
                 .join(Student, AttendanceRecord.student_id == Student.id)
                 .join(SchoolClass, AttendanceSession.class_id == SchoolClass.id)
                 .join(Course, AttendanceSession.course_id == Course.id)
                 .where(AttendanceSession.status == "Finalized"))
    draft = (select(func.count(AttendanceRecord.id))
             .join(AttendanceSession, AttendanceRecord.session_id == AttendanceSession.id)
             .join(SchoolClass, AttendanceSession.class_id == SchoolClass.id)
             .where(AttendanceSession.status == "Draft", AttendanceRecord.status == "Unverified"))
    if user.role == "teacher":
        visibility = or_(SchoolClass.teacher_user_id.is_(None), SchoolClass.teacher_user_id == user.id)
        statement = statement.where(visibility)
        draft = draft.where(visibility)
    if class_id:
        statement = statement.where(AttendanceSession.class_id == class_id)
        draft = draft.where(AttendanceSession.class_id == class_id)
    if course_id:
        statement = statement.where(AttendanceSession.course_id == course_id)
        draft = draft.where(AttendanceSession.course_id == course_id)
    if from_date:
        statement = statement.where(AttendanceSession.date >= from_date.isoformat())
        draft = draft.where(AttendanceSession.date >= from_date.isoformat())
    if to_date:
        statement = statement.where(AttendanceSession.date <= to_date.isoformat())
        draft = draft.where(AttendanceSession.date <= to_date.isoformat())
    rows = db.execute(statement.order_by(AttendanceSession.date.desc()).limit(MAX_REPORT_ROWS + 1)).all()
    if len(rows) > MAX_REPORT_ROWS:
        raise HTTPException(status_code=413, detail="Report exceeds 10,000 rows; narrow the filters")
    overall, by_date, by_class, by_course = _counts(), defaultdict(_counts), defaultdict(_counts), defaultdict(_counts)
    export_rows = []
    finalized_sessions = set()
    for record, session, student, school_class, course in rows:
        if record.status not in overall:
            continue  # a legacy Unverified record can never inflate decided statistics
        finalized_sessions.add(session.id)
        overall[record.status] += 1
        by_date[session.date][record.status] += 1
        by_class[school_class.name][record.status] += 1
        by_course[course.name][record.status] += 1
        export_rows.append([session.date, school_class.name, course.name, student.id,
                            student.name, record.status, session.id])
    def series(name, values):
        return {"name": name, "present": values["Present"], "absent": values["Absent"],
                "late": values["Late"], "excused": values["Excused"], "attendance_rate": _rate(values)}
    student_query = select(func.count(Student.id))
    if user.role == "teacher":
        student_query = student_query.join(SchoolClass, Student.class_id == SchoolClass.id).where(
            or_(SchoolClass.teacher_user_id.is_(None), SchoolClass.teacher_user_id == user.id)
        )
    if class_id:
        student_query = student_query.where(Student.class_id == class_id)
    summary = {
        "total_students": db.scalar(student_query) or 0,
        "finalized_sessions": len(finalized_sessions),
        "finalized_records": len(export_rows),
        "unverified_draft_records": db.scalar(draft) or 0,
        "present": overall["Present"], "absent": overall["Absent"],
        "late": overall["Late"], "excused": overall["Excused"],
        "attendance_rate": _rate(overall),
        "attendance_history": [{"date": date, **{key.lower(): value for key, value in values.items()},
                                "attendance_rate": _rate(values)} for date, values in sorted(by_date.items())],
        "by_class": [series(name, values) for name, values in sorted(by_class.items())],
        "by_course": [series(name, values) for name, values in sorted(by_course.items())],
    }
    return summary, export_rows


def csv_bytes(rows: list[list[str]]) -> bytes:
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(HEADERS)
    for row in rows:
        writer.writerow([f"'{value}" if value.startswith(("=", "+", "-", "@")) else value for value in row])
    return ("\ufeff" + output.getvalue()).encode("utf-8")


def _column(index: int) -> str:
    result = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        result = chr(65 + remainder) + result
    return result


def xlsx_bytes(rows: list[list[str]]) -> bytes:
    """Minimal standards-compliant XLSX with inline strings; no formulas or macros."""
    sheet_rows = []
    for row_index, row in enumerate([HEADERS, *rows], 1):
        cells = []
        for column_index, value in enumerate(row, 1):
            safe = escape(str(value), {'"': '&quot;'})
            cells.append(f'<c r="{_column(column_index)}{row_index}" t="inlineStr"><is><t xml:space="preserve">{safe}</t></is></c>')
        sheet_rows.append(f'<row r="{row_index}">{"".join(cells)}</row>')
    sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + "".join(sheet_rows) + '</sheetData></worksheet>'
    content_types = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'
    rels = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
    workbook = '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Attendance" sheetId="1" r:id="rId1"/></sheets></workbook>'
    workbook_rels = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, contents in (("[Content_Types].xml", content_types), ("_rels/.rels", rels),
                               ("xl/workbook.xml", workbook), ("xl/_rels/workbook.xml.rels", workbook_rels),
                               ("xl/worksheets/sheet1.xml", sheet)):
            archive.writestr(name, contents)
    return output.getvalue()
