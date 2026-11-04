import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from cryptography.fernet import Fernet
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import Session

from database.migrate import migrate_database
from database.models import SchoolClass, Student
from services import biometrics


class BiometricTests(unittest.TestCase):
    def test_encryption_matching_consent_and_retention(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "biometrics.db"
            migrate_database(path)
            engine = create_engine(URL.create("sqlite", database=str(path)))
            original = biometrics.BIOMETRIC_KEY
            biometrics.BIOMETRIC_KEY = Fernet.generate_key().decode()
            try:
                with Session(engine) as db:
                    school_class = SchoolClass(id="CLASS-1", name="Class 1", code="CLASS-1")
                    other_class = SchoolClass(id="CLASS-2", name="Class 2", code="CLASS-2")
                    db.add_all([school_class, other_class])
                    student = Student(id="ST-01", name="Ada Lovelace", first_name="Ada", last_name="Lovelace",
                                      class_id=school_class.id, face_registered=False, consent_status="unknown")
                    db.add(student)
                    db.commit()
                    vector = [1.0] + [0.0] * 511
                    biometrics.store_template(db, student, vector, 1, 30)
                    with closing(sqlite3.connect(path)) as raw:
                        ciphertext = raw.execute("SELECT ciphertext FROM biometric_templates").fetchone()[0]
                    self.assertNotIn(b"[1.0", ciphertext)
                    matched = biometrics.match_detections(db, [{"box": [1, 2, 3, 4], "embedding": vector, "confidence": .9}])
                    self.assertEqual(matched[0]["status"], "Candidate Match")
                    self.assertEqual(matched[0]["attendanceStatus"], "Unverified")
                    self.assertNotIn("embedding", matched[0])
                    outside_class = biometrics.match_detections(
                        db, [{"box": [1, 2, 3, 4], "embedding": vector, "confidence": .9}], other_class.id)
                    self.assertEqual(outside_class[0]["status"], "Unknown")
                    self.assertIsNone(outside_class[0]["candidateStudentId"])
                    from database.models import BiometricTemplate
                    db.get(BiometricTemplate, student.id).expires_at = "2000-01-01T00:00:00+00:00"
                    db.commit()
                    self.assertEqual(biometrics.purge_expired(db), 1)
                    self.assertFalse(student.face_registered)
                    biometrics.revoke_template(db, student, declined=True)
                    self.assertEqual(student.consent_status, "declined")
            finally:
                biometrics.BIOMETRIC_KEY = original
                engine.dispose()


if __name__ == "__main__":
    unittest.main()
