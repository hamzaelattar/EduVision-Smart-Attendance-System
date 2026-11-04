import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from database.migrate import migrate_database


class MigrationTests(unittest.TestCase):
    def test_legacy_student_is_preserved_and_backup_is_readable(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "eduvision.db"
            with closing(sqlite3.connect(path)) as db:
                db.execute("CREATE TABLE students (id VARCHAR(30) PRIMARY KEY, name VARCHAR(100) NOT NULL)")
                db.execute("INSERT INTO students(id,name) VALUES (?,?)", ("ST-01", "Ada Lovelace"))
                db.commit()
            backup = migrate_database(path)
            self.assertIsNotNone(backup)
            with closing(sqlite3.connect(path)) as db:
                self.assertEqual(db.execute("PRAGMA user_version").fetchone()[0], 1)
                self.assertEqual(db.execute("SELECT id,name,first_name,last_name FROM students").fetchone(),
                                 ("ST-01", "Ada Lovelace", "Ada", "Lovelace"))
                self.assertIn("attendance_records", {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")})
            with closing(sqlite3.connect(backup)) as db:
                self.assertEqual(db.execute("SELECT id,name FROM students").fetchone(), ("ST-01", "Ada Lovelace"))
            self.assertIsNone(migrate_database(path))


if __name__ == "__main__":
    unittest.main()
