import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CameraGrid from "./CameraGrid";
import { liveRequest, liveToken } from "../../services/liveApi";

export default function LiveOverview() {
  const [token, setToken] = useState(liveToken);
  const [cameras, setCameras] = useState([]);
  useEffect(() => {
    const sync = () => setToken(liveToken());
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, []);
  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    const poll = () => liveRequest("/webrtc/cameras", { token })
      .then((items) => { if (active) setCameras(items); })
      .catch(() => { if (active) setCameras([]); });
    poll();
    const timer = setInterval(poll, 3000);
    return () => { active = false; clearInterval(timer); };
  }, [token]);
  return <section className="space-y-4">
    <div className="flex justify-between items-center gap-3">
      <div>
        <h2 className="section-title">Caméras en direct</h2>
        <p className="section-subtitle">Flux WebRTC provenant des appareils autorisés</p>
      </div>
      <Link className="btn btn-outline" to="/iot">Gérer les caméras</Link>
    </div>
    {!token ? <p className="text-sm text-slate-500">Connectez-vous dans la console IoT pour voir les flux.</p>
      : cameras.length ? <CameraGrid cameras={cameras} token={token} />
        : <p className="text-sm text-slate-500">Aucune caméra accessible.</p>}
  </section>;
}
