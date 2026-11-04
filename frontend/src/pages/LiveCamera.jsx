import { useEffect, useState } from "react";
import {
  Camera,
  ScanFace,
  CircleHelp,
  ShieldCheck,
  Wifi,
  BookOpen,
  CalendarDays,
  AlertCircle,
  PlayCircle,
  VideoOff,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { today, demoCandidates } from "../data/mockData";
import CameraViewer from "../components/camera/CameraViewer";
import CameraControls from "../components/camera/CameraControls";
import StatusBadge from "../components/ui/StatusBadge";
import EmptyState from "../components/ui/EmptyState";
import useCamera from "../hooks/useCamera";
export default function LiveCamera() {
  const { classes, courses, addSession, endSession, toast } = useApp(),
    camera = useCamera();
  const [classId, setClassId] = useState(classes[0]?.id || ""),
    [courseId, setCourseId] = useState(""),
    [sessionId, setSessionId] = useState(""),
    [candidates, setCandidates] = useState([]),
    [deviceId, setDeviceId] = useState("");
  const available = courses.filter((c) => c.classId === classId);
  useEffect(() => {
    if (!available.some((c) => c.id === courseId))
      setCourseId(available[0]?.id || "");
  }, [classId, courses]);
  const startSession = () => {
    if (!classId || !courseId) {
      toast("Select a class and course first", "error");
      return;
    }
    const id = addSession({
      classId,
      courseId,
      date: today(),
      startTime: new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
    setSessionId(id);
    setCandidates([]);
  };
  const finish = () => {
    endSession(sessionId);
    setSessionId("");
    toast("Review unverified attendance on the Attendance page");
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-4 items-start">
        <div>
          <div className="eyebrow mb-2">AI workspace / Monitoring</div>
          <h1 className="page-title">Live Camera</h1>
          <p className="page-subtitle">
            Preview a camera and explore the attendance workflow.
          </p>
        </div>
        <span className="demo-pill">Demo Mode · No AI inference</span>
      </div>
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex gap-3 text-xs text-blue-800 leading-5">
        <ShieldCheck size={18} className="mt-0.5" />
        <div>
          <strong>Camera preview only.</strong> This frontend does not analyze
          video or identify students. Demo candidate results appear only when
          you click “Show sample results”; they never mark attendance
          automatically.
        </div>
      </div>
      <div className="grid xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)] gap-5">
        <section className="card card-pad">
          <div className="flex justify-between items-start gap-3 mb-4">
            <div>
              <h2 className="section-title">Camera feed</h2>
              <p className="section-subtitle">
                Browser webcam preview · local to this device
              </p>
            </div>
            <span
              className={`status ${camera.active ? "status-present" : "status-unverified"}`}
            >
              {camera.active ? "Camera active" : "Camera offline"}
            </span>
          </div>
          <CameraViewer videoRef={camera.videoRef} active={camera.active} />
          {camera.error && (
            <div
              className="mt-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-3 flex gap-2"
              role="alert"
            >
              <AlertCircle size={15} />
              {camera.error}
            </div>
          )}
          <div className="flex flex-wrap items-end justify-between gap-3 mt-4">
            <div className="field w-[220px]">
              <label className="label" htmlFor="camera-select">
                Camera device
              </label>
              <select
                id="camera-select"
                className="select"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
              >
                <option value="">Default camera</option>
                {camera.devices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-[10px] text-slate-400 pb-2">
              Camera access requires localhost or HTTPS
            </span>
          </div>
          <div className="divider my-4" />
          <CameraControls
            cameraActive={camera.active}
            sessionActive={!!sessionId}
            onStartCamera={() => camera.start(deviceId)}
            onStopCamera={camera.stop}
            onStartSession={startSession}
            onEndSession={finish}
          />
        </section>
        <aside className="space-y-4">
          <div className="card card-pad">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="section-title">Session setup</h2>
                <p className="section-subtitle">
                  Choose where attendance belongs
                </p>
              </div>
              <CalendarDays size={19} className="text-blue-500" />
            </div>
            <div className="space-y-3 mt-5">
              <div className="field">
                <label className="label" htmlFor="session-class">
                  Class
                </label>
                <select
                  id="session-class"
                  className="select"
                  value={classId}
                  disabled={!!sessionId}
                  onChange={(e) => setClassId(e.target.value)}
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="label" htmlFor="session-course">
                  Course
                </label>
                <select
                  id="session-course"
                  className="select"
                  value={courseId}
                  disabled={!!sessionId}
                  onChange={(e) => setCourseId(e.target.value)}
                >
                  {available.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-between text-xs py-2">
                <span className="text-slate-500">Session date</span>
                <strong className="text-slate-700">{today()}</strong>
              </div>
              <div className="flex justify-between text-xs py-2">
                <span className="text-slate-500">Session status</span>
                <StatusBadge status={sessionId ? "Draft" : "Unverified"} />
              </div>
            </div>
          </div>
          <div className="card card-pad">
            <h2 className="section-title">Demo detection summary</h2>
            <p className="section-subtitle">
              Sample values, never real recognition
            </p>
            <div className="grid grid-cols-3 gap-2 mt-5 text-center">
              {[
                ["Detected faces", candidates.length, "text-blue-600"],
                [
                  "Candidates",
                  candidates.filter((x) => x.status !== "Unknown").length,
                  "text-green-600",
                ],
                [
                  "Unknown",
                  candidates.filter((x) => x.status === "Unknown").length,
                  "text-amber-600",
                ],
              ].map(([label, value, color]) => (
                <div key={label} className="bg-slate-50 rounded-xl p-3">
                  <div className={`text-2xl font-extrabold ${color}`}>
                    {value}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">{label}</div>
                </div>
              ))}
            </div>
            <button
              className="btn btn-outline w-full mt-4"
              onClick={() => {
                setCandidates(demoCandidates);
                toast("Fixed sample results loaded");
              }}
            >
              <PlayCircle size={15} /> Show sample results
            </button>
          </div>
          <div className="card card-pad flex gap-3">
            <CircleHelp size={18} className="text-blue-500" />
            <p className="text-[11px] leading-5 text-slate-500">
              Future FastAPI recognition events can replace this sample feed
              through the isolated API service and WebSocket URL.
            </p>
          </div>
        </aside>
      </div>
      <section className="card">
        <div className="card-pad">
          <h2 className="section-title">Candidate recognition results</h2>
          <p className="section-subtitle">
            Explicitly loaded sample results · no attendance decisions
          </p>
        </div>
        {candidates.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Student name</th>
                  <th>Similarity score</th>
                  <th>Status</th>
                  <th>Sample timestamp</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((r, i) => (
                  <tr key={i}>
                    <td className="font-bold text-slate-700">{r.studentId}</td>
                    <td>{r.name}</td>
                    <td>
                      {r.similarity
                        ? `${Math.round(r.similarity * 100)}%`
                        : "—"}
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td>{r.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={ScanFace}
            title="No demo results loaded"
            description="Click “Show sample results” to view fixed examples. The camera feed is never analyzed."
          />
        )}
      </section>
    </div>
  );
}
