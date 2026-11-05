import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from database.migrate import SCHEMA_VERSION, migrate_database


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
                self.assertEqual(db.execute("PRAGMA user_version").fetchone()[0], SCHEMA_VERSION)
                self.assertEqual(db.execute("SELECT id,name,first_name,last_name FROM students").fetchone(),
                                 ("ST-01", "Ada Lovelace", "Ada", "Lovelace"))
                self.assertIn("attendance_records", {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")})
                self.assertIn("camera_devices", {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")})
            with closing(sqlite3.connect(backup)) as db:
                self.assertEqual(db.execute("SELECT id,name FROM students").fetchone(), ("ST-01", "Ada Lovelace"))
            self.assertIsNone(migrate_database(path))

    def test_version_one_database_upgrades_without_losing_users(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "eduvision.db"
            migrate_database(path)
            with closing(sqlite3.connect(path)) as db:
                db.execute("INSERT INTO users(username,password_hash,role,active) VALUES ('admin','hash','admin',1)")
                db.execute("PRAGMA user_version=1")
                db.commit()
            backup = migrate_database(path)
            self.assertIsNotNone(backup)
            with closing(sqlite3.connect(path)) as db:
                self.assertEqual(db.execute("PRAGMA user_version").fetchone()[0], SCHEMA_VERSION)
                self.assertEqual(db.execute("SELECT username FROM users").fetchone()[0], "admin")


if __name__ == "__main__":
    unittest.main()
