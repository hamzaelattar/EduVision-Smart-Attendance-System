import { Inbox } from "lucide-react";
export default function EmptyState({
  icon: Icon = Inbox,
  title = "Nothing to show",
  description,
  action,
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={22} />
      </div>
      <div className="font-bold text-slate-700 text-sm">{title}</div>
      {description && (
        <p className="text-xs mt-1 max-w-sm mx-auto">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
