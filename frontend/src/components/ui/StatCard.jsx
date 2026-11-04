import { ArrowUpRight } from "lucide-react";
export default function StatCard({
  icon: Icon,
  label,
  value,
  note,
  color = "blue",
  trend,
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
    orange: "bg-amber-50 text-amber-600",
  };
  return (
    <div className="card card-pad">
      <div className="flex justify-between items-start">
        <div className={`stat-icon ${tones[color]}`}>
          <Icon size={20} />
        </div>
        {trend && (
          <span className="text-[10px] font-bold text-green-600 bg-green-50 rounded-full px-2 py-1 flex items-center gap-0.5">
            <ArrowUpRight size={11} />
            {trend}
          </span>
        )}
      </div>
      <div className="mt-5 metric-number">{value}</div>
      <div className="mt-2 text-xs font-semibold text-slate-600">{label}</div>
      <div className="mt-1 text-[11px] text-slate-400">{note}</div>
    </div>
  );
}
