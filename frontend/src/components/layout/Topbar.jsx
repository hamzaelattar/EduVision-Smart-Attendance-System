import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  ChevronDown,
  Menu,
  Search,
  Settings,
  UserRound,
  CircleHelp,
} from "lucide-react";
const titles = {
  "/": "Dashboard",
  "/students": "Students",
  "/classes": "Classes & Courses",
  "/camera": "Live Camera",
  "/attendance": "Attendance",
  "/reports": "Reports & Analytics",
  "/settings": "Settings",
};
export default function Topbar({ onMenu }) {
  const { pathname } = useLocation(),
    navigate = useNavigate(),
    [menu, setMenu] = useState(false),
    [notice, setNotice] = useState(false),
    [search, setSearch] = useState("");
  const title = pathname.startsWith("/classes/")
    ? "Class details"
    : titles[pathname] || "EduVision";
  return (
    <header className="topbar">
      <div className="flex items-center gap-3">
        <button
          className="mobile-only icon-button"
          aria-label="Open menu"
          onClick={onMenu}
        >
          <Menu size={19} />
        </button>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[.15em] text-slate-400">
            Pages / {title}
          </div>
          <h1 className="text-[16px] font-extrabold text-[#172c4e] mt-0.5">
            {title}
          </h1>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <form
          className="desktop-search search-wrap w-[220px]"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(`/students?q=${encodeURIComponent(search)}`);
          }}
        >
          <Search size={15} />
          <input
            className="input !bg-slate-50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students..."
            aria-label="Search students"
          />
        </form>
        <div className="relative">
          <button
            className="icon-button relative"
            aria-label="Notifications"
            onClick={() => {
              setNotice(!notice);
              setMenu(false);
            }}
          >
            <Bell size={17} />
            <span className="absolute right-1.5 top-1.5 bg-blue-500 w-1.5 h-1.5 rounded-full" />
          </button>
          {notice && (
            <div className="absolute right-0 top-11 card p-4 w-64 shadow-xl z-30">
              <div className="text-xs font-bold">Notifications</div>
              <p className="text-[11px] leading-5 text-slate-500 mt-2">
                This is a demo workspace. Live notifications will arrive after
                backend integration.
              </p>
            </div>
          )}
        </div>
        <div className="w-px h-7 bg-slate-200 mx-1 hidden sm:block" />
        <div className="relative">
          <button
            className="flex items-center gap-2"
            onClick={() => {
              setMenu(!menu);
              setNotice(false);
            }}
            aria-label="Open user menu"
          >
            <div className="avatar !bg-[#dbeafe]">AD</div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-bold text-slate-700">Admin Demo</div>
              <div className="text-[10px] text-slate-400">Administrator</div>
            </div>
            <ChevronDown size={14} className="text-slate-400" />
          </button>
          {menu && (
            <div className="absolute right-0 top-12 card p-2 w-48 shadow-xl z-30">
              <button
                className="w-full flex items-center gap-2 p-2 text-xs text-slate-600 hover:bg-slate-50 rounded"
                onClick={() => {
                  navigate("/settings");
                  setMenu(false);
                }}
              >
                <Settings size={15} /> Settings
              </button>
              <button
                className="w-full flex items-center gap-2 p-2 text-xs text-slate-600 hover:bg-slate-50 rounded"
                onClick={() => {
                  navigate("/settings");
                  setMenu(false);
                }}
              >
                <CircleHelp size={15} /> Demo information
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
