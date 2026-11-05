# EduVision frontend

A React interface for smart student attendance. The historical pages use local sample data. `/iot` connects to FastAPI for live cameras, enrollment, sessions, automatic presence after repeated strong face matches, manual corrections, and reports; `/iot-camera` publishes a phone or PC webcam. See the root `README.md` for setup and security requirements.

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

## Historical demo pages

The older pages still use local state in `src/context/AppContext.jsx`. The live `/iot` page uses the FastAPI routes through `src/services/liveApi.js` and polls attendance so automatic decisions appear without refreshing. The separate recognition WebSocket in `src/services/recognitionApi.js` emits candidates only; Demo Mode does not open it.

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
