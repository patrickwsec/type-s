import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Search,
  Download,
  CheckSquare,
  ChevronDown,
  X,
  SlidersHorizontal,
  ArrowUpDown,
  Layers,
} from "lucide-react";
import { Button } from "../ui";

const sortOptions = [
  { value: "severity", label: "Severity" },
  { value: "last_seen_at", label: "Last Seen" },
  { value: "first_seen_at", label: "First Seen" },
  { value: "title", label: "Title" },
  { value: "hostname", label: "Hostname" },
];

const groupOptions = [
  { value: "none", label: "No Grouping" },
  { value: "hostname", label: "Hostname" },
  { value: "template_id", label: "Template" },
  { value: "severity", label: "Severity" },
  { value: "triage_status", label: "Triage Status" },
];

function Dropdown({ label, icon: Icon, children, className = "" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-colors"
      >
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 min-w-[200px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/[0.08] rounded-lg shadow-lg py-1 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}

function CheckboxItem({ checked, label, count, onChange }) {
  return (
    <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-white/[0.04] cursor-pointer text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="rounded border-gray-300 dark:border-white/[0.15] text-primary-500 focus:ring-primary-500/30 bg-transparent"
      />
      <span className="flex-1 text-gray-700 dark:text-gray-300 truncate">{label}</span>
      {count != null && <span className="text-xs text-gray-400 tabular-nums">{count}</span>}
    </label>
  );
}

export default function VulnToolbar({
  filters,
  setFilter,
  toggleArrayFilter,
  clearAll,
  hostnames = [],
  templateIds = [],
  tagsList = [],
  onExport,
  bulkMode,
  onToggleBulkMode,
}) {
  const [searchValue, setSearchValue] = useState(filters.search || "");
  const debounceRef = useRef(null);

  const handleSearchChange = useCallback(
    (e) => {
      const val = e.target.value;
      setSearchValue(val);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setFilter("search", val);
      }, 300);
    },
    [setFilter]
  );

  // Sync external changes
  useEffect(() => {
    setSearchValue(filters.search || "");
  }, [filters.search]);

  return (
    <div className="px-6 py-3 border-b border-gray-200 dark:border-white/[0.06] bg-white dark:bg-gray-900/60">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search findings..."
            value={searchValue}
            onChange={handleSearchChange}
            className="w-full pl-9 pr-8 py-2 text-sm bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/50 transition-all"
          />
          {searchValue && (
            <button
              onClick={() => { setSearchValue(""); setFilter("search", ""); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Hostname filter */}
        {hostnames.length > 0 && (
          <Dropdown label="Host" icon={SlidersHorizontal}>
            <div className="max-h-64 overflow-y-auto">
              {hostnames.map((h) => (
                <CheckboxItem
                  key={h}
                  label={h}
                  checked={filters.hostname === h}
                  onChange={() => setFilter("hostname", filters.hostname === h ? "" : h)}
                />
              ))}
            </div>
          </Dropdown>
        )}

        {/* Template filter */}
        {templateIds.length > 0 && (
          <Dropdown label="Template" icon={SlidersHorizontal}>
            <div className="max-h-64 overflow-y-auto">
              {templateIds.map((t) => (
                <CheckboxItem
                  key={t}
                  label={t}
                  checked={filters.template_id === t}
                  onChange={() => setFilter("template_id", filters.template_id === t ? "" : t)}
                />
              ))}
            </div>
          </Dropdown>
        )}

        {/* Tags filter */}
        {tagsList.length > 0 && (
          <Dropdown label="Tags" icon={SlidersHorizontal}>
            <div className="max-h-64 overflow-y-auto">
              {tagsList.map((tag) => (
                <CheckboxItem
                  key={tag}
                  label={tag}
                  checked={(filters.tags || []).includes(tag)}
                  onChange={() => toggleArrayFilter("tags", tag)}
                />
              ))}
            </div>
          </Dropdown>
        )}

        {/* Group by */}
        <Dropdown label={`Group: ${groupOptions.find((o) => o.value === filters.group_by)?.label || "None"}`} icon={Layers}>
          {groupOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter("group_by", opt.value)}
              className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                filters.group_by === opt.value
                  ? "bg-primary-500/10 text-primary-400"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </Dropdown>

        {/* Sort */}
        <Dropdown
          label={`Sort: ${sortOptions.find((o) => o.value === filters.sort_by)?.label || "Severity"}`}
          icon={ArrowUpDown}
        >
          {sortOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                if (filters.sort_by === opt.value) {
                  setFilter("sort_order", filters.sort_order === "desc" ? "asc" : "desc");
                } else {
                  setFilter("sort_by", opt.value);
                }
              }}
              className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between transition-colors ${
                filters.sort_by === opt.value
                  ? "bg-primary-500/10 text-primary-400"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04]"
              }`}
            >
              {opt.label}
              {filters.sort_by === opt.value && (
                <span className="text-xs">{filters.sort_order === "asc" ? "↑" : "↓"}</span>
              )}
            </button>
          ))}
        </Dropdown>

        <div className="flex-1" />

        {/* Actions */}
        <Button variant="ghost" size="sm" onClick={onToggleBulkMode}>
          <CheckSquare className={`h-4 w-4 ${bulkMode ? "text-primary-400" : ""}`} />
        </Button>
        <Button variant="ghost" size="sm" onClick={onExport}>
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
