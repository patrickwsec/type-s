import React from "react";
import { X, CheckSquare } from "lucide-react";
import { Button, Select } from "../ui";

const triageOptions = [
  { value: "new", label: "New" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "false_positive", label: "False Positive" },
];

export default function VulnBulkBar({
  selectedCount,
  onSelectAllPage,
  onClearSelection,
  onBulkTriage,
  isUpdating,
  triageValue,
  onTriageValueChange,
}) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900 dark:bg-gray-800 border border-white/[0.1] rounded-xl shadow-2xl shadow-black/30 px-5 py-3 flex items-center gap-4 animate-slide-up">
      <div className="flex items-center gap-2">
        <CheckSquare className="h-4 w-4 text-primary-400" />
        <span className="text-sm font-medium text-white tabular-nums">{selectedCount} selected</span>
      </div>
      <div className="w-px h-6 bg-white/[0.1]" />
      <div className="flex items-center gap-2">
        <div className="w-40">
          <Select
            value={triageValue}
            onChange={(e) => onTriageValueChange(e.target.value)}
            options={triageOptions}
            placeholder="Set triage..."
          />
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={onBulkTriage}
          disabled={!triageValue || isUpdating}
        >
          {isUpdating ? "Updating..." : "Apply"}
        </Button>
      </div>
      <div className="w-px h-6 bg-white/[0.1]" />
      <button
        onClick={onSelectAllPage}
        className="text-xs text-gray-400 hover:text-white transition-colors"
      >
        Select all page
      </button>
      <button
        onClick={onClearSelection}
        className="p-1 text-gray-400 hover:text-white transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
