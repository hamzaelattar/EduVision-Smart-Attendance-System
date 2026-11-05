import { NavLink } from "react-router-dom";
import { GraduationCap, LayoutDashboard, Radio, Sparkles, X } from "lucide-react";

const links = [
  ["/", "Dashboard", LayoutDashboard],
  ["/iot", "Caméras et présences", Radio],
  ["/demo", "Démonstration", Sparkles],
];

export default function Sidebar({ open, onClose }) {
  return <>
    <div className={`mobile-scrim ${open ? "open" : ""}`} onClick={onClose} />
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="flex items-center justify-between px-6 pt-7 pb-8">
        <NavLink to="/" onClick={onClose} className="flex items-center gap-3 text-white">
          <div className="logo-mark"><GraduationCap size={23} /></div>
          <div><div className="text-lg font-extrabold tracking-tight leading-5">EduVision</div>
            <div className="text-[10px] tracking-[.15em] text-blue-200 mt-1 uppercase font-bold">Smart attendance</div></div>
        </NavLink>
        <button onClick={onClose} className="mobile-only text-blue-100" aria-label="Fermer le menu"><X size={20} /></button>
      </div>
      <div className="px-4">
        <div className="text-[10px] uppercase tracking-[.14em] font-bold text-blue-200/50 px-3 mb-3">Espace</div>
        <nav className="grid gap-1" aria-label="Navigation principale">
          {links.map(([path, label, Icon]) => <NavLink key={path} to={path} end={path === "/"} onClick={onClose}
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
            <Icon size={18} strokeWidth={1.8} />{label}</NavLink>)}
        </nav>
      </div>
      <div className="sidebar-footer">
        <div className="rounded-xl bg-white/7 border border-white/10 p-4">
          <div className="flex items-center gap-2 text-white text-xs font-bold"><Radio size={16} className="text-blue-300" /> Flux réels</div>
          <p className="text-[11px] text-blue-100/65 leading-5 mt-2">Le Dashboard et la console IoT utilisent FastAPI. La démonstration conserve ses données locales séparées.</p>
        </div>
        <div className="text-[10px] text-blue-200/40 mt-5 px-1">© {new Date().getFullYear()} EduVision</div>
      </div>
    </aside>
  </>;
}
