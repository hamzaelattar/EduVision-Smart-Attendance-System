import { useEffect, useMemo, useState } from "react";
import {
  ClipboardCheck,
  CalendarDays,
  Save,
  LockKeyhole,
  Users,
  UserCheck,
  UserX,
  Clock3,
  Plus,
  Info,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { today } from "../data/mockData";
import SearchBar from "../components/ui/SearchBar";
import StatusBadge from "../components/ui/StatusBadge";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import EmptyState from "../components/ui/EmptyState";
const statuses = ["Present", "Absent", "Late", "Excused", "Unverified"];
export default function Attendance() {
  const {
    classes,
    courses,
    students,
    sessions,
    attendance,
    saveAttendance,
    finalizeSession,
    addSession,
    toast,
  } = useApp();
  const draft = sessions.find((s) => s.status === "Draft"),
    [classId, setClassId] = useState(draft?.classId || classes[0]?.id || ""),
    [courseId, setCourseId] = useState(draft?.courseId || ""),
    [date, setDate] = useState(today()),
    [sessionId, setSessionId] = useState(draft?.id || ""),
    [search, setSearch] = useState(""),
    [edits, setEdits] = useState({}),
    [confirm, setConfirm] = useState(false);
  const availableCourses = courses.filter((c) => c.classId === classId),
    availableSessions = sessions.filter(
      (s) =>
        s.classId === classId && s.courseId === courseId && s.date === date,
    );
  useEffect(() => {
    if (!availableCourses.some((c) => c.id === courseId))
      setCourseId(availableCourses[0]?.id || "");
  }, [classId, courses]);
  useEffect(() => {
    if (!availableSessions.some((s) => s.id === sessionId))
      setSessionId(availableSessions[0]?.id || "");
  }, [classId, courseId, date, sessions]);
  const session = sessions.find((s) => s.id === sessionId),
    members = students.filter((s) => s.classId === classId),
    records = attendance.filter((a) => a.sessionId === sessionId);
  useEffect(() => {
    setEdits(Object.fromEntries(records.map((a) => [a.studentId, a.status])));
  }, [sessionId, attendance]);
  const shown = members.filter((s) =>
    `${s.firstName} ${s.lastName} ${s.id}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const counts = Object.fromEntries(
      statuses.map((status) => [
        status,
        members.filter((s) => (edits[s.id] || "Unverified") === status).length,
      ]),
    ),
    unresolved = counts.Unverified;
  const create = () => {
    if (!classId || !courseId) {
      toast("Choose a class and course first", "error");
      return;
    }
    const id = addSession({
      classId,
      courseId,
      date,
      startTime: new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
    setSessionId(id);
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 justify-between items-start">
        <div>
          <div className="eyebrow mb-2">Records / Attendance</div>
          <h1 className="page-title">Attendance management</h1>
          <p className="page-subtitle">
            Review every student and make final decisions manually.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={create}
          disabled={!classId || !courseId}
        >
          <Plus size={15} /> New demo session
        </button>
      </div>
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800 flex gap-2 leading-5">
        <Info size={17} /> Students begin as Unverified in new sessions. Camera
        candidates never automatically become Present or Absent.
      </div>
      <section className="card card-pad">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays size={17} className="text-blue-600" />
          <h2 className="section-title">Select session</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="field">
            <label className="label" htmlFor="att-class">
              Class
            </label>
            <select
              id="att-class"
              className="select"
              value={classId}
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
            <label className="label" htmlFor="att-course">
              Course
            </label>
            <select
              id="att-course"
              className="select"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              {availableCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="att-date">
              Date
            </label>
            <input
              id="att-date"
              className="input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="att-session">
              Attendance session
            </label>
            <select
              id="att-session"
              className="select"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
            >
              <option value="">
                {availableSessions.length
                  ? "Select session"
                  : "No session for date"}
              </option>
              {availableSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.startTime} · {s.status}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>
      {session ? (
        <>
          <div className="grid-auto">
            <div className="card card-pad">
              <div className="stat-icon bg-blue-50 text-blue-600">
                <Users size={19} />
              </div>
              <div className="metric-number mt-4">{members.length}</div>
              <div className="text-xs font-semibold text-slate-500 mt-1">
                Total students
              </div>
            </div>
            <div className="card card-pad">
              <div className="stat-icon bg-green-50 text-green-600">
                <UserCheck size={19} />
              </div>
              <div className="metric-number mt-4">{counts.Present}</div>
              <div className="text-xs font-semibold text-slate-500 mt-1">
                Present
              </div>
            </div>
            <div className="card card-pad">
              <div className="stat-icon bg-red-50 text-red-600">
                <UserX size={19} />
              </div>
              <div className="metric-number mt-4">{counts.Absent}</div>
              <div className="text-xs font-semibold text-slate-500 mt-1">
                Absent
              </div>
            </div>
            <div className="card card-pad">
              <div className="stat-icon bg-amber-50 text-amber-600">
                <Clock3 size={19} />
              </div>
              <div className="metric-number mt-4">{unresolved}</div>
              <div className="text-xs font-semibold text-slate-500 mt-1">
                Unverified
              </div>
            </div>
          </div>
          <section className="card">
            <div className="card-pad flex flex-wrap gap-3 justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="section-title">Student attendance</h2>
                  <StatusBadge status={session.status} />
                </div>
                <p className="section-subtitle">
                  {session.status === "Finalized"
                    ? "Finalized session is read only."
                    : "Select each status, then save a draft or finalize."}
                </p>
              </div>
              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Search students"
                className="w-[220px]"
              />
            </div>
            {shown.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Student ID</th>
                      <th>Current status</th>
                      <th>Manual decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="avatar">
                              {s.firstName[0]}
                              {s.lastName[0]}
                            </span>
                            <strong className="text-slate-700">
                              {s.firstName} {s.lastName}
                            </strong>
                          </div>
                        </td>
                        <td>{s.id}</td>
                        <td>
                          <StatusBadge status={edits[s.id] || "Unverified"} />
                        </td>
                        <td>
                          <select
                            className="select !w-36"
                            aria-label={`Attendance status for ${s.firstName} ${s.lastName}`}
                            disabled={session.status === "Finalized"}
                            value={edits[s.id] || "Unverified"}
                            onChange={(e) =>
                              setEdits((a) => ({
                                ...a,
                                [s.id]: e.target.value,
                              }))
                            }
                          >
                            {statuses.map((status) => (
                              <option key={status}>{status}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={Users}
                title="No students found"
                description="Try a different search or add students to this class."
              />
            )}
            <div className="border-t border-slate-100 card-pad flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                <strong className="text-slate-700">Session summary:</strong>{" "}
                {counts.Present} present · {counts.Absent} absent ·{" "}
                {counts.Late} late · {counts.Excused} excused · {unresolved}{" "}
                unverified
              </div>
              <div className="flex gap-2">
                <button
                  className="btn btn-outline"
                  disabled={session.status === "Finalized"}
                  onClick={() => saveAttendance(sessionId, edits)}
                >
                  <Save size={15} /> Save draft
                </button>
                <button
                  className="btn btn-primary"
                  disabled={
                    session.status === "Finalized" ||
                    unresolved > 0 ||
                    members.length === 0
                  }
                  title={
                    unresolved > 0
                      ? "Decide every unverified student first"
                      : undefined
                  }
                  onClick={() => setConfirm(true)}
                >
                  <LockKeyhole size={15} /> Finalize attendance
                </button>
              </div>
            </div>
            {unresolved > 0 && session.status !== "Finalized" && (
              <div className="px-5 pb-4 text-[11px] text-amber-600">
                Resolve all {unresolved} unverified students before finalizing.
                You may save a draft at any time.
              </div>
            )}
          </section>
        </>
      ) : (
        <div className="card">
          <EmptyState
            icon={ClipboardCheck}
            title="No attendance session selected"
            description="Choose another date or create a demo session for this class and course."
            action={
              <button className="btn btn-primary" onClick={create}>
                <Plus size={14} /> New demo session
              </button>
            }
          />
        </div>
      )}
      {confirm && (
        <ConfirmDialog
          title="Finalize attendance?"
          message="This locks the selected demo session. Review all manual decisions before continuing."
          confirmText="Finalize session"
          onClose={() => setConfirm(false)}
          onConfirm={() => finalizeSession(sessionId, edits)}
        />
      )}
    </div>
  );
}
