import { useEffect, useRef, useState } from "react";

async function waitForIce(pc) {
  if (pc.iceGatheringState === "complete") return;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pc.removeEventListener("icegatheringstatechange", check);
      reject(new Error("ICE gathering timed out"));
    }, 15000);
    function check() {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(timer);
        pc.removeEventListener("icegatheringstatechange", check);
        resolve();
      }
    }
    pc.addEventListener("icegatheringstatechange", check);
    check();
  });
}

export default function WebRTCCamera() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const peerRef = useRef(null);
  const publishedRef = useRef(false);
  const [cameraId, setCameraId] = useState("");
  const [secret, setSecret] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [devices, setDevices] = useState([]);
  const [status, setStatus] = useState("Déconnectée");
  const [error, setError] = useState("");

  function stop() {
    peerRef.current?.close();
    peerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (publishedRef.current && cameraId && secret) {
      fetch(`/api/webrtc/cameras/${encodeURIComponent(cameraId)}/publish`, {
        method: "DELETE",
        headers: { "X-Camera-Secret": secret },
      }).catch(() => {});
    }
    publishedRef.current = false;
    setStatus("Déconnectée");
  }

  async function start() {
    setError("");
    if (!cameraId || !secret) {
      setError("Saisissez l'identifiant et le secret fournis par l'administrateur.");
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("La caméra exige une page HTTPS avec un certificat approuvé.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : {
          facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const found = await navigator.mediaDevices.enumerateDevices();
      setDevices(found.filter((item) => item.kind === "videoinput"));
      const pc = new RTCPeerConnection();
      peerRef.current = pc;
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") setStatus("En direct");
        if (["disconnected", "failed"].includes(pc.connectionState)) {
          setStatus("Connexion perdue");
        }
      };
      stream.getVideoTracks().forEach((track) => pc.addTrack(track, stream));
      setStatus("Connexion en cours…");
      await pc.setLocalDescription(await pc.createOffer());
      await waitForIce(pc);
      const response = await fetch("/api/webrtc/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Camera-Secret": secret },
        body: JSON.stringify({
          cameraId, sdp: pc.localDescription.sdp, type: pc.localDescription.type,
        }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.detail || `Connexion refusée (${response.status})`);
      }
      await pc.setRemoteDescription(await response.json());
      publishedRef.current = true;
    } catch (reason) {
      setError(reason.message || "Connexion impossible");
      stop();
    }
  }

  useEffect(() => () => {
    peerRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white p-5">
      <div className="max-w-xl mx-auto space-y-5">
        <header>
          <h1 className="text-2xl font-bold">EduVision · Caméra IoT</h1>
          <p className="text-slate-300 text-sm mt-2">Diffusion vidéo chiffrée vers le serveur. Aucun enregistrement local.</p>
        </header>
        <div className="grid gap-3">
          <label className="text-sm">Identifiant de caméra
            <input className="input mt-1 text-slate-900" value={cameraId} onChange={(event) => setCameraId(event.target.value.trim())} placeholder="CAM-001" disabled={!!peerRef.current} />
          </label>
          <label className="text-sm">Secret de l'appareil
            <input className="input mt-1 text-slate-900" value={secret} onChange={(event) => setSecret(event.target.value)} type="password" autoComplete="off" disabled={!!peerRef.current} />
          </label>
          {devices.length > 1 && <label className="text-sm">Caméra physique
            <select className="select mt-1 text-slate-900" value={deviceId} onChange={(event) => setDeviceId(event.target.value)} disabled={!!peerRef.current}>
              <option value="">Par défaut</option>
              {devices.map((item) => <option key={item.deviceId} value={item.deviceId}>{item.label || item.deviceId}</option>)}
            </select>
          </label>}
        </div>
        <video ref={videoRef} autoPlay muted playsInline className="w-full aspect-video bg-black rounded-xl object-contain" />
        <p role="status" className="text-sm">État : {status}</p>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <div className="flex gap-3">
          <button className="btn btn-primary" onClick={start} disabled={!!peerRef.current}>Démarrer</button>
          <button className="btn btn-outline text-white" onClick={stop}>Arrêter</button>
        </div>
      </div>
    </main>
  );
}
