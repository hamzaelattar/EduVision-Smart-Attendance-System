import LiveVideo from "./LiveVideo";

export default function CameraGrid({ cameras, token, children }) {
  return <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
    {cameras.map((camera) => <section key={camera.id} className="card card-pad space-y-3">
      <div className="flex justify-between gap-3 items-start">
        <div>
          <h3 className="font-bold text-slate-800">{camera.name}</h3>
          <p className="text-xs text-slate-500">{camera.id} · {camera.room || "Salle non définie"}</p>
        </div>
        <span className={`status ${camera.online ? "status-present" : "status-unverified"}`}>
          {camera.online ? "En direct" : "Hors ligne"}
        </span>
      </div>
      <LiveVideo cameraId={camera.id} sessionId={camera.sessionId} online={camera.online} token={token} />
      {camera.online && camera.sessionId && !camera.candidates?.length && <p className="text-sm text-slate-600">Présentez un visage devant la caméra pour obtenir une proposition.</p>}
      {camera.analysisError && <p className="text-xs text-amber-700" role="alert">{camera.analysisError}</p>}
      {camera.candidates?.length > 0 && <div className="space-y-2" aria-live="polite">
        <h4 className="text-sm font-semibold">Visages proposés</h4>
        {camera.candidates.map((item, index) => <div key={index} className={`rounded-lg border p-3 ${item.attendanceStatus === "Present" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
          <p className="font-semibold text-slate-800">{item.candidateStudentName || "Visage inconnu"}</p>
          <p className="text-xs text-slate-600">{item.attendanceStatus === "Present"
            ? item.attendanceSource === "automatic" ? "Présence enregistrée automatiquement." : "Présence enregistrée."
            : ["Absent", "Late", "Excused"].includes(item.attendanceStatus)
              ? "Décision déjà enregistrée pour cet étudiant."
            : item.status === "Candidate Match"
              ? "Correspondance forte : confirmation automatique en cours."
              : item.candidateStudentName
                ? "Correspondance incertaine : améliorez le cadrage et la lumière."
                : "Vérifiez le cadrage et la lumière."}</p>
        </div>)}
      </div>}
      <details className="text-xs text-slate-600"><summary className="cursor-pointer">Détails techniques</summary>
        <div className="grid grid-cols-3 gap-2 mt-2">
          <span>FPS : {camera.fps}</span>
          <span>RTT : {camera.rttMs ?? "—"} ms</span>
          <span>Analyse : {camera.analysisMs ?? "—"} ms</span>
        </div>
        <p className="mt-1">Frames : {camera.framesReceived} · Échantillons ignorés : {camera.framesSkipped} · Perte RTP : {camera.packetLossPercent ?? "—"}% · Spectateurs : {camera.viewers}</p>
      </details>
      {children?.(camera)}
    </section>)}
  </div>;
}
