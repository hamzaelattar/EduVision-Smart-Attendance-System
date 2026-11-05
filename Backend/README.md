# EduVision API

This backend extends the existing FastAPI and SQLite project. It preserves the legacy `students(id, name)` columns and adds explicit, backed-up schema migrations. The React `/iot` console uses the live API; the older UI pages remain local demos. See the root `README.md` for the end-to-end setup.

## Environment and startup

Use the existing `EDUVISION_API` Conda environment. The backend requires the versions in `requirement.txt`; `cryptography` encrypts new biometric templates, and `websockets` enables Uvicorn's WebSocket protocol. The existing `OPENCV` environment runs the separate CV worker and was not changed.

In PowerShell:

```powershell
conda activate EDUVISION_API
cd "H:\Automatic Student Attendance System\Backend"
python -m pip install -r requirement.txt
python -m database.migrate
python -m scripts.create_admin admin
```

The admin command asks for a password of at least 12 characters and creates the first admin only. It does not print or store the plaintext password. The migrated existing database has a backup next to it named `eduvision.db.bak.<UTC timestamp>.<suffix>`; migrations are idempotent and never recreate the existing database. Migration version is in SQLite `PRAGMA user_version`.

Before using biometric registration or recognition, generate a Fernet key once and keep it in a secure secret store. Set it as `EDUVISION_BIOMETRIC_KEY` for **every** server launch. Do not regenerate it after enrolling students; losing it makes encrypted templates unreadable. One way to generate a key is:

```powershell
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
$env:EDUVISION_BIOMETRIC_KEY = '<the-generated-key>'
$env:EDUVISION_CV_PYTHON = 'F:\anaconda\envs\OPENCV\python.exe'
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --ws-max-size 2200000
```

Visit `http://127.0.0.1:8000/docs` for generated request/response schemas. `/api/health` is public. All student, academic, attendance, report, and biometric endpoints require a Bearer token. The first admin must be created locally before data routes can be used.

### Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `EDUVISION_DATABASE_PATH` | `Backend/database/eduvision.db` | SQLite file |
| `EDUVISION_CV_PYTHON` | `F:\anaconda\envs\OPENCV\python.exe` | Existing CV interpreter |
| `EDUVISION_BIOMETRIC_KEY` | unset | Fernet key for encrypted templates; required for registration and recognition |
| `EDUVISION_ALLOWED_ORIGINS` | both Vite port 5173 origins | CORS and WebSocket Origin allowlist |
| `EDUVISION_AUTH_TOKEN_HOURS` | `8` | Access token lifetime |
| `EDUVISION_RETENTION_DAYS` | `30` | Default template expiry; per-registration override 1–365 days |
| `EDUVISION_MAX_FRAME_BYTES` | `1500000` | Maximum decoded JPEG size |
| `EDUVISION_MAX_FRAME_RATE` | `2` | Frames accepted per second per socket |
| `EDUVISION_MATCH_THRESHOLD` | `0.65` | Candidate-match threshold |
| `EDUVISION_UNCERTAIN_THRESHOLD` | `0.45` | Needs-verification threshold |

The configuration file `.env.example` is a reference; the app reads process environment variables and does not automatically load `.env` files.

## Authentication and roles

`POST /api/auth/login` accepts `{"username":"admin","password":"..."}` and returns `accessToken`, `expiresAt`, and the user. Send `Authorization: Bearer <accessToken>` to REST routes. It also sets an HttpOnly cookie limited to `/ws/recognition` for a browser WebSocket connection. `GET /api/auth/me` returns the current user; `POST /api/auth/logout` revokes the token; an admin can create `admin` or `teacher` accounts via `POST /api/auth/users`.

Admins manage students, classes, courses, consent, and biometric registration. Teachers can read assigned class data and manage attendance sessions. A class with `teacherUserId` restricts teacher access to that teacher; an unassigned class is visible to all teachers for existing workflows. Passwords use salted PBKDF2 hashing, and random opaque access tokens are stored as SHA-256 hashes. Login attempts are rate limited.

## REST endpoints

All JSON uses camelCase field names. Lists remain JSON arrays for the current frontend API service and expose `X-Total-Count` for pagination. `limit` and `offset` are query parameters.

