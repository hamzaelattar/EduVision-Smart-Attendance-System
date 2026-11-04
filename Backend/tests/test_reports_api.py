import io
import json
import unittest
import urllib.request
import zipfile

from http_harness import ApiServer


class ReportApiTests(unittest.TestCase):
    def test_only_finalized_decisions_count_and_exports_open(self):
        with ApiServer() as api:
            class_id = api.request("POST", "/api/classes", {"name": "Math", "code": "MATH-1"})[1]["id"]
            course_id = api.request("POST", "/api/courses", {"classId": class_id, "name": "Algebra", "code": "ALG-1"})[1]["id"]
            api.request("POST", "/api/students", {"id": "ST-01", "name": "Ada Lovelace", "classId": class_id})
            session_id = api.request("POST", "/api/sessions", {"classId": class_id, "courseId": course_id, "date": "2026-11-03"})[1]["id"]
            record_id = api.request("GET", f"/api/attendance?sessionId={session_id}")[1][0]["id"]
            report = api.request("GET", "/api/reports")[1]
            self.assertEqual((report["absent"], report["present"], report["unverifiedDraftRecords"]), (0, 0, 1))
            api.request("PUT", f"/api/attendance/{record_id}", {"status": "Present", "confirmed": True})
            api.request("POST", f"/api/sessions/{session_id}/finalize", {"confirmed": True})
            report = api.request("GET", "/api/reports")[1]
            self.assertEqual((report["present"], report["attendanceRate"], report["finalizedRecords"]), (1, 100.0, 1))
            headers = {"Authorization": f"Bearer {api.token}"}
            with urllib.request.urlopen(urllib.request.Request(api.base_url + "/api/reports/export.csv", headers=headers)) as response:
                self.assertIn(b"Ada Lovelace", response.read())
            with urllib.request.urlopen(urllib.request.Request(api.base_url + "/api/reports/export.xlsx", headers=headers)) as response:
                workbook = response.read()
            with zipfile.ZipFile(io.BytesIO(workbook)) as archive:
                self.assertIn("xl/worksheets/sheet1.xml", archive.namelist())
                self.assertIn(b"Ada Lovelace", archive.read("xl/worksheets/sheet1.xml"))


if __name__ == "__main__":
    unittest.main()
