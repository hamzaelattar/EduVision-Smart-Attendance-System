import { Suspense, useState } from "react";
import { Outlet } from "react-router-dom";
import { CheckCircle2, X, AlertCircle } from "lucide-react";
import { useApp } from "../../context/AppContext";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import LoadingCards from "../ui/LoadingCards";
export default function MainLayout() {
  const [open, setOpen] = useState(false),
    { toasts, setToasts } = useApp();
  return (
    <div className="app-shell">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="main-wrap">
        <Topbar onMenu={() => setOpen(true)} />
        <main className="page-content">
          <Suspense fallback={<LoadingCards />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast ${t.type === "error" ? "error" : ""}`}
          >
            {t.type === "error" ? (
              <AlertCircle size={17} />
            ) : (
              <CheckCircle2 size={17} />
            )}
            <span className="flex-1">{t.message}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => setToasts((a) => a.filter((x) => x.id !== t.id))}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
