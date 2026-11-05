import { useEffect, useRef, useState } from "react";
import { liveRequest, waitForIce } from "../../services/liveApi";

export default function LiveVideo({ cameraId, sessionId, online, token }) {
  const videoRef = useRef(null);
  const [state, setState] = useState("Connexion…");

  useEffect(() => {
    if (!online || !token) return undefined;
    let active = true;
    let viewerId = null;
    const pc = new RTCPeerConnection();
    pc.addTransceiver("video", { direction: "recvonly" });
    pc.ontrack = (event) => {
      if (videoRef.current) videoRef.current.srcObject = new MediaStream([event.track]);
    };
    pc.onconnectionstatechange = () => {
      if (active && pc.connectionState === "connected") setState("En direct");
      if (active && ["failed", "disconnected"].includes(pc.connectionState)) {
        setState("Connexion perdue");
      }
    };
    (async () => {
      try {
        await pc.setLocalDescription(await pc.createOffer());
        await waitForIce(pc);
        const answer = await liveRequest(`/webrtc/cameras/${encodeURIComponent(cameraId)}/view`, {
          method: "POST", token,
          body: { sdp: pc.localDescription.sdp, type: pc.localDescription.type },
        });
        viewerId = answer.viewerId;
        if (active) await pc.setRemoteDescription(answer);
      } catch (error) {
        if (active) setState(error.message || "Flux indisponible");
      }
    })();
    return () => {
      active = false;
      pc.close();
      if (videoRef.current) videoRef.current.srcObject = null;
      if (viewerId) {
        liveRequest(`/webrtc/cameras/${encodeURIComponent(cameraId)}/view/${encodeURIComponent(viewerId)}`, {
          method: "DELETE", token,
        }).catch(() => {});
      }
    };
  }, [cameraId, sessionId, online, token]);

  if (!online) return <div className="aspect-video bg-slate-900 rounded-lg grid place-items-center text-slate-300 text-sm">Hors ligne</div>;
  return <div className="relative">
    <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-video bg-black rounded-lg object-contain" />
    <span className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">{state}</span>
  </div>;
}
