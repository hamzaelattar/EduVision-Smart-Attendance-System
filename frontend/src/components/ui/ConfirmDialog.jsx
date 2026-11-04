import { AlertTriangle } from "lucide-react";
import Modal from "./Modal";
export default function ConfirmDialog({
  title,
  message,
  confirmText = "Confirm",
  danger = false,
  onConfirm,
  onClose,
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </button>
        </>
      }
    >
      <div className="flex gap-3 items-start">
        <div
          className={`stat-icon ${danger ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}
        >
          <AlertTriangle size={21} />
        </div>
        <p className="text-sm text-slate-600 leading-6 pt-1">{message}</p>
      </div>
    </Modal>
  );
}