| Method | Route | Role | Notes |
| --- | --- | --- | --- |
| GET, POST | `/api/students` | teacher/admin read; admin write | `q`, `classId`, `faceRegistered`, `limit`, `offset` |
| GET, PUT, DELETE | `/api/students/{id}` | teacher/admin read; admin write | Legacy `name` input remains valid; deletion refuses existing attendance history |
| GET, POST | `/api/classes` | teacher/admin read; admin write | Search and pagination |
| GET, PUT, DELETE | `/api/classes/{id}` | teacher/admin read; admin write | Deletion refuses attendance history |
| PUT, DELETE | `/api/classes/{id}/students/{studentId}` | admin | Assign or remove student |
| GET, POST | `/api/courses` | teacher/admin read; admin write | Filter with `classId` |
| GET, PUT, DELETE | `/api/courses/{id}` | teacher/admin read; admin write | Deletion refuses attendance history |
| GET, POST | `/api/sessions` | teacher/admin | `classId`, `courseId`, `date`, `status` filters |
| GET | `/api/sessions/{id}` | teacher/admin | Session details |
| PUT | `/api/sessions/{id}/end` | teacher/admin | End a draft session |
| POST | `/api/sessions/{id}/finalize` | teacher/admin | Requires `{"confirmed":true}` and no Unverified records |
| GET | `/api/attendance` | teacher/admin | Filter by `sessionId`, `classId`, `courseId`, `date`, `status` |
| PUT | `/api/attendance/{id}` | teacher/admin | Requires `{"status":"Present","confirmed":true}` |
| GET | `/api/dashboard/stats` | teacher/admin | Finalized decisions only; draft Unverified count separate |
| GET | `/api/reports` | teacher/admin | `from`, `to`, `classId`, `courseId` |
| GET | `/api/reports/export.csv` | teacher/admin | Finalized records, CSV formula-safe |
| GET | `/api/reports/export.xlsx` | teacher/admin | Finalized records, no formulas/macros |
| POST | `/api/students/{id}/consent` | admin | `{"consented":false}` revokes registration |
| POST | `/api/students/{id}/face-registration` | admin | Explicit consent, 1–10 base64 JPEG images, encrypted template |
| POST | `/api/students/{id}/face-registration/import-legacy` | admin | Explicit consent to encrypt a matching legacy NPZ entry |
| DELETE | `/api/students/{id}/face-registration` | admin | Remove encrypted template |
| GET, POST | `/api/biometrics/status`, `/api/biometrics/purge-expired` | admin | Operational status and expiry cleanup |

Example student creation:

```json
{"id":"STU-1021","firstName":"Ada","lastName":"Lovelace","email":"ada@example.edu","classId":null}
```

The earlier `{"id":"STU-1021","name":"Ada Lovelace"}` format still works. A new session creates `Unverified` attendance records for enrolled students. A WebRTC camera assigned to a draft session marks a student `Present` after three consecutive `Candidate Match` results, sampled at most once per second. The backend rechecks camera assignment, session state, class membership, active consent and template expiry before writing; only `Unverified` records change. Uncertain matches and the separate recognition WebSocket do not change attendance. Operators can correct decisions before finalization. Finalization still requires `confirmed: true` and refuses unresolved records. `Excused` is excluded from the attendance-rate denominator.

## Live recognition WebSocket

Connect to `ws://127.0.0.1:8000/ws/recognition` from an allowed Vite origin after logging in. The browser uses the HttpOnly WebSocket cookie; native clients may send a Bearer header. The socket responds with a `ready` event and accepts JSON text messages:

```json
{"type":"frame","sessionId":"<draft-session-uuid>","sequence":1,"image":"data:image/jpeg;base64,<JPEG bytes>"}
```

It returns `{"type":"recognition","sessionId":"...","sequence":1,"results":[...]}`. Each result has `box: [x1,y1,x2,y2]`, `confidence`, `candidateStudentId`, `candidateStudentName`, `similarityScore`, `status` (`Candidate Match`, `Needs Verification`, or `Unknown`), and `attendanceStatus: "Unverified"`. Matching uses consented, active templates for students currently enrolled in that session's class. Raw embeddings never leave the backend. The worker processes at most eight faces per frame, 1.5 MB per JPEG, two frames per second, 500 frames per connection, and four concurrent connections; idle connections close after 60 seconds. Send frames only for an accessible draft session.

## Biometric data and existing assets

The OPENCV worker reads `yolov8n-face.pt`, InsightFace `buffalo_l`, and the existing `database/embeddings.npz` without changing them. New registrations require explicit consent and keep only a mean 512-dimensional embedding encrypted with Fernet in SQLite; uploaded images are not saved. Active templates expire after the configured retention period and are filtered immediately from matching; expired rows are purged at startup or via the admin endpoint. Declined students can always be marked manually in attendance.

**Legacy asset limitation:** the original `database/embeddings.npz` and student photos remain where they were, as requested. The backend does not automatically match against that plaintext file. An admin may import an entry for a matching student ID only after recording consent, creating an encrypted copy; the original file still needs appropriate file-system protection and a separate retention decision by the project owner.

## Tests

```powershell
python -m unittest discover -s tests -v
```

The automated tests use temporary SQLite files and a local Uvicorn process. They cover migration preservation and backup, authentication, CRUD, teacher scoping, automatic and manual attendance, finalized-only reporting, encrypted template retention, export files, and WebSocket authentication/validation. No test writes the existing project database or CV assets.
