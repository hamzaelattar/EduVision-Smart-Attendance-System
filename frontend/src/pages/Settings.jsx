import { useEffect, useState } from "react";
import {
  Settings as SettingsIcon,
  Camera,
  BrainCircuit,
  ShieldCheck,
  Save,
  Trash2,
  RefreshCcw,
  Info,
  LockKeyhole,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { initialSettings } from "../data/mockData";
import ConfirmDialog from "../components/ui/ConfirmDialog";
export default function Settings() {
  const { settings, updateSettings, clearRegistrations, resetDemo, students } =
      useApp(),
    [form, setForm] = useState(settings),
    [devices, setDevices] = useState([]),
    [confirm, setConfirm] = useState("");
  useEffect(() => {
    navigator.mediaDevices
      ?.enumerateDevices?.()
      .then((list) => setDevices(list.filter((d) => d.kind === "videoinput")))
      .catch(() => {});
  }, []);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-4 items-start">
        <div>
          <div className="eyebrow mb-2">Workspace / Preferences</div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">
            Configure your local demo experience and review privacy controls.
          </p>
        </div>
        <span className="demo-pill">Frontend preferences only</span>
      </div>
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-2 text-xs text-blue-800 leading-5">
        <Info size={17} /> Settings are saved in this browser. They do not
        change a backend, model, or real camera processing pipeline.
      </div>
      <div className="settings-grid">
        <section className="card card-pad">
          <div className="flex gap-3 items-center">
            <div className="stat-icon bg-blue-50 text-blue-600">
              <SettingsIcon size={19} />
            </div>
            <div>
              <h2 className="section-title">General settings</h2>
              <p className="section-subtitle">
                Workspace appearance and locale preferences
              </p>
            </div>
          </div>
          <div className="space-y-4 mt-6">
            <div className="field">
              <label className="label" htmlFor="set-app">
                Application name
              </label>
              <input
                id="set-app"
                className="input"
                value={form.appName}
                onChange={(e) => set("appName", e.target.value)}
              />
            </div>
            <div className="form-grid">
              <div className="field">
                <label className="label" htmlFor="set-language">
                  Language
                </label>
                <select
                  id="set-language"
                  className="select"
                  value={form.language}
                  onChange={(e) => set("language", e.target.value)}
                >
                  <option>English</option>
                  <option>French</option>
                  <option>Spanish</option>
                </select>
              </div>
              <div className="field">
                <label className="label" htmlFor="set-date">
                  Date format
                </label>
                <select
                  id="set-date"
                  className="select"
                  value={form.dateFormat}
                  onChange={(e) => set("dateFormat", e.target.value)}
                >
                  <option>MMM d, yyyy</option>
                  <option>dd/MM/yyyy</option>
                  <option>yyyy-MM-dd</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label className="label" htmlFor="set-theme">
                Theme preference
              </label>
              <select
                id="set-theme"
                className="select"
                value={form.theme}
                onChange={(e) => set("theme", e.target.value)}
              >
                <option>Light</option>
                <option>System</option>
                <option>Dark</option>
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                The demo preview uses the light dashboard theme.
              </p>
            </div>
          </div>
        </section>
        <section className="card card-pad">
          <div className="flex gap-3 items-center">
            <div className="stat-icon bg-cyan-50 text-cyan-600">
              <Camera size={19} />
            </div>
            <div>
              <h2 className="section-title">Camera settings</h2>
              <p className="section-subtitle">
                Preferences for a future camera integration
              </p>
            </div>
          </div>
          <div className="space-y-4 mt-6">
            <div className="field">
              <label className="label" htmlFor="set-camera">
                Preferred camera
              </label>
              <select
                id="set-camera"
                className="select"
                value={form.cameraId}
                onChange={(e) => set("cameraId", e.target.value)}
              >
                <option value="">System default</option>
                {devices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="set-res">
                Resolution preference
              </label>
              <select
                id="set-res"
                className="select"
                value={form.resolution}
                onChange={(e) => set("resolution", e.target.value)}
              >
                <option>640 × 480</option>
                <option>1280 × 720</option>
                <option>1920 × 1080</option>
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="set-rate">
                Frame processing preference
              </label>
              <select
                id="set-rate"
                className="select"
                value={form.frameRate}
                onChange={(e) => set("frameRate", e.target.value)}
              >
                <option>Efficiency</option>
                <option>Balanced</option>
                <option>Quality</option>
              </select>
            </div>
          </div>
        </section>
        <section className="card card-pad">
          <div className="flex gap-3 items-center">
            <div className="stat-icon bg-purple-50 text-purple-600">
              <BrainCircuit size={19} />
            </div>
            <div>
              <h2 className="section-title">AI settings</h2>
              <p className="section-subtitle">
                Display-only values until backend connection
              </p>
            </div>
          </div>
          <div className="space-y-6 mt-6">
            <div>
              <div className="flex justify-between">
                <label className="label" htmlFor="set-conf">
                  Detection confidence threshold
                </label>
                <span className="text-xs font-bold text-blue-600">
                  {Math.round(form.confidence * 100)}%
                </span>
              </div>
              <input
                id="set-conf"
                type="range"
                min="0.1"
                max="0.95"
                step="0.05"
                value={form.confidence}
                onChange={(e) => set("confidence", Number(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>
            <div>
              <div className="flex justify-between">
                <label className="label" htmlFor="set-sim">
                  Recognition similarity threshold
                </label>
                <span className="text-xs font-bold text-blue-600">
                  {Math.round(form.similarity * 100)}%
                </span>
              </div>
              <input
                id="set-sim"
                type="range"
                min="0.1"
                max="0.95"
                step="0.05"
                value={form.similarity}
                onChange={(e) => set("similarity", Number(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-[11px] text-slate-500 leading-5">
              <strong className="text-slate-700">Planned models:</strong> YOLO
              for detection and ArcFace for recognition. This frontend performs
              no inference and these sliders do not alter model behavior.
            </div>
          </div>
        </section>
        <section className="card card-pad">
          <div className="flex gap-3 items-center">
            <div className="stat-icon bg-green-50 text-green-600">
              <ShieldCheck size={19} />
            </div>
            <div>
              <h2 className="section-title">Privacy & data</h2>
              <p className="section-subtitle">
                Consent, retention, and demo controls
              </p>
            </div>
          </div>
          <div className="space-y-4 mt-6">
            <div className="field">
              <label className="label" htmlFor="set-retention">
                Future data retention preference
              </label>
              <select
                id="set-retention"
                className="select"
                value={form.retention}
                onChange={(e) => set("retention", e.target.value)}
              >
                <option>7 days</option>
                <option>30 days</option>
                <option>90 days</option>
              </select>
            </div>
            <div className="text-[11px] text-slate-500 leading-5 bg-slate-50 rounded-xl p-3 flex gap-2">
              <LockKeyhole size={16} /> Webcam images captured for demo
              registration are discarded when the dialog closes. Only a demo
              registration flag is saved locally. Access control requires your
              future backend.
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="btn btn-outline !text-red-600"
                onClick={() => setConfirm("registrations")}
              >
                <Trash2 size={14} /> Clear registration flags (
                {students.filter((s) => s.faceRegistered).length})
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setConfirm("reset")}
              >
                <RefreshCcw size={14} /> Reset demo data
              </button>
            </div>
          </div>
        </section>
      </div>
      <div className="flex justify-end">
        <button
          className="btn btn-primary"
          onClick={() => updateSettings(form)}
        >
          <Save size={15} /> Save preferences
        </button>
      </div>
      {confirm === "registrations" && (
        <ConfirmDialog
          title="Clear demo registrations?"
          message="All students will be marked as not registered in this browser. No image files are stored by the demo."
          confirmText="Clear flags"
          danger
          onClose={() => setConfirm("")}
          onConfirm={clearRegistrations}
        />
      )}{" "}
      {confirm === "reset" && (
        <ConfirmDialog
          title="Reset all demo data?"
          message="This restores sample students, classes, sessions, attendance, and preferences in this browser."
          confirmText="Reset demo"
          danger
          onClose={() => setConfirm("")}
          onConfirm={() => {
            resetDemo();
            setForm(initialSettings);
          }}
        />
      )}
    </div>
  );
}
