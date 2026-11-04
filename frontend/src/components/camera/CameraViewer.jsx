import { Camera, ScanFace } from "lucide-react";
export default function CameraViewer({
  videoRef,
  active,
  label = "Camera preview",
}) {
  return (
    <div className="camera-stage">
      <video ref={videoRef} autoPlay muted playsInline aria-label={label} />
      {!active && (
        <div className="camera-center relative z-10">
          <div className="w-16 h-16 rounded-2xl border border-white/20 bg-white/10 grid place-items-center mx-auto mb-3">
            <Camera size={27} className="text-blue-200" />
          </div>
          <div className="text-sm font-bold text-white">Camera is off</div>
          <div className="text-[11px] text-slate-400 mt-1">
            Start your camera to see the live preview
          </div>
        </div>
      )}
      <div className="camera-overlay">
        <span className="camera-corner tl" />
        <span className="camera-corner tr" />
        <span className="camera-corner bl" />
        <span className="camera-corner br" />
      </div>
      {active && (
        <div className="absolute top-4 left-4 bg-red-500/90 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-md flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />{" "}
          LIVE PREVIEW
        </div>
      )}
      <div className="absolute bottom-4 right-4 bg-slate-900/70 text-white/75 text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1">
        <ScanFace size={12} /> No AI inference
      </div>
    </div>
  );
}
