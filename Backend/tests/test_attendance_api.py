import unittest

from http_harness import ApiServer


class AttendanceApiTests(unittest.TestCase):
    def test_unverified_is_not_absent_and_teacher_must_confirm(self):
        with ApiServer() as api:
            teacher = api.request("POST", "/api/auth/users", {
                "username": "teacher1", "password": "teacher-password-123", "role": "teacher"
            })[1]
            teacher_token = api.request("POST", "/api/auth/login", {
                "username": "teacher1", "password": "teacher-password-123"
            }, auth=False)[1]["accessToken"]
            school_class = api.request("POST", "/api/classes", {
                "name": "Physics", "code": "PHY-1", "teacherUserId": teacher["id"]
            })[1]
            class_id = school_class["id"]
            course_id = api.request("POST", "/api/courses", {
                "classId": class_id, "name": "Mechanics", "code": "MEC-1"
            })[1]["id"]
            api.request("POST", "/api/students", {"id": "ST-01", "name": "Ada Lovelace", "classId": class_id})
            session = api.request("POST", "/api/sessions", {
                "classId": class_id, "courseId": course_id, "date": "2026-11-03", "startTime": "09:00"
            }, token=teacher_token)[1]
            session_id = session["id"]
            records = api.request("GET", f"/api/attendance?sessionId={session_id}", token=teacher_token)[1]
            self.assertEqual(len(records), 1)
            self.assertEqual(records[0]["status"], "Unverified")
            self.assertEqual(api.request("POST", f"/api/sessions/{session_id}/finalize", {"confirmed": True}, token=teacher_token)[0], 409)
            self.assertEqual(api.request("PUT", f"/api/attendance/{records[0]['id']}", {"status": "Absent", "confirmed": False}, token=teacher_token)[0], 422)
            updated = api.request("PUT", f"/api/attendance/{records[0]['id']}", {"status": "Present", "confirmed": True}, token=teacher_token)[1]
            self.assertEqual(updated["status"], "Present")
            self.assertEqual(api.request("POST", f"/api/sessions/{session_id}/finalize", {"confirmed": False}, token=teacher_token)[0], 422)
            finalized = api.request("POST", f"/api/sessions/{session_id}/finalize", {"confirmed": True, "teacherNote": "Reviewed roster"}, token=teacher_token)[1]
            self.assertEqual(finalized["status"], "Finalized")
            self.assertEqual(api.request("PUT", f"/api/attendance/{records[0]['id']}", {"status": "Absent", "confirmed": True}, token=teacher_token)[0], 409)


if __name__ == "__main__":
    unittest.main()
