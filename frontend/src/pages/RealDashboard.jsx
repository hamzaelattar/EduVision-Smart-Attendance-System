import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import LiveOverview from "../components/camera/LiveOverview";
import { liveRequest, liveToken } from "../services/liveApi";

export default function RealDashboard() {
  const [token, setToken] = useState(liveToken);
  const [stats, setStats] = useState(null);
  const [metrics, setMetrics] = useState(null);
  useEffect(() => {
    const sync = () => setToken(liveToken());
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, []);
  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    const poll = () => Promise.all([
      liveRequest("/dashboard/stats", { token }), liveRequest("/webrtc/metrics", { token }),
    ]).then(([data, system]) => { if (active) { setStats(data); setMetrics(system); } })
      .catch(() => { if (active) { setStats(null); setMetrics(null); } });
    poll();
    const timer = setInterval(poll, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [token]);
  return <div className="space-y-6">
    <header className="flex flex-wrap justify-between items-start gap-3">
      <div><div className="eyebrow mb-2">EduVision · Données réelles</div>
        <h1 className="page-title">Dashboard IoT</h1>
        <p className="page-subtitle">Présences validées et caméras autorisées en direct.</p></div>
      <Link className="btn btn-primary" to="/iot">Ouvrir la console</Link>
    </header>
    {!token && <div className="card card-pad text-sm text-slate-600">Connectez-vous dans la console IoT pour afficher les statistiques et les flux réels.</div>}
    {stats && <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {[["Étudiants", stats.totalStudents], ["Présents aujourd'hui", stats.presentToday],
        ["À vérifier", stats.unverifiedToday], ["Taux de présence", `${stats.attendanceRate}%`]]
        .map(([label, value]) => <div key={label} className="card card-pad"><div className="metric-number">{value}</div>
          <div className="text-sm text-slate-500 mt-2">{label}</div></div>)}
    </div>}
    {metrics && <div className="card card-pad text-sm text-slate-600 flex flex-wrap gap-x-6 gap-y-2">
      <span>Caméras actives : <strong>{metrics.activeCameras}</strong></span>
      <span>CPU : <strong>{metrics.cpuPercent}%</strong></span>
      <span>Mémoire : <strong>{metrics.memoryPercent}%</strong></span>
      <span>GPU : <strong>{metrics.gpuPercent == null ? "non disponible" : `${metrics.gpuPercent}%`}</strong></span>
    </div>}
    <LiveOverview />
  </div>;
}
