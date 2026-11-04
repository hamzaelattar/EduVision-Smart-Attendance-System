import { useState } from "react";
import { Camera, RotateCcw, ShieldCheck, ImagePlus } from "lucide-react";
import Modal from "../ui/Modal";
import CameraViewer from "./CameraViewer";
import useCamera from "../../hooks/useCamera";
export default function FaceRegistration({ student, onSave, onClose }) {
  const camera = useCamera(),
    [images, setImages] = useState([]),
    [consent, setConsent] = useState(false);
  const take = () => {
    const image = camera.capture();
    if (image) setImages((a) => (a.length < 10 ? [...a, image] : a));
  };
  return (
    <Modal
      wide
      title={`Face registration · ${student.firstName} ${student.lastName}`}
      description="Demo only · Captures stay in this browser session and are discarded when you close this dialog."
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!consent || images.length === 0}
            onClick={() => {
              onSave();
              camera.stop();
              onClose();
            }}
          >
            Save demo registration
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800 flex gap-2">
          <ShieldCheck size={18} />
          No face detection, recognition, image upload, or biometric storage
          occurs in this frontend demo.
        </div>
        <CameraViewer
          videoRef={camera.videoRef}
          active={camera.active}
          label="Face registration camera preview"
        />
        {camera.error && (
          <div
            className="text-xs text-red-600 bg-red-50 rounded-lg p-3"
            role="alert"
          >
            {camera.error}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-primary"
            onClick={() => camera.start()}
            disabled={camera.active}
          >
            <Camera size={15} /> Start camera
          </button>
          <button
            className="btn btn-outline"
            onClick={camera.stop}
            disabled={!camera.active}
          >
            Stop camera
          </button>
          <button
            className="btn btn-outline"
            onClick={take}
            disabled={!camera.active || images.length >= 10}
          >
            <ImagePlus size={15} /> Capture photo
          </button>
        </div>
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-slate-700">
            Captured previews
          </h3>
          <span className="text-xs font-bold text-blue-600">
            {images.length}/10
          </span>
        </div>
        {images.length ? (
          <div className="grid grid-cols-5 gap-2">
            {images.map((src, i) => (
              <div
                key={i}
                className="relative aspect-square rounded-lg overflow-hidden bg-slate-100"
              >
                <img
                  src={src}
                  alt={`Capture ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  className="absolute right-1 top-1 bg-white/90 rounded p-1 text-red-600"
                  aria-label={`Retake photo ${i + 1}`}
                  onClick={() =>
                    setImages((a) => a.filter((_, idx) => idx !== i))
                  }
                >
                  <RotateCcw size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-slate-400 bg-slate-50 rounded-xl p-5 text-center">
            No photos captured yet.
          </div>
        )}
        <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            I confirm that the student has consented to this demonstration. I
            understand images are not saved or sent to a server.
          </span>
        </label>
      </div>
    </Modal>
  );
}
