import React, { useState, useCallback, useMemo, useEffect } from "react";
import { ShieldCheck, Radar, RefreshCw } from "lucide-react";
import { useProject } from "../../contexts/useProject";
import { Button, EmptyState, Spinner } from "../ui";
import useVulnFilters from "../../hooks/useVulnFilters";
import {
  useFindings,
  useFindingStats,
  useFindingHostnames,
  useFindingTemplateIds,
  useFindingTags,
  useUpdateTriage,
  useBulkTriage,
} from "../../hooks/useFindings";
import VulnStatsStrip from "./VulnStatsStrip";
import VulnToolbar from "./VulnToolbar";
import VulnFilterBar from "./VulnFilterBar";
import VulnTable from "./VulnTable";
import VulnGroupedView from "./VulnGroupedView";
import VulnDetailPanel from "./VulnDetailPanel";
import VulnBulkBar from "./VulnBulkBar";
import VulnPagination from "./VulnPagination";
import api from "../../utils/api";
import useToast from "../../contexts/useToast";

export default function VulnerabilitiesPage() {
  const { projectId, projectName } = useProject();
  const showToast = useToast();
  const {
    filters,
    setFilter,
    toggleArrayFilter,
    clearFilter,
    clearAll,
    hasActiveFilters,
  } = useVulnFilters();

  // Data queries
  const { data: findingsData, isLoading, isError, refetch } = useFindings(projectId, filters);
  const { data: stats, refetch: refetchStats } = useFindingStats(projectId);
  const { data: hostnames = [] } = useFindingHostnames(projectId);
  const { data: templateIds = [] } = useFindingTemplateIds(projectId);
  const { data: tagsList = [] } = useFindingTags(projectId);

  const findings = findingsData?.items || [];
  const pagination = findingsData?.pagination || { page: 1, page_size: 50, total: 0, total_pages: 0 };

  // Mutations
  const updateTriage = useUpdateTriage(projectId);
  const bulkTriage = useBulkTriage(projectId);

  // UI state
  const [selectedId, setSelectedId] = useState(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkTriageValue, setBulkTriageValue] = useState("");
  const [isQueueingFindings, setIsQueueingFindings] = useState(false);

  const selectedFinding = useMemo(
    () => findings.find((f) => f.id === selectedId) || null,
    [findings, selectedId]
  );

  // Reset selection when data changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [findingsData]);

  // Handlers
  const handleSelectFinding = useCallback((id) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const handleToggleBulkSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleSelectAllPage = useCallback(() => {
    setSelectedIds(new Set(findings.map((f) => f.id)));
  }, [findings]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleToggleBulkMode = useCallback(() => {
    setBulkMode((prev) => !prev);
    setSelectedIds(new Set());
    setBulkTriageValue("");
  }, []);

  const handleBulkTriage = useCallback(() => {
    if (selectedIds.size === 0 || !bulkTriageValue) return;
    bulkTriage.mutate(
      { findingIds: [...selectedIds], triageStatus: bulkTriageValue },
      {
        onSuccess: () => {
          setSelectedIds(new Set());
          setBulkTriageValue("");
          refetchStats();
        },
      }
    );
  }, [selectedIds, bulkTriageValue, bulkTriage, refetchStats]);

  const handleUpdateTriage = useCallback(
    (findingId, triageStatus) => {
      updateTriage.mutate(
        { findingId, triageStatus },
        { onSuccess: () => refetchStats() }
      );
    },
    [updateTriage, refetchStats]
  );

  const handleSort = useCallback(
    (field, order) => {
      setFilter("sort_by", field);
      setFilter("sort_order", order);
    },
    [setFilter]
  );

  const handleRefresh = useCallback(() => {
    refetch();
    refetchStats();
  }, [refetch, refetchStats]);

  const handleExport = useCallback(() => {
    if (!findings.length) return;
    const headers = ["Severity", "Title", "Hostname", "Template ID", "Triage", "Description", "Matched At", "Last Seen"];
    const csv = [
      headers,
      ...findings.map((f) => [
        f.severity || "",
        f.title || "",
        f.asset_hostname || "",
        f.template_id || "",
        f.triage_status || "",
        f.description || "",
        f.matched_at || "",
        f.last_seen_at || "",
      ]),
    ]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vulnerabilities-${projectName}-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, [findings, projectName]);

  const handleQueueFindingsTask = useCallback(async () => {
    setIsQueueingFindings(true);
    try {
      await api.post(`/v2/projects/${projectId}/tasks`, {
        task_type: "run_findings_scan",
        label: `Findings scan ${new Date().toLocaleString()}`,
        requested_input: { use_primary_url: true },
        approval_mode: "auto",
      });
      showToast("Queued a findings scan task. Monitor progress from the Tasks page.", "success");
    } catch (error) {
      showToast(`Failed to queue findings task: ${error.message}`, "error");
    } finally {
      setIsQueueingFindings(false);
    }
  }, [projectId]);

  const handleToggleSeverity = useCallback(
    (sev) => toggleArrayFilter("severities", sev),
    [toggleArrayFilter]
  );

  const handleToggleTriage = useCallback(
    (t) => toggleArrayFilter("triage_statuses", t),
    [toggleArrayFilter]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "ArrowLeft" && pagination.page > 1) {
        setFilter("page", pagination.page - 1);
      } else if (e.key === "ArrowRight" && pagination.page < pagination.total_pages) {
        setFilter("page", pagination.page + 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [pagination, setFilter]);

  const showGrouped = filters.group_by && filters.group_by !== "none";

  // Empty state (no findings at all, no filters active)
  if (!isLoading && !isError && pagination.total === 0 && !hasActiveFilters && !stats?.total) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <EmptyState
          icon={ShieldCheck}
          title="No Vulnerabilities Found"
          description="No vulnerability findings have been recorded for this project yet. Run a findings scan to detect vulnerabilities."
          action={
            <Button
              variant="primary"
              onClick={handleQueueFindingsTask}
              disabled={isQueueingFindings}
            >
              <Radar className="h-4 w-4" />
              {isQueueingFindings ? "Queueing..." : "Queue Findings Scan"}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/[0.06] bg-white dark:bg-gray-900/80 flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Vulnerabilities</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {projectName} · {pagination.total.toLocaleString()} findings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleRefresh} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleQueueFindingsTask}
            disabled={isQueueingFindings}
          >
            <Radar className="h-4 w-4" />
            {isQueueingFindings ? "Queueing..." : "Queue Scan"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <VulnStatsStrip
        stats={stats}
        filters={filters}
        onToggleSeverity={handleToggleSeverity}
        onToggleTriage={handleToggleTriage}
      />

      {/* Toolbar */}
      <VulnToolbar
        filters={filters}
        setFilter={setFilter}
        toggleArrayFilter={toggleArrayFilter}
        clearAll={clearAll}
        hostnames={hostnames}
        templateIds={templateIds}
        tagsList={tagsList}
        onExport={handleExport}
        bulkMode={bulkMode}
        onToggleBulkMode={handleToggleBulkMode}
      />

      {/* Active filter pills */}
      {hasActiveFilters && (
        <VulnFilterBar
          filters={filters}
          clearFilter={clearFilter}
          clearAll={clearAll}
        />
      )}

      {/* Main content area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Findings list */}
        <div className={`flex-1 flex flex-col min-w-0 overflow-y-auto transition-all ${selectedFinding ? "w-[60%]" : "w-full"}`}>
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center py-20">
              <EmptyState
                title="Failed to load findings"
                description="An error occurred fetching vulnerability data. Please try again."
                action={<Button variant="secondary" onClick={handleRefresh}>Retry</Button>}
              />
            </div>
          ) : findings.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <EmptyState
                icon={ShieldCheck}
                title="No Matching Findings"
                description="Adjust your search or filter criteria."
                action={hasActiveFilters ? <Button variant="secondary" onClick={clearAll}>Clear Filters</Button> : undefined}
              />
            </div>
          ) : (
            <div className="p-6">
              {showGrouped ? (
                <VulnGroupedView
                  findings={findings}
                  groupBy={filters.group_by}
                  selectedId={selectedId}
                  onSelect={handleSelectFinding}
                  bulkMode={bulkMode}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleBulkSelect}
                  sortBy={filters.sort_by}
                  sortOrder={filters.sort_order}
                  onSort={handleSort}
                />
              ) : (
                <VulnTable
                  findings={findings}
                  selectedId={selectedId}
                  onSelect={handleSelectFinding}
                  bulkMode={bulkMode}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleBulkSelect}
                  onSelectAll={handleSelectAllPage}
                  allSelected={selectedIds.size === findings.length && findings.length > 0}
                  sortBy={filters.sort_by}
                  sortOrder={filters.sort_order}
                  onSort={handleSort}
                />
              )}
            </div>
          )}

          {/* Pagination */}
          {pagination.total > 0 && (
            <div className="mt-auto">
              <VulnPagination
                page={pagination.page}
                pageSize={pagination.page_size}
                total={pagination.total}
                totalPages={pagination.total_pages}
                onPageChange={(p) => setFilter("page", p)}
                onPageSizeChange={(s) => setFilter("page_size", s)}
              />
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedFinding && (
          <div className="w-[40%] min-w-[320px] max-w-[600px] flex-shrink-0 h-full">
            <VulnDetailPanel
              finding={selectedFinding}
              onClose={() => setSelectedId(null)}
              onUpdateTriage={handleUpdateTriage}
              isUpdating={updateTriage.isPending}
            />
          </div>
        )}
      </div>

      {/* Bulk triage bar */}
      {bulkMode && (
        <VulnBulkBar
          selectedCount={selectedIds.size}
          onSelectAllPage={handleSelectAllPage}
          onClearSelection={handleClearSelection}
          onBulkTriage={handleBulkTriage}
          isUpdating={bulkTriage.isPending}
          triageValue={bulkTriageValue}
          onTriageValueChange={setBulkTriageValue}
        />
      )}
    </div>
  );
}
