import { useState } from "react";
import {
  BarChart3,
  Printer,
  TrendingUp,
  CalendarDays,
  FileSpreadsheet,
  FileText,
  Users,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useApp } from "../context/AppContext";
import { daysAgo, today } from "../data/mockData";
import EmptyState from "../components/ui/EmptyState";
const colors = ["#16a34a", "#dc2626", "#f59e0b", "#7c3aed", "#94a3b8"];
const monthLabel = (d) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short" });
function csvCell(v) {
  const value = String(v ?? "");
  const safe = /^[=+@-]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
export default function Reports() {
  const { classes, courses, students, sessions, attendance, toast } = useApp(),
    [classId, setClassId] = useState("all"),
    [courseId, setCourseId] = useState("all"),
    [from, setFrom] = useState(daysAgo(210)),
    [to, setTo] = useState(today());
  const filteredSessions = sessions.filter(
    (s) =>
      (classId === "all" || s.classId === classId) &&
      (courseId === "all" || s.courseId === courseId) &&
      s.date >= from &&
      s.date <= to,
  );
  const selectedIds = new Set(filteredSessions.map((s) => s.id)),
    rows = attendance
      .filter((a) => selectedIds.has(a.sessionId))
      .map((a) => {
        const s = sessions.find((x) => x.id === a.sessionId),
          student = students.find((x) => x.id === a.studentId);
        return student && s
          ? {
              Date: s.date,
              Class: classes.find((c) => c.id === s.classId)?.name || "Unknown",
              Course:
                courses.find((c) => c.id === s.courseId)?.name || "Unknown",
              "Student ID": student.id,
              Student: `${student.firstName} ${student.lastName}`,
              Status: a.status,
              Session: s.id,
            }
          : null;
      })
      .filter(Boolean);
  const decided = rows.filter((r) => r.Status !== "Unverified"),
    present = decided.filter(
      (r) => r.Status === "Present" || r.Status === "Late",
    ).length,
    rate = decided.length ? Math.round((present / decided.length) * 100) : 0;
  const trend = Object.entries(
    rows.reduce((acc, r) => {
      const k = r.Date;
      if (!acc[k]) acc[k] = { date: k, total: 0, present: 0 };
      if (r.Status !== "Unverified") {
        acc[k].total++;
        if (r.Status === "Present" || r.Status === "Late") acc[k].present++;
      }
      return acc;
    }, {}),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({
      date: v.date.slice(5),
      rate: v.total ? Math.round((v.present / v.total) * 100) : 0,
    }));
  const byClass = classes
    .filter((c) => classId === "all" || c.id === classId)
    .map((c) => {
      const list = decided.filter((r) => r.Class === c.name);
      return {
        name: c.code,
        rate: list.length
          ? Math.round(
              (list.filter((r) => r.Status === "Present" || r.Status === "Late")
                .length /
                list.length) *
                100,
            )
          : 0,
      };
    });
  const monthKeys = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(15);
    d.setMonth(d.getMonth() - (6 - i));
    return d.toLocaleDateString("en-CA").slice(0, 7);
  });
  const monthly = monthKeys.map((key) => {
    const list = rows.filter((r) => r.Date.startsWith(key));
    return {
      month: monthLabel(`${key}-15`),
      present: list.filter((r) => r.Status === "Present" || r.Status === "Late")
        .length,
      absent: list.filter((r) => r.Status === "Absent").length,
    };
  });
  const dist = ["Present", "Absent", "Late", "Excused", "Unverified"].map(
    (name) => ({ name, value: rows.filter((r) => r.Status === name).length }),
  );
  const history = students
    .filter((s) => classId === "all" || s.classId === classId)
    .map((s) => {
      const list = rows.filter((r) => r["Student ID"] === s.id);
      const decidedList = list.filter((r) => r.Status !== "Unverified");
      return {
        id: s.id,
        name: `${s.firstName} ${s.lastName}`,
        sessions: list.length,
        present: list.filter(
          (r) => r.Status === "Present" || r.Status === "Late",
        ).length,
        rate: decidedList.length
          ? Math.round(
              (list.filter((r) => r.Status === "Present" || r.Status === "Late")
                .length /
                decidedList.length) *
                100,
            )
          : 0,
      };
    })
    .filter((x) => x.sessions > 0);
  const download = (blob, name) => {
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const exportCsv = () => {
    if (!rows.length) {
      toast("No report rows for these filters", "error");
      return;
    }
    const keys = Object.keys(rows[0]),
      data = [
        keys.map(csvCell).join(","),
        ...rows.map((r) => keys.map((k) => csvCell(r[k])).join(",")),
      ].join("\r\n");
    download(
      new Blob(["\ufeff", data], { type: "text/csv;charset=utf-8" }),
      `eduvision-attendance-${today()}.csv`,
    );
    toast("CSV report downloaded");
  };
  const exportExcel = async () => {
    if (!rows.length) {
      toast("No report rows for these filters", "error");
      return;
    }
    try {
      const { default: writeExcelFile } =
        await import("write-excel-file/browser");
      const keys = Object.keys(rows[0]);
      const data = [keys, ...rows.map((row) => keys.map((key) => row[key]))];
      const blob = await writeExcelFile(data).toBlob();
      download(blob, `eduvision-attendance-${today()}.xlsx`);
      toast("Excel report downloaded");
    } catch {
      toast("Could not create Excel report", "error");
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-start justify-between">
        <div>
          <div className="eyebrow mb-2">Insights / Reporting</div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">
            Explore attendance patterns from local demo records.
          </p>
        </div>
        <span className="demo-pill">Demo data</span>
      </div>
      <section className="card card-pad">
        <div className="flex flex-wrap gap-3 justify-between items-center mb-4">
          <div>
            <h2 className="section-title">Report filters</h2>
            <p className="section-subtitle">
              Filter before viewing or exporting
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button className="btn btn-outline" onClick={exportCsv}>
              <FileText size={14} /> Export CSV
            </button>
            <button className="btn btn-outline" onClick={exportExcel}>
              <FileSpreadsheet size={14} /> Export Excel
            </button>
            <button className="btn btn-primary" onClick={() => window.print()}>
              <Printer size={14} /> Print report
            </button>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="field">
            <label className="label" htmlFor="report-class">
              Class
            </label>
            <select
              id="report-class"
              className="select"
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setCourseId("all");
              }}
            >
              <option value="all">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="report-course">
              Course
            </label>
            <select
              id="report-course"
              className="select"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              <option value="all">All courses</option>
              {courses
                .filter((c) => classId === "all" || c.classId === classId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="report-from">
              From date
            </label>
            <input
              id="report-from"
              className="input"
              type="date"
              max={to}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="report-to">
              To date
            </label>
            <input
              id="report-to"
              className="input"
              type="date"
              min={from}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
      </section>
      <div className="grid-auto">
        <div className="card card-pad">
          <div className="stat-icon bg-blue-50 text-blue-600">
            <CalendarDays size={19} />
          </div>
          <div className="metric-number mt-4">{filteredSessions.length}</div>
          <div className="text-xs text-slate-500 mt-1">Sessions</div>
        </div>
        <div className="card card-pad">
          <div className="stat-icon bg-green-50 text-green-600">
            <TrendingUp size={19} />
          </div>
          <div className="metric-number mt-4">{rate}%</div>
          <div className="text-xs text-slate-500 mt-1">Attendance rate</div>
        </div>
        <div className="card card-pad">
          <div className="stat-icon bg-amber-50 text-amber-600">
            <Users size={19} />
          </div>
          <div className="metric-number mt-4">
            {new Set(rows.map((r) => r["Student ID"])).size}
          </div>
          <div className="text-xs text-slate-500 mt-1">Students recorded</div>
        </div>
        <div className="card card-pad">
          <div className="stat-icon bg-purple-50 text-purple-600">
            <BarChart3 size={19} />
          </div>
          <div className="metric-number mt-4">{rows.length}</div>
          <div className="text-xs text-slate-500 mt-1">Attendance entries</div>
        </div>
      </div>
      {rows.length ? (
        <>
          <div className="chart-grid">
            <section className="card card-pad">
              <h2 className="section-title">Attendance trends</h2>
              <p className="section-subtitle">
                Rate across selected session dates
              </p>
              <div className="chart-container mt-5">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={trend}
                    margin={{ top: 5, right: 5, bottom: 0, left: -20 }}
                  >
                    <defs>
                      <linearGradient
                        id="reportGrad"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#2563eb"
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="100%"
                          stopColor="#2563eb"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="#edf2f7"
                      strokeDasharray="4 5"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      formatter={(v) => `${v}%`}
                      contentStyle={{ borderRadius: 10, fontSize: 12 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="rate"
                      stroke="#2563eb"
                      strokeWidth={3}
                      fill="url(#reportGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="card card-pad">
              <h2 className="section-title">Present vs absent</h2>
              <p className="section-subtitle">All statuses in selection</p>
              <div className="h-[185px] mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dist}
                      dataKey="value"
                      innerRadius={52}
                      outerRadius={76}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {dist.map((x, i) => (
                        <Cell key={x.name} fill={colors[i]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: 10, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {dist.map((x, i) => (
                  <div key={x.name} className="flex gap-2 items-center">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: colors[i] }}
                    />
                    {x.name}: <strong>{x.value}</strong>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <div className="chart-grid">
            <section className="card card-pad">
              <h2 className="section-title">Monthly attendance</h2>
              <p className="section-subtitle">
                Present and absent decisions in the selected range
              </p>
              <div className="chart-container mt-5">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthly}
                    margin={{ top: 5, right: 5, bottom: 0, left: -22 }}
                  >
                    <CartesianGrid
                      stroke="#edf2f7"
                      strokeDasharray="4 5"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 10, fontSize: 12 }}
                    />
                    <Bar
                      dataKey="present"
                      fill="#2563eb"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="absent"
                      fill="#f59e0b"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-4 text-[11px] text-slate-500 justify-center">
                <span>
                  • <span className="text-blue-600">Present</span>
                </span>
                <span>
                  • <span className="text-amber-500">Absent</span>
                </span>
              </div>
            </section>
            <section className="card card-pad">
              <h2 className="section-title">Rate by class</h2>
              <p className="section-subtitle">Only teacher-decided records</p>
              <div className="space-y-5 mt-8">
                {byClass.map((c) => (
                  <div key={c.name}>
                    <div className="flex justify-between text-xs mb-2">
                      <span className="font-semibold text-slate-600">
                        {c.name}
                      </span>
                      <strong className="text-slate-800">{c.rate}%</strong>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{ width: `${c.rate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <section className="card">
            <div className="card-pad">
              <h2 className="section-title">Student attendance history</h2>
              <p className="section-subtitle">
                Summary of filtered demo records
              </p>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Student ID</th>
                    <th>Sessions</th>
                    <th>Present / late</th>
                    <th>Attendance rate</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((s) => (
                    <tr key={s.id}>
                      <td className="font-bold text-slate-700">{s.name}</td>
                      <td>{s.id}</td>
                      <td>{s.sessions}</td>
                      <td>{s.present}</td>
                      <td>
                        <span
                          className={`font-bold ${s.rate >= 80 ? "text-green-600" : "text-amber-600"}`}
                        >
                          {s.rate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <div className="card">
          <EmptyState
            icon={BarChart3}
            title="No report data"
            description="Try a wider date range or another class and course."
          />
        </div>
      )}
    </div>
  );
}
