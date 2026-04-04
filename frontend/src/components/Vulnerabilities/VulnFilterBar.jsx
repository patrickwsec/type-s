import React from "react";
import { X } from "lucide-react";

const filterLabels = {
  search: "Search",
  severities: "Severity",
  triage_statuses: "Triage",
  hostname: "Host",
  template_id: "Template",
  tags: "Tags",
};

export default function VulnFilterBar({ filters, clearFilter, clearAll }) {
  const pills = [];

  if (filters.search) {
    pills.push({ key: "search", label: "Search", value: `"${filters.search}"` });
  }
  if (filters.severities?.length) {
    pills.push({ key: "severities", label: "Severity", value: filters.severities.join(", ") });
  }
  if (filters.triage_statuses?.length) {
    pills.push({
      key: "triage_statuses",
      label: "Triage",
      value: filters.triage_statuses.map((s) => s.replace(/_/g, " ")).join(", "),
    });
  }
  if (filters.hostname) {
    pills.push({ key: "hostname", label: "Host", value: filters.hostname });
  }
  if (filters.template_id) {
    pills.push({ key: "template_id", label: "Template", value: filters.template_id });
  }
  if (filters.tags?.length) {
    pills.push({ key: "tags", label: "Tags", value: filters.tags.join(", ") });
  }

  if (pills.length === 0) return null;

  return (
    <div className="px-6 py-2 border-b border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">Filters:</span>
      {pills.map(({ key, label, value }) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-gray-300"
        >
          <span className="font-medium text-gray-500 dark:text-gray-400">{label}:</span>
          <span className="truncate max-w-[150px]">{value}</span>
          <button
            onClick={() => clearFilter(key)}
            className="ml-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button
        onClick={clearAll}
        className="text-xs text-primary-400 hover:text-primary-300 ml-1 font-medium"
      >
        Clear all
      </button>
    </div>
  );
}
