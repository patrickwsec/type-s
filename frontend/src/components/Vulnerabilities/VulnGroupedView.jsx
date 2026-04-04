import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, Server, Bug, AlertTriangle, Info } from "lucide-react";
import { Badge } from "../ui";
import VulnTable from "./VulnTable";

const severityDot = { critical: "bg-red-500", high: "bg-orange-500", medium: "bg-amber-500", low: "bg-blue-500", info: "bg-gray-500" };
const triageVariant = { new: "default", acknowledged: "info", in_progress: "warning", resolved: "success", false_positive: "danger" };

const severityOrder = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

function groupFindings(findings, groupBy) {
  const groups = {};
  for (const f of findings) {
    let key;
    switch (groupBy) {
      case "hostname":
        key = f.asset_hostname || "Unknown Host";
        break;
      case "template_id":
        key = f.template_id || "Unknown Template";
        break;
      case "severity":
        key = f.severity || "info";
        break;
      case "triage_status":
        key = f.triage_status || "new";
        break;
      default:
        key = "All";
    }
    (groups[key] ||= []).push(f);
  }
  return groups;
}

function sortGroupKeys(groups, groupBy) {
  const keys = Object.keys(groups);
  if (groupBy === "severity") {
    return keys.sort((a, b) => (severityOrder[b] || 0) - (severityOrder[a] || 0));
  }
  return keys.sort((a, b) => {
    const countDiff = groups[b].length - groups[a].length;
    if (countDiff !== 0) return countDiff;
    return a.localeCompare(b);
  });
}

function GroupStats({ findings }) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  findings.forEach((f) => { counts[f.severity || "info"]++; });
  return (
    <div className="flex items-center gap-2">
      {["critical", "high", "medium", "low"].map((s) =>
        counts[s] > 0 ? (
          <span key={s} className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <span className={`w-1.5 h-1.5 rounded-full ${severityDot[s]}`} />
            {counts[s]}
          </span>
        ) : null
      )}
    </div>
  );
}

function groupLabel(groupBy, key) {
  if (groupBy === "severity") return key.charAt(0).toUpperCase() + key.slice(1);
  if (groupBy === "triage_status") return key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  return key;
}

export default function VulnGroupedView({
  findings,
  groupBy,
  selectedId,
  onSelect,
  bulkMode,
  selectedIds,
  onToggleSelect,
  sortBy,
  sortOrder,
  onSort,
}) {
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  const groups = useMemo(() => groupFindings(findings, groupBy), [findings, groupBy]);
  const sortedKeys = useMemo(() => sortGroupKeys(groups, groupBy), [groups, groupBy]);

  // Auto-expand first few groups on mount
  useMemo(() => {
    if (expandedGroups.size === 0 && sortedKeys.length > 0) {
      setExpandedGroups(new Set(sortedKeys.slice(0, 3)));
    }
  }, [sortedKeys]);

  const toggle = (key) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {sortedKeys.map((key) => {
        const items = groups[key];
        const isExpanded = expandedGroups.has(key);

        return (
          <div key={key} className="rounded-xl border border-gray-200 dark:border-white/[0.06] overflow-hidden bg-white dark:bg-white/[0.02]">
            <button
              onClick={() => toggle(key)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                {groupBy === "hostname" && <Server className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                {groupBy === "severity" && <span className={`w-3 h-3 rounded-full ${severityDot[key]}`} />}
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                  {groupLabel(groupBy, key)}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                  {items.length} {items.length === 1 ? "finding" : "findings"}
                </span>
                {groupBy !== "severity" && <GroupStats findings={items} />}
              </div>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
              )}
            </button>
            {isExpanded && (
              <div className="border-t border-gray-200 dark:border-white/[0.06]">
                <VulnTable
                  findings={items}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  bulkMode={bulkMode}
                  selectedIds={selectedIds}
                  onToggleSelect={onToggleSelect}
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={onSort}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
