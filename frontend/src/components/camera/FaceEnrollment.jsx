import { useEffect, useRef, useState } from "react";
import { liveRequest } from "../../services/liveApi";

export default function FaceEnrollment({ students, onUpdated }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [studentId, setStudentId] = useState("");
  const [consent, setConsent] = useState(false);
  const [retentionDays, setRetentionDays] = useState(30);
  const [images, setImages] = useState([]);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function stop() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setActive(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  }
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function start() {
    setMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      streamRef.current = stream;
      setActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (error) { setMessage(error.message || "Caméra indisponible"); }
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !streamRef.current || images.length >= 5) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    setImages((current) => [...current, canvas.toDataURL("image/jpeg", 0.75)]);
  }

  async function enroll() {
    if (!studentId || !consent || !images.length) return;
    setBusy(true); setMessage("");
    try {
      await liveRequest(`/students/${encodeURIComponent(studentId)}/face-registration`, {
        method: "POST", body: { consent: true, images, retentionDays: Number(retentionDays) },
      });
      setImages([]); setConsent(false); stop();
      setMessage("Empreinte chiffrée enregistrée. Les photos temporaires ont été effacées.");
      onUpdated();
    } catch (error) { setMessage(error.message || "Enregistrement impossible"); }
    finally { setBusy(false); }
  }

  async function revoke() {
    if (!studentId || !window.confirm("Retirer le consentement et supprimer l'empreinte ?")) return;
    setBusy(true); setMessage("");
    try {
      await liveRequest(`/students/${encodeURIComponent(studentId)}/consent`, {
        method: "POST", body: { consented: false },
      });
      setImages([]); setConsent(false);
      setMessage("Consentement retiré et empreinte supprimée.");
      onUpdated();
    } catch (error) { setMessage(error.message || "Opération impossible"); }
    finally { setBusy(false); }
  }

  return <section className="card card-pad space-y-4">
    <div><h2 className="section-title">Inscription biométrique</h2>
      <p className="section-subtitle">Administrateur uniquement · consentement explicite · images temporaires en mémoire.</p></div>
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="space-y-3">
        <label className="field"><span className="label">Étudiant</span>
          <select className="select" value={studentId} onChange={(e) => { setStudentId(e.target.value); setImages([]); setConsent(false); }}>
            <option value="">Sélectionner</option>
            {students.map((student) => <option key={student.id} value={student.id}>{student.name} ({student.id}) · {student.faceRegistered ? "inscrit" : "non inscrit"}</option>)}
          </select></label>
        <label className="field"><span className="label">Conservation (jours)</span>
          <input className="input" type="number" min="1" max="365" value={retentionDays} onChange={(e) => setRetentionDays(e.target.value)} /></label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          J'ai recueilli le consentement explicite de cet étudiant pour l'inscription faciale.</label>
        <p className="text-xs text-slate-500">Capturez 1 à 5 vues nettes du même visage. Aucun cliché n'est conservé après l'envoi.</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-outline" onClick={start} disabled={busy || active}>Activer la caméra</button>
          <button className="btn btn-outline" onClick={capture} disabled={busy || !active || images.length >= 5}>Capturer ({images.length})</button>
          <button className="btn btn-primary" onClick={enroll} disabled={busy || !studentId || !consent || !images.length}>Inscrire</button>
          <button className="btn btn-outline" onClick={revoke} disabled={busy || !studentId}>Retirer le consentement</button>
        </div>
        {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
      </div>
      <video ref={videoRef} muted autoPlay playsInline className="w-full max-h-72 bg-slate-950 rounded-xl object-contain" />
    </div>
  </section>;
}
