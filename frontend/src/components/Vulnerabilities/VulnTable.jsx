import React from "react";
import { Table, Badge, Tooltip } from "../ui";
import { Bug, AlertTriangle, Info } from "lucide-react";

const severityIcon = { critical: Bug, high: AlertTriangle, medium: AlertTriangle, low: Info, info: Info };
const severityDot = { critical: "bg-red-500", high: "bg-orange-500", medium: "bg-amber-500", low: "bg-blue-500", info: "bg-gray-500" };
const triageVariant = { new: "default", acknowledged: "info", in_progress: "warning", resolved: "success", false_positive: "danger" };

function relativeTime(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function VulnTable({
  findings,
  selectedId,
  onSelect,
  bulkMode,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  allSelected,
  sortBy,
  sortOrder,
  onSort,
}) {
  const handleSort = (field) => {
    if (sortBy === field) {
      onSort(field, sortOrder === "desc" ? "asc" : "desc");
    } else {
      onSort(field, field === "title" || field === "hostname" ? "asc" : "desc");
    }
  };

  return (
    <Table>
      <Table.Head>
        <tr>
          {bulkMode && (
            <Table.HeadCell className="w-10">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onSelectAll}
                className="rounded border-gray-300 dark:border-white/[0.15] text-primary-500 focus:ring-primary-500/30 bg-transparent"
              />
            </Table.HeadCell>
          )}
          <Table.HeadCell className="w-28" sortable sorted={sortBy === "severity" ? sortOrder : null} onClick={() => handleSort("severity")}>
            Severity
          </Table.HeadCell>
          <Table.HeadCell sortable sorted={sortBy === "title" ? sortOrder : null} onClick={() => handleSort("title")}>
            Title
          </Table.HeadCell>
          <Table.HeadCell className="hidden lg:table-cell" sortable sorted={sortBy === "hostname" ? sortOrder : null} onClick={() => handleSort("hostname")}>
            Hostname
          </Table.HeadCell>
          <Table.HeadCell className="hidden xl:table-cell w-44">
            Template
          </Table.HeadCell>
          <Table.HeadCell className="w-32">
            Triage
          </Table.HeadCell>
          <Table.HeadCell className="w-28 hidden md:table-cell" sortable sorted={sortBy === "last_seen_at" ? sortOrder : null} onClick={() => handleSort("last_seen_at")}>
            Last Seen
          </Table.HeadCell>
        </tr>
      </Table.Head>
      <Table.Body>
        {findings.map((f) => {
          const sev = f.severity?.toLowerCase() || "info";
          const triage = f.triage_status || "new";
          const isSelected = selectedId === f.id;
          const isBulkSelected = selectedIds?.has(f.id);

          return (
            <Table.Row
              key={f.id}
              selected={isSelected || isBulkSelected}
              className="cursor-pointer"
              onClick={(e) => {
                if (bulkMode) {
                  onToggleSelect(f.id);
                } else {
                  onSelect(f.id);
                }
              }}
            >
              {bulkMode && (
                <Table.Cell className="w-10" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isBulkSelected}
                    onChange={() => onToggleSelect(f.id)}
                    className="rounded border-gray-300 dark:border-white/[0.15] text-primary-500 focus:ring-primary-500/30 bg-transparent"
                  />
                </Table.Cell>
              )}
              <Table.Cell className="w-28">
                <span className="inline-flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${severityDot[sev]}`} />
                  <span className="capitalize text-xs font-medium">{sev}</span>
                </span>
              </Table.Cell>
              <Table.Cell>
                <Tooltip content={f.title} position="top">
                  <span className="block truncate max-w-[300px] font-medium text-gray-800 dark:text-gray-200">
                    {f.title || "Untitled"}
                  </span>
                </Tooltip>
                {f.description && (
                  <span className="block truncate max-w-[300px] text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {f.description}
                  </span>
                )}
              </Table.Cell>
              <Table.Cell className="hidden lg:table-cell">
                <span className="truncate max-w-[180px] block text-xs font-mono text-gray-600 dark:text-gray-400">
                  {f.asset_hostname || "—"}
                </span>
              </Table.Cell>
              <Table.Cell className="hidden xl:table-cell w-44">
                <span className="truncate max-w-[160px] block text-xs font-mono text-gray-600 dark:text-gray-400">
                  {f.template_id || "—"}
                </span>
              </Table.Cell>
              <Table.Cell className="w-32">
                <Badge variant={triageVariant[triage] || "default"}>
                  {triage.replace(/_/g, " ")}
                </Badge>
              </Table.Cell>
              <Table.Cell className="w-28 hidden md:table-cell">
                <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                  {relativeTime(f.last_seen_at)}
                </span>
              </Table.Cell>
            </Table.Row>
          );
        })}
      </Table.Body>
    </Table>
  );
}
