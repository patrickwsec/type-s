import React from "react";
import { Bug, AlertTriangle, Info, ShieldCheck, Clock, CheckCircle, XCircle, Eye } from "lucide-react";

const severityConfig = {
  critical: { icon: Bug, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", dot: "bg-red-500" },
  high: { icon: AlertTriangle, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", dot: "bg-orange-500" },
  medium: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", dot: "bg-amber-500" },
  low: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", dot: "bg-blue-500" },
  info: { icon: Info, color: "text-gray-400", bg: "bg-gray-500/10", border: "border-gray-500/20", dot: "bg-gray-500" },
};

const triageConfig = {
  new: { label: "New", color: "text-gray-400", bg: "bg-gray-500/10" },
  acknowledged: { label: "Ack'd", color: "text-blue-400", bg: "bg-blue-500/10" },
  in_progress: { label: "In Progress", color: "text-amber-400", bg: "bg-amber-500/10" },
  resolved: { label: "Resolved", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  false_positive: { label: "False +", color: "text-red-400", bg: "bg-red-500/10" },
};

export default function VulnStatsStrip({ stats, filters, onToggleSeverity, onToggleTriage }) {
  if (!stats) return null;

  const { severity_counts = {}, triage_counts = {}, total = 0 } = stats;
  const severities = ["critical", "high", "medium", "low", "info"];
  const triages = ["new", "acknowledged", "in_progress", "resolved", "false_positive"];
  const activeSeverities = filters.severities || [];
  const activeTriages = filters.triage_statuses || [];

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 px-6 py-3.5 border-b border-gray-200 dark:border-white/[0.06] bg-white dark:bg-gray-900/60">
      {/* Severity pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mr-1 uppercase tracking-wider">Severity</span>
        {severities.map((sev) => {
          const count = severity_counts[sev] || 0;
          const cfg = severityConfig[sev];
          const active = activeSeverities.includes(sev);
          return (
            <button
              key={sev}
              onClick={() => onToggleSeverity(sev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                active
                  ? `${cfg.bg} ${cfg.color} ${cfg.border} ring-1 ring-current/20`
                  : "bg-transparent border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.04]"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              <span className="capitalize">{sev}</span>
              <span className={`tabular-nums ${active ? "" : "text-gray-400 dark:text-gray-500"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="hidden sm:block w-px h-6 bg-gray-200 dark:bg-white/[0.08]" />

      {/* Triage pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mr-1 uppercase tracking-wider">Triage</span>
        {triages.map((t) => {
          const count = triage_counts[t] || 0;
          const cfg = triageConfig[t];
          const active = activeTriages.includes(t);
          return (
            <button
              key={t}
              onClick={() => onToggleTriage(t)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                active
                  ? `${cfg.bg} ${cfg.color} border-current/20 ring-1 ring-current/20`
                  : "bg-transparent border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.04]"
              }`}
            >
              <span>{cfg.label}</span>
              <span className={`tabular-nums ${active ? "" : "text-gray-400 dark:text-gray-500"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="hidden sm:block ml-auto text-xs text-gray-400 dark:text-gray-500 tabular-nums">
        {total.toLocaleString()} total
      </div>
    </div>
  );
}
