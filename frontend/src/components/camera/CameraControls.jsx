import { Play, Square, CircleDot, CheckCircle2 } from "lucide-react";
export default function CameraControls({
  cameraActive,
  sessionActive,
  onStartCamera,
  onStopCamera,
  onStartSession,
  onEndSession,
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        className="btn btn-primary"
        onClick={onStartCamera}
        disabled={cameraActive}
      >
        <Play size={14} /> Start camera
      </button>
      <button
        className="btn btn-outline"
        onClick={onStopCamera}
        disabled={!cameraActive}
      >
        <Square size={14} /> Stop camera
      </button>
      <div className="hidden sm:block w-px h-9 bg-slate-200 mx-1" />
      <button
        className="btn btn-navy"
        onClick={onStartSession}
        disabled={sessionActive}
      >
        <CircleDot size={15} /> Start attendance session
      </button>
      <button
        className="btn btn-outline"
        onClick={onEndSession}
        disabled={!sessionActive}
      >
        <CheckCircle2 size={15} /> End session
      </button>
    </div>
  );
}
