"""Explicit, idempotent SQLite migration with an online backup of existing data."""

import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from config import DATABASE_PATH

SCHEMA_VERSION = 2


def _backup(path: Path) -> Path:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    destination = path.with_name(f"{path.name}.bak.{stamp}.{uuid4().hex[:8]}")
    with closing(sqlite3.connect(path)) as source, closing(sqlite3.connect(destination)) as target:
        source.backup(target)
    return destination


def migrate_database(path: Path = DATABASE_PATH) -> Path | None:
    path = Path(path).resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    existed = path.exists()
    with closing(sqlite3.connect(path)) as conn:
        version = conn.execute("PRAGMA user_version").fetchone()[0]
    if version == SCHEMA_VERSION:
        return None
    if version > SCHEMA_VERSION:
        raise RuntimeError(f"Database schema {version} is newer than this application ({SCHEMA_VERSION})")
    backup = _backup(path) if existed else None
    with closing(sqlite3.connect(path)) as conn:
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("BEGIN IMMEDIATE")
        try:
            conn.execute("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username VARCHAR(80) NOT NULL UNIQUE, password_hash VARCHAR(200) NOT NULL, role VARCHAR(16) NOT NULL CHECK(role IN ('admin','teacher')), active INTEGER NOT NULL DEFAULT 1)")
            conn.execute("CREATE TABLE IF NOT EXISTS classes (id VARCHAR(36) PRIMARY KEY, name VARCHAR(120) NOT NULL, code VARCHAR(30) NOT NULL UNIQUE, teacher VARCHAR(120), room VARCHAR(80), teacher_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL)")
            student_exists = conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='students'").fetchone()
            if not student_exists:
                conn.execute("CREATE TABLE students (id VARCHAR(30) PRIMARY KEY, name VARCHAR(100) NOT NULL, first_name VARCHAR(60), last_name VARCHAR(60), email VARCHAR(254), phone VARCHAR(40), class_id VARCHAR(36) REFERENCES classes(id) ON DELETE SET NULL, face_registered INTEGER NOT NULL DEFAULT 0, consent_status VARCHAR(16) NOT NULL DEFAULT 'unknown', joined_at VARCHAR(32))")
            else:
                existing = {row[1] for row in conn.execute("PRAGMA table_info(students)")}
                additions = {
                    "first_name": "VARCHAR(60)", "last_name": "VARCHAR(60)", "email": "VARCHAR(254)",
                    "phone": "VARCHAR(40)", "class_id": "VARCHAR(36) REFERENCES classes(id) ON DELETE SET NULL",
                    "face_registered": "INTEGER NOT NULL DEFAULT 0", "consent_status": "VARCHAR(16) NOT NULL DEFAULT 'unknown'",
                    "joined_at": "VARCHAR(32)",
                }
                for column, ddl in additions.items():
                    if column not in existing:
                        conn.execute(f"ALTER TABLE students ADD COLUMN {column} {ddl}")
                for student_id, name, first, last in conn.execute("SELECT id,name,first_name,last_name FROM students"):
                    if not first:
                        parts = name.strip().split(" ", 1)
                        conn.execute("UPDATE students SET first_name=?, last_name=? WHERE id=?", (parts[0], parts[1] if len(parts) > 1 else "", student_id))
            conn.execute("CREATE TABLE IF NOT EXISTS courses (id VARCHAR(36) PRIMARY KEY, class_id VARCHAR(36) NOT NULL REFERENCES classes(id) ON DELETE CASCADE, name VARCHAR(120) NOT NULL, code VARCHAR(30) NOT NULL, schedule VARCHAR(120), UNIQUE(class_id,code))")
            conn.execute("CREATE TABLE IF NOT EXISTS auth_tokens (token_hash VARCHAR(64) PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at VARCHAR(32) NOT NULL)")
            conn.execute("CREATE TABLE IF NOT EXISTS attendance_sessions (id VARCHAR(36) PRIMARY KEY, class_id VARCHAR(36) NOT NULL REFERENCES classes(id), course_id VARCHAR(36) NOT NULL REFERENCES courses(id), date VARCHAR(10) NOT NULL, start_time VARCHAR(5) NOT NULL, end_time VARCHAR(5), status VARCHAR(16) NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft','Finalized')), created_by INTEGER NOT NULL REFERENCES users(id), finalized_by INTEGER REFERENCES users(id), finalized_at VARCHAR(32), teacher_note VARCHAR(500))")
            conn.execute("CREATE TABLE IF NOT EXISTS attendance_records (id VARCHAR(36) PRIMARY KEY, session_id VARCHAR(36) NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE, student_id VARCHAR(30) NOT NULL REFERENCES students(id), status VARCHAR(16) NOT NULL DEFAULT 'Unverified' CHECK(status IN ('Present','Absent','Late','Excused','Unverified')), updated_by INTEGER REFERENCES users(id), updated_at VARCHAR(32), UNIQUE(session_id,student_id))")
            conn.execute("CREATE TABLE IF NOT EXISTS biometric_templates (student_id VARCHAR(30) PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE, ciphertext BLOB NOT NULL, consent_at VARCHAR(32) NOT NULL, expires_at VARCHAR(32) NOT NULL, captured_count INTEGER NOT NULL)")
            conn.execute("CREATE INDEX IF NOT EXISTS ix_students_class_id ON students(class_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS ix_sessions_date ON attendance_sessions(date)")
            conn.execute("CREATE INDEX IF NOT EXISTS ix_attendance_session ON attendance_records(session_id)")
            conn.execute("CREATE TABLE IF NOT EXISTS camera_devices (id VARCHAR(30) PRIMARY KEY, name VARCHAR(120) NOT NULL, room VARCHAR(80), secret_hash VARCHAR(64) NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, session_id VARCHAR(36) REFERENCES attendance_sessions(id) ON DELETE SET NULL, created_at VARCHAR(32) NOT NULL)")
            conn.execute("CREATE INDEX IF NOT EXISTS ix_camera_session ON camera_devices(session_id)")
            conn.execute("PRAGMA user_version=2")
            conn.commit()
        except Exception:
            conn.rollback()
            raise
    return backup


if __name__ == "__main__":
    backup = migrate_database()
    print(f"Schema version {SCHEMA_VERSION}; backup: {backup or 'not needed'}")
