import { useEffect, useState } from "react";
import { liveRequest, liveToken } from "../../services/liveApi";

export default function RealReports({ refreshKey }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const query = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString();

  useEffect(() => {
    let active = true;
    liveRequest(`/reports${query ? `?${query}` : ""}`)
      .then((value) => { if (active) { setReport(value); setError(""); } })
      .catch((reason) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [query, refreshKey]);

  async function download(extension) {
    setError("");
    try {
      const response = await fetch(`/api/reports/export.${extension}${query ? `?${query}` : ""}`, {
        headers: { Authorization: `Bearer ${liveToken()}` },
      });
      if (!response.ok) throw new Error(`Export impossible (${response.status})`);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = `eduvision-attendance.${extension}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) { setError(reason.message); }
  }

  return <section className="card card-pad space-y-4">
    <h2 className="section-title">Rapports des présences validées</h2>
    <div className="flex flex-wrap items-end gap-3">
      <label className="field"><span className="label">Du</span><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
      <label className="field"><span className="label">Au</span><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      <button className="btn btn-outline" onClick={() => download("csv")}>Exporter CSV</button>
      <button className="btn btn-outline" onClick={() => download("xlsx")}>Exporter XLSX</button>
    </div>
    {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    {report && <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {[["Séances", report.finalizedSessions], ["Présents", report.present], ["Retards", report.late],
        ["Absents", report.absent], ["À vérifier", report.unverifiedDraftRecords], ["Taux", `${report.attendanceRate}%`]]
        .map(([label, value]) => <div key={label} className="bg-slate-50 p-3 rounded-lg">
          <div className="text-xl font-bold">{value}</div><div className="text-xs text-slate-500">{label}</div>
        </div>)}
    </div>}
  </section>;
}
