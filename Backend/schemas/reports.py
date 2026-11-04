from schemas.common import ApiModel


class DashboardStats(ApiModel):
    total_students: int
    present_today: int
    absent_today: int
    late_today: int
    excused_today: int
    unverified_today: int
    attendance_rate: float
    finalized_sessions_today: int


class AttendanceSlice(ApiModel):
    name: str
    present: int
    absent: int
    late: int
    excused: int
    attendance_rate: float


class HistoryPoint(ApiModel):
    date: str
    present: int
    absent: int
    late: int
    excused: int
    attendance_rate: float


class ReportResponse(ApiModel):
    total_students: int
    finalized_sessions: int
    finalized_records: int
    unverified_draft_records: int
    present: int
    absent: int
    late: int
    excused: int
    attendance_rate: float
    attendance_history: list[HistoryPoint]
    by_class: list[AttendanceSlice]
    by_course: list[AttendanceSlice]
