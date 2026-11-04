# EduVision frontend

A React demo for smart student attendance. It uses **local sample data only** and runs without FastAPI, a webcam, or an AI model. The existing Python project, models, images, database, and Conda environment are untouched.

## Run locally

Requirements: Node.js 20.19+ (or 22.12+) and npm. From this `frontend` folder:

```bash
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://127.0.0.1:5173`). For a production build:

```bash
npm run build
npm run preview
```

On this machine, the default npm cache drive may be full. If installation reports `ENOSPC`, run `npm install --cache .npm-cache` from `frontend` so the cache stays on the project drive.

## What works in Demo Mode

- Seven responsive pages: dashboard, students, classes and courses, live camera, attendance, reports, and settings.
- Student and class CRUD, class details, course creation, student assignment, search, filters, pagination, modals, and toasts.
- Browser camera preview with device selection, permission errors, and stream cleanup. Face registration captures up to ten temporary previews with consent; images are discarded when the dialog closes. Only a demo registration flag is saved.
- Demo attendance sessions. Every student starts **Unverified**. Fixed sample candidate results are shown only on request and never mark attendance. Teachers can change statuses manually, save drafts, and finalize after all entries are decided.
- Charts, date/class/course filters, student history, CSV and XLSX export, and print view.
- Preferences and demo data persist in this browser's `localStorage`. The Settings page can reset demo data.

There is no face detection, recognition, biometric storage, server call, or SQLite connection in Demo Mode. The camera preview stays in the browser. A browser needs `localhost` or HTTPS for webcam access.

## Folder guide

```text
src/
  components/   layout, common UI, and camera components
  context/      local demo state and actions
  data/         sample students, classes, sessions, and candidates
  hooks/        webcam lifecycle and demo loading
  pages/        the seven routes and class detail view
  services/     future Axios and WebSocket integration boundary
  styles/       Tailwind entry and shared design styles
```

## Connecting FastAPI later

Copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL` to the backend origin (default `http://127.0.0.1:8000`). The files in `src/services/` define the future Axios clients. Replace the local state actions in `src/context/AppContext.jsx` with calls through those clients, then map response data into the current UI models. Keep camera candidate events separate from attendance decisions. The future recognition socket URL is derived in `src/services/recognitionApi.js` as `ws://127.0.0.1:8000/ws/recognition` by default. No socket opens in Demo Mode.

Expected routes:

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/dashboard/stats` | Dashboard metrics |
| GET, POST | `/api/students` | List/create students |
| PUT, DELETE | `/api/students/{id}` | Update/remove student |
| GET, POST | `/api/classes` | List/create classes |
| GET, POST | `/api/sessions` | List/create sessions |
| GET | `/api/attendance` | Attendance records |
| PUT | `/api/attendance/{id}` | Update a record |
| POST | `/api/sessions/{id}/finalize` | Finalize session |
| GET | `/api/reports` | Reports |
| WebSocket | `/ws/recognition` | Future candidate events |

These are anticipated contracts, not implemented endpoints. The backend should enforce consent, authentication, retention, and final attendance decisions.
