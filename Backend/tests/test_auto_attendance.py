"""Automatic presence requires repeated strong matches and a valid draft roster."""

import asyncio
import sqlite3
import tempfile
import unittest
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import sessionmaker

from database.migrate import migrate_database
from routes import webrtc


class AutomaticAttendanceTests(unittest.TestCase):
    def test_only_three_consecutive_strong_matches_qualify(self):
        live = webrtc.LiveCamera(publisher=None)
        strong = [{"candidateStudentId": "STU-1", "status": "Candidate Match"}]
        uncertain = [{"candidateStudentId": "STU-1", "status": "Needs Verification"}]
        self.assertEqual(webrtc._confirmed_faces(live, strong, 1), set())
        self.assertEqual(webrtc._confirmed_faces(live, uncertain, 2), set())
        self.assertEqual(webrtc._confirmed_faces(live, strong, 3), set())
        self.assertEqual(webrtc._confirmed_faces(live, strong, 4), set())
        self.assertEqual(webrtc._confirmed_faces(live, strong, 5), {"STU-1"})
        self.assertEqual(webrtc._confirmed_faces(live, strong, 12), set())

    def test_recording_respects_consent_session_and_manual_decisions(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "attendance.db"
            migrate_database(path)
            expires = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(timespec="seconds")
            with closing(sqlite3.connect(path)) as db, db:
                db.execute("INSERT INTO users(id,username,password_hash,role,active) VALUES (1,'admin','x','admin',1)")
                db.execute("INSERT INTO classes(id,name,code) VALUES ('CLASS-1','Test','TEST')")
                db.execute("INSERT INTO courses(id,class_id,name,code) VALUES ('COURSE-1','CLASS-1','Test','TEST')")
                db.execute("INSERT INTO students(id,name,class_id,face_registered,consent_status) VALUES ('STU-1','Student One','CLASS-1',1,'consented')")
                db.execute("INSERT INTO attendance_sessions(id,class_id,course_id,date,start_time,status,created_by) VALUES ('SESSION-1','CLASS-1','COURSE-1','2026-11-05','09:00','Draft',1)")
                db.execute("INSERT INTO attendance_records(id,session_id,student_id,status) VALUES ('RECORD-1','SESSION-1','STU-1','Unverified')")
                db.execute("INSERT INTO biometric_templates(student_id,ciphertext,consent_at,expires_at,captured_count) VALUES ('STU-1',X'01','2026-11-05',?,1)", (expires,))
                db.execute("INSERT INTO camera_devices(id,name,secret_hash,enabled,session_id,created_at) VALUES ('CAM-001','Test','hash',1,'SESSION-1','2026-11-05')")
            engine = create_engine(URL.create("sqlite", database=str(path)))
            maker = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
            try:
                strong = [{"candidateStudentId": "STU-1", "candidateStudentName": "Student One",
                           "status": "Candidate Match", "attendanceStatus": "Unverified"}]
                live = webrtc.LiveCamera(publisher=None)
                webrtc.streams["CAM-001"] = live
                with patch.object(webrtc, "SessionLocal", maker), patch.object(
                    webrtc, "_analyze_frame", return_value=("SESSION-1", strong)
                ):
                    async def analyze_three_frames():
                        for _ in range(3):
                            await webrtc._analyze("CAM-001", live, None)

                    asyncio.run(analyze_three_frames())
                    self.assertEqual(live.candidates[0]["attendanceStatus"], "Present")
                    self.assertEqual(live.candidates[0]["attendanceSource"], "automatic")
                    with closing(sqlite3.connect(path)) as db, db:
                        status, updated_by, updated_at = db.execute("SELECT status,updated_by,updated_at FROM attendance_records WHERE id='RECORD-1'").fetchone()
                    self.assertEqual(status, "Present")
                    self.assertIsNone(updated_by)
                    self.assertIsNotNone(updated_at)

                    with closing(sqlite3.connect(path)) as db, db:
                        db.execute("UPDATE attendance_records SET status='Absent',updated_by=1 WHERE id='RECORD-1'")
                    self.assertEqual(webrtc._record_auto_presence("CAM-001", "SESSION-1", {"STU-1"}), set())
                    asyncio.run(webrtc._analyze("CAM-001", live, None))
                    self.assertEqual(live.candidates[0]["attendanceStatus"], "Absent")
                    self.assertEqual(live.candidates[0]["attendanceSource"], "manual")
                    with closing(sqlite3.connect(path)) as db, db:
                        self.assertEqual(db.execute("SELECT status FROM attendance_records WHERE id='RECORD-1'").fetchone()[0], "Absent")
                        db.execute("UPDATE attendance_records SET status='Unverified',updated_by=NULL WHERE id='RECORD-1'")
                        db.execute("UPDATE students SET consent_status='declined' WHERE id='STU-1'")
                    self.assertEqual(webrtc._record_auto_presence("CAM-001", "SESSION-1", {"STU-1"}), set())
                    with closing(sqlite3.connect(path)) as db, db:
                        db.execute("UPDATE students SET consent_status='consented' WHERE id='STU-1'")
                        db.execute("UPDATE attendance_sessions SET status='Finalized' WHERE id='SESSION-1'")
                    self.assertEqual(webrtc._record_auto_presence("CAM-001", "SESSION-1", {"STU-1"}), set())
            finally:
                webrtc.streams.pop("CAM-001", None)
                engine.dispose()


if __name__ == "__main__":
    unittest.main()
