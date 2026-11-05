import { Link } from "react-router-dom";
import {
  Users,
  UserCheck,
  UserX,
  TrendingUp,
  ArrowRight,
  Video,
  UserPlus,
  ClipboardCheck,
  CalendarDays,
  Clock3,
  Activity,
  CircleCheck,
  Sparkles,
} from "lucide-react";
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useApp } from "../context/AppContext";
import { today } from "../data/mockData";
import StatCard from "../components/ui/StatCard";
import StatusBadge from "../components/ui/StatusBadge";
import LoadingCards from "../components/ui/LoadingCards";
import useDemoLoading from "../hooks/useDemoLoading";
import LiveOverview from "../components/camera/LiveOverview";
const weekly = [
  { day: "Mon", rate: 86 },
  { day: "Tue", rate: 91 },
  { day: "Wed", rate: 88 },
  { day: "Thu", rate: 94 },
  { day: "Fri", rate: 92 },
  { day: "Sat", rate: 89 },
  { day: "Sun", rate: 95 },
];
const chartColors = ["#16a34a", "#dc2626", "#f59e0b", "#94a3b8"];
export default function Dashboard() {
  const { students, classes, courses, sessions, attendance } = useApp(),
    loading = useDemoLoading();
  const todaySessions = sessions.filter((s) => s.date === today()),
    todayIds = new Set(todaySessions.map((s) => s.id));
  const todayRows = attendance.filter((a) => todayIds.has(a.sessionId)),
    present = todayRows.filter(
      (a) => a.status === "Present" || a.status === "Late",
    ).length,
    absent = todayRows.filter((a) => a.status === "Absent").length,
    unverified = todayRows.filter((a) => a.status === "Unverified").length;
  const rate =
    present + absent ? Math.round((present / (present + absent)) * 100) : 0;
  const distribution = [
    {
      name: "Present",
      value: todayRows.filter((a) => a.status === "Present").length,
    },
    { name: "Absent", value: absent },
    {
      name: "Late",
      value: todayRows.filter((a) => a.status === "Late").length,
    },
    { name: "Unverified", value: unverified },
  ];
  const className = (id) =>
      classes.find((c) => c.id === id)?.name || "Unassigned",
    courseName = (id) => courses.find((c) => c.id === id)?.name || "Course";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 justify-between items-start">
        <div>
          <div className="eyebrow mb-2">
            Overview ·{" "}
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </div>
          <h1 className="page-title">
            {greeting}, Admin <span className="text-blue-500">✦</span>
          </h1>
          <p className="page-subtitle">
            Here is what is happening across your classes today.
          </p>
        </div>
        <span className="demo-pill mt-2">Demo Mode · Sample data</span>
      </div>
      {loading ? (
        <LoadingCards />
      ) : (
        <div className="grid-auto">
          <StatCard
            icon={Users}
            label="Total Students"
            value={students.length}
            note="Across all classes"
            color="blue"
          />
          <StatCard
            icon={UserCheck}
            label="Present Today"
            value={present}
            note="Including late arrivals"
            color="green"
          />
          <StatCard
            icon={UserX}
            label="Absent Today"
            value={absent}
            note="Only finalized decisions"
            color="red"
          />
          <StatCard
            icon={TrendingUp}
            label="Attendance Rate"
            value={`${rate}%`}
            note={`${unverified} still unverified`}
            color="orange"
          />
        </div>
      )}
      <div className="chart-grid">
        <section className="card card-pad">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="section-title">Weekly attendance</h2>
              <p className="section-subtitle">
                Illustrative demo trend for this week
              </p>
            </div>
            <span className="text-[11px] font-bold text-slate-400">
              Last 7 days
            </span>
          </div>
          <div className="chart-container mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={weekly}
                margin={{ top: 8, right: 8, left: -22, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="#edf2f7"
                  strokeDasharray="4 5"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                />
                <YAxis
                  domain={[0, 100]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(v) => `${v}%`}
                  contentStyle={{
                    border: "1px solid #e5eaf1",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="#2563eb"
                  strokeWidth={3}
                  fill="url(#areaGrad)"
                  dot={{
                    fill: "#fff",
                    stroke: "#2563eb",
                    strokeWidth: 2,
                    r: 4,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card card-pad">
          <h2 className="section-title">Attendance distribution</h2>
          <p className="section-subtitle">Today’s demo session records</p>
          <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-3 mt-3">
            <div className="w-[190px] h-[190px] relative shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distribution}
                    dataKey="value"
                    innerRadius={63}
                    outerRadius={82}
                    paddingAngle={4}
                    stroke="none"
                  >
                    {distribution.map((d, i) => (
                      <Cell key={d.name} fill={chartColors[i]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <strong className="text-2xl text-[#172c4e]">
                  {todayRows.length}
                </strong>
                <span className="text-[10px] text-slate-400">Records</span>
              </div>
            </div>
            <div className="grid gap-3 w-full">
              {distribution.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: chartColors[i] }}
                  />
                  <span className="text-slate-500 flex-1">{d.name}</span>
                  <strong className="text-slate-700">{d.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
      <div className="detail-grid">
        <section className="card">
          <div className="card-pad flex items-center justify-between">
            <div>
              <h2 className="section-title">Recent attendance sessions</h2>
              <p className="section-subtitle">
                Track the latest classroom activity
              </p>
            </div>
            <Link
              className="text-blue-600 text-xs font-bold flex items-center gap-1"
              to="/attendance"
            >
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Class & course</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Students</th>
                </tr>
              </thead>
              <tbody>
                {sessions.slice(0, 4).map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="font-bold text-slate-700">
                        {className(s.classId)}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {courseName(s.courseId)}
                      </div>
                    </td>
                    <td>{s.date}</td>
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
                    <td>
                      {attendance.filter((a) => a.sessionId === s.id).length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card card-pad">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="section-title">Today's classes</h2>
              <p className="section-subtitle">Scheduled demo sessions</p>
            </div>
            <CalendarDays size={18} className="text-blue-500" />
          </div>
          <div className="mt-4 space-y-3">
            {todaySessions.map((s, i) => (
              <div
                key={s.id}
                className="flex gap-3 items-center p-3 border border-slate-100 rounded-xl"
              >
                <div className={`avatar ${i % 2 ? "purple" : ""}`}>
                  <Clock3 size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-slate-700 truncate">
                    {className(s.classId)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 truncate">
                    {courseName(s.courseId)}
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-500">
                  {s.startTime}
                </span>
              </div>
            ))}
          </div>
          <div className="divider my-5" />
          <h3 className="section-title text-sm">Quick actions</h3>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <Link to="/camera" className="btn btn-soft justify-start">
              <Video size={15} /> Live camera
            </Link>
            <Link to="/students" className="btn btn-soft justify-start">
              <UserPlus size={15} /> Students
            </Link>
            <Link to="/attendance" className="btn btn-outline justify-start">
              <ClipboardCheck size={15} /> Attendance
            </Link>
            <Link to="/reports" className="btn btn-outline justify-start">
              <TrendingUp size={15} /> Reports
            </Link>
          </div>
        </section>
      </div>
      <section className="card card-pad">
        <div className="flex items-center gap-2">
          <Activity size={17} className="text-blue-600" />
          <h2 className="section-title">Recent activity</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4 mt-5">
          {[
            [
              "New demo session",
              `${todaySessions.length} sessions scheduled today`,
              Video,
            ],
            [
              "Student directory",
              `${students.length} students in your workspace`,
              Users,
            ],
            [
              "Attendance review",
              `${unverified} entries await teacher verification`,
              CircleCheck,
            ],
          ].map(([title, note, Icon]) => (
            <div key={title} className="flex items-start gap-3">
              <div className="stat-icon bg-slate-100 text-slate-500 !w-9 !h-9">
                <Icon size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-700">{title}</div>
                <div className="text-[11px] text-slate-400 mt-1">{note}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
      <LiveOverview />
    </div>
  );
}
