import React, { useEffect, useState } from "react";
import { Card, Button, Input, Badge, Select, EmptyState, Spinner } from "./components/ui";
import Checkbox from "./components/ui/Checkbox";
import { useProject } from "./contexts/useProject";
import useToast from "./contexts/useToast";
import {
  Search,
  Clock,
  Check,
  X,
  RefreshCw,
  Globe,
  Server,
  Bug,
  Radar,
  Filter,
  Calendar,
  Activity,
  Plus,
} from "lucide-react";

const toEpochMillis = (value) => {
  if (!value) return null;
  const epochMillis = new Date(value).getTime();
  return Number.isFinite(epochMillis) ? epochMillis : null;
};

const calculateDurationSeconds = (startTime, endTime) => {
  const startEpochMillis = toEpochMillis(startTime);
  const endEpochMillis = toEpochMillis(endTime);
  if (startEpochMillis == null || endEpochMillis == null || endEpochMillis < startEpochMillis) {
    return null;
  }
  return Math.floor((endEpochMillis - startEpochMillis) / 1000);
};

const adaptTaskToHistory = (task) => {
  const requestedInput = task.requested_input || {};
  const statusMap = {
    queued: "pending",
    planning: "pending",
    awaiting_approval: "pending",
    cancelling: "cancelling",
    running: "running",
    ingesting: "running",
    completed: "completed",
    failed: "failed",
    cancelled: "cancelled",
  };

  return {
    id: task.id,
    scan_type: task.task_type,
    target: requestedInput.scope_value || requestedInput.hostname || task.label,
    status: statusMap[task.status] || task.status,
    started_at: task.started_at || null,
    duration: calculateDurationSeconds(task.started_at, task.completed_at),
    results_count: task.result_summary?.assets_upserted || task.result_summary?.discovered_hosts || 0,
    config: requestedInput,
    label: task.label,
    raw_status: task.status,
    source_kind: "task",
  };
};

const formatTypeLabel = (value) =>
  (value || "")
    .replaceAll("_", " ")
    .replaceAll(".", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const DEFAULT_TASK_CAPABILITIES = [
  {
    task_type: "enumerate_scope",
    display_name: "Enumerate Scope",
    description: "Discover hosts for a root domain and optionally enrich them with HTTP metadata and screenshots.",
  },
  {
    task_type: "port_scan",
    display_name: "Port Scan",
    description: "Scan IP addresses or CIDR ranges with nmap to discover open ports and active hosts.",
  },
  {
    task_type: "service_discovery",
    display_name: "Service Discovery",
    description: "Run httpx against selected assets to identify web services, technologies, and metadata.",
  },
  {
    task_type: "run_findings_scan",
    display_name: "Run Findings Scan",
    description: "Run nuclei against existing v2 assets with optional targeting, template filters, and runtime limits.",
  },
];

const createTaskFormState = () => ({
  label: "",
  scopeValue: "",
  includeHttpEnrichment: true,
  includeScreenshots: false,
  hostnames: "",
  assetIds: "",
  maxAssets: "25",
  ports: "",
  templates: "",
  tags: "",
  severity: "medium,high,critical",
  excludeTags: "",
  excludeSeverity: "",
  usePrimaryUrl: true,
  runAllTemplates: false,
  rateLimit: "150",
  timeout: "10",
  retries: "2",
  commandTimeout: "300",
  // port_scan fields
  targets: "",
  topPorts: "100",
  scanType: "sT",
  timing: "4",
  portScanMaxRate: "",
  portScanCommandTimeout: "300",
  createAssets: true,
  // service_discovery fields
  serviceDiscoveryCommandTimeout: "120",
});

const parseDelimitedInput = (value) =>
  String(value || "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

const buildTaskPayload = ({ taskType, form }) => {
  if (taskType === "enumerate_scope") {
    const scopeValue = form.scopeValue.trim().toLowerCase();
    if (!scopeValue) {
      throw new Error("Root domain is required.");
    }

    return {
      task_type: taskType,
      label: form.label.trim() || `Enumerate ${scopeValue}`,
      approval_mode: "auto",
      requested_input: {
        scope_type: "domain",
        scope_value: scopeValue,
        include_http_enrichment: form.includeHttpEnrichment,
        include_screenshots: form.includeScreenshots,
      },
    };
  }

  if (taskType === "port_scan") {
    const targets = parseDelimitedInput(form.targets);
    if (!targets.length) {
      throw new Error("At least one target IP or CIDR is required.");
    }
    const ports = parseDelimitedInput(form.ports)
      .map((v) => Number.parseInt(v, 10))
      .filter((v) => Number.isInteger(v) && v > 0);
    const topPorts = Number.parseInt(form.topPorts, 10) || 100;
    const timing = Number.parseInt(form.timing, 10);
    const maxRate = form.portScanMaxRate ? Number.parseInt(form.portScanMaxRate, 10) : undefined;
    const commandTimeout = Number.parseInt(form.portScanCommandTimeout, 10) || 300;

    return {
      task_type: taskType,
      label: form.label.trim() || `Port scan ${targets.length === 1 ? targets[0] : `${targets.length} targets`}`,
      approval_mode: "auto",
      requested_input: {
        targets,
        ports,
        top_ports: ports.length > 0 ? undefined : topPorts,
        scan_type: form.scanType || "sT",
        timing: Number.isInteger(timing) && timing >= 0 && timing <= 5 ? timing : 4,
        max_rate: Number.isInteger(maxRate) && maxRate > 0 ? maxRate : undefined,
        command_timeout: commandTimeout,
        create_assets: form.createAssets,
      },
    };
  }

  if (taskType === "service_discovery") {
    const hostnames = parseDelimitedInput(form.hostnames).map((v) => v.toLowerCase());
    const assetIds = parseDelimitedInput(form.assetIds);
    const ports = parseDelimitedInput(form.ports)
      .map((v) => Number.parseInt(v, 10))
      .filter((v) => Number.isInteger(v) && v > 0);
    if (!hostnames.length && !assetIds.length) {
      throw new Error("At least one hostname or asset ID is required.");
    }
    const commandTimeout = Number.parseInt(form.serviceDiscoveryCommandTimeout, 10) || 120;

    return {
      task_type: taskType,
      label: form.label.trim() || `Service discovery for ${hostnames.length || assetIds.length} target(s)`,
      approval_mode: "auto",
      requested_input: {
        hostnames,
        asset_ids: assetIds,
        ports,
        include_screenshots: form.includeScreenshots,
        command_timeout: commandTimeout,
      },
    };
  }

  const hostnames = parseDelimitedInput(form.hostnames).map((value) => value.toLowerCase());
  const assetIds = parseDelimitedInput(form.assetIds);
  const ports = parseDelimitedInput(form.ports)
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isInteger(value) && value > 0);
  const templates = parseDelimitedInput(form.templates);
  const tags = parseDelimitedInput(form.tags);
  const severity = parseDelimitedInput(form.severity).map((value) => value.toLowerCase());
  const excludeTags = parseDelimitedInput(form.excludeTags);
  const excludeSeverity = parseDelimitedInput(form.excludeSeverity).map((value) => value.toLowerCase());

  if (templates.length && tags.length) {
    throw new Error("Use either templates or tags for findings scans, not both.");
  }
  if (form.runAllTemplates && (templates.length || tags.length)) {
    throw new Error("Clear templates and tags when running all templates.");
  }

  const maxAssets = form.maxAssets ? Number.parseInt(form.maxAssets, 10) : undefined;
  const rateLimit = form.rateLimit ? Number.parseInt(form.rateLimit, 10) : undefined;
  const timeout = form.timeout ? Number.parseInt(form.timeout, 10) : undefined;
  const retries = form.retries ? Number.parseInt(form.retries, 10) : undefined;
  const commandTimeout = form.commandTimeout ? Number.parseInt(form.commandTimeout, 10) : undefined;

  return {
    task_type: taskType,
    label:
      form.label.trim() ||
      (hostnames.length
        ? `Findings scan for ${hostnames.length === 1 ? hostnames[0] : `${hostnames.length} hosts`}`
        : "Findings scan across project assets"),
    approval_mode: "auto",
    requested_input: {
      hostnames,
      asset_ids: assetIds,
      max_assets: Number.isInteger(maxAssets) && maxAssets > 0 ? maxAssets : undefined,
      ports,
      templates,
      tags,
      severity,
      exclude_tags: excludeTags,
      exclude_severity: excludeSeverity,
      use_primary_url: form.usePrimaryUrl,
      run_all_templates: form.runAllTemplates,
      rate_limit: Number.isInteger(rateLimit) && rateLimit > 0 ? rateLimit : undefined,
      timeout: Number.isInteger(timeout) && timeout > 0 ? timeout : undefined,
      retries: Number.isInteger(retries) && retries >= 0 ? retries : undefined,
      command_timeout:
        Number.isInteger(commandTimeout) && commandTimeout > 0 ? commandTimeout : undefined,
    },
  };
};

// ─── Scan Status Item ────────────────────────────────────────
const ScanStatusItem = ({ scanType, startTime, progress, message, onStop }) => {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!startTime) return;
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const icons = {
    subfinder: <Globe className="h-4 w-4" />,
    httpx: <Server className="h-4 w-4" />,
    naabu: <Radar className="h-4 w-4" />,
    nuclei: <Bug className="h-4 w-4" />,
  };

  return (
    <div className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors border-b border-gray-100 dark:border-white/[0.04] last:border-0">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">{icons[scanType] || <Radar className="h-4 w-4" />}</span>
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 capitalize">{scanType}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/[0.04] px-2 py-0.5 rounded-md border border-gray-200 dark:border-white/[0.06]">
            {formatTime(elapsedTime)}
          </span>
          <button onClick={onStop} className="text-gray-400 hover:text-red-400 transition-colors" title="Stop scan">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {progress > 0 && (
        <div className="mb-2">
          <div className="w-full bg-gray-100 dark:bg-white/[0.06] rounded-full h-1 overflow-hidden">
            <div className="bg-primary-500 h-1 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {message && <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{message}</p>}
    </div>
  );
};

// ─── Live Duration ───────────────────────────────────────────
const LiveDuration = ({ startTime, status, staticDuration }) => {
  const [elapsed, setElapsed] = useState(0);
  const isActive = status === "running" || status === "pending" || status === "cancelling";
  const hasValidStartTime = toEpochMillis(startTime) != null;

  useEffect(() => {
    if (!isActive) return undefined;
    const start = toEpochMillis(startTime);
    if (start == null) {
      setElapsed(0);
      return undefined;
    }
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [isActive, startTime]);

  const fmt = (s) => {
    if (s == null) return "—";
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  };

  if (isActive) {
    if (!hasValidStartTime) {
      return <span className="font-mono text-sm text-gray-500 dark:text-gray-400">—</span>;
    }
    return <span className="font-mono text-sm text-gray-500 dark:text-gray-400 animate-pulse">{fmt(elapsed)}</span>;
  }
  return <span className="font-mono text-sm">{fmt(staticDuration)}</span>;
};

// ─── Main Component ──────────────────────────────────────────
function Scans() {
  const { project: selectedProject, projectId } = useProject();
  const showToast = useToast();
  const [scanHistory, setScanHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [taskCapabilities, setTaskCapabilities] = useState(DEFAULT_TASK_CAPABILITIES);
  const [selectedTaskType, setSelectedTaskType] = useState(DEFAULT_TASK_CAPABILITIES[0].task_type);
  const [taskForm, setTaskForm] = useState(createTaskFormState);
  const [showAdvancedTaskOptions, setShowAdvancedTaskOptions] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [showTaskDetailsModal, setShowTaskDetailsModal] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [selectedTaskDetails, setSelectedTaskDetails] = useState(null);
  const [selectedTaskEvents, setSelectedTaskEvents] = useState([]);
  const [selectedTaskArtifacts, setSelectedTaskArtifacts] = useState([]);
  const [isTaskDetailsLoading, setIsTaskDetailsLoading] = useState(false);

  const streamableTaskIds = scanHistory
    .filter(
      (scan) =>
        scan.source_kind === "task" &&
        !["completed", "failed", "cancelled"].includes(scan.raw_status)
    )
    .map((scan) => scan.id);
  const streamableTaskKey = streamableTaskIds.join("|");

  useEffect(() => {
    if (projectId) loadScanHistory(projectId);
    else setIsLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadTaskCapabilities();
  }, []);

  useEffect(() => {
    let filtered = scanHistory;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.scan_type?.toLowerCase().includes(q) ||
          s.label?.toLowerCase().includes(q) ||
          s.target?.toLowerCase().includes(q) ||
          s.config?.domain?.toLowerCase().includes(q)
      );
    }
    if (filterType !== "all") filtered = filtered.filter((s) => s.scan_type === filterType);
    if (filterStatus !== "all") filtered = filtered.filter((s) => s.status === filterStatus);
    setFilteredHistory(filtered);
  }, [scanHistory, searchTerm, filterType, filterStatus]);

  useEffect(() => {
    if (!taskCapabilities.length) return;
    if (!taskCapabilities.some((capability) => capability.task_type === selectedTaskType)) {
      setSelectedTaskType(taskCapabilities[0].task_type);
    }
  }, [selectedTaskType, taskCapabilities]);

  useEffect(() => {
    if (!selectedProject?.id || streamableTaskIds.length === 0) {
      return undefined;
    }

    let disposed = false;
    let refreshTimeoutId = null;

    const scheduleRefresh = () => {
      if (disposed || refreshTimeoutId !== null) {
        return;
      }

      refreshTimeoutId = window.setTimeout(async () => {
        refreshTimeoutId = null;
        if (!disposed) {
          await loadScanHistory(selectedProject.id);
        }
      }, 250);
    };

    const sources = streamableTaskIds.map((taskId) => {
      const source = new EventSource(
        `${import.meta.env.VITE_API_BASE_URL}/v2/tasks/${taskId}/events/stream`,
        { withCredentials: true }
      );

      source.addEventListener("task_event", scheduleRefresh);
      source.addEventListener("task_terminal", () => {
        scheduleRefresh();
        source.close();
      });
      source.onerror = () => {
        source.close();
      };

      return source;
    });

    return () => {
      disposed = true;
      if (refreshTimeoutId !== null) {
        window.clearTimeout(refreshTimeoutId);
      }
      sources.forEach((source) => source.close());
    };
  }, [selectedProject?.id, streamableTaskKey]);

  const loadTaskCapabilities = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/v2/task-capabilities`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(res.statusText);
      }
      const data = await res.json();
      const items = Array.isArray(data.items) && data.items.length ? data.items : DEFAULT_TASK_CAPABILITIES;
      setTaskCapabilities(items);
    } catch (err) {
      console.error("Error loading task capabilities:", err);
      setTaskCapabilities(DEFAULT_TASK_CAPABILITIES);
    }
  };

  const loadTaskHistory = async (pid) => {
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/v2/projects/${pid}/tasks?page=1&page_size=100`, { credentials: "include" });
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    return (data.items || []).map(adaptTaskToHistory);
  };

  const loadScanHistory = async (pid) => {
    setIsLoading(true);
    try {
      const tasks = await loadTaskHistory(pid);
      setScanHistory(tasks);
    } catch (err) {
      console.error("Error loading task history:", err);
      setScanHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  const updateTaskForm = (updates) => {
    setTaskForm((current) => ({ ...current, ...updates }));
  };

  const createTask = async () => {
    if (!selectedProject?.id) {
      showToast("Select a project first.", "error");
      return;
    }

    try {
      const payload = buildTaskPayload({ taskType: selectedTaskType, form: taskForm });
      setIsCreatingTask(true);
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/v2/projects/${selectedProject.id}/tasks`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || res.statusText);
      }

      setTaskForm((current) => ({
        ...createTaskFormState(),
        hostnames: selectedTaskType === "run_findings_scan" ? current.hostnames : "",
        severity: "medium,high,critical",
      }));
      await loadScanHistory(selectedProject.id);
      showToast("Task queued for agent pickup.", "success");
    } catch (err) {
      console.error("Error creating task:", err);
      showToast(`Failed to queue task: ${err.message}`, "error");
    } finally {
      setIsCreatingTask(false);
    }
  };

  const cancelTask = async (taskId) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/v2/tasks/${taskId}/cancel`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || res.statusText);
      }
      const updatedTask = await res.json().catch(() => null);
      await loadScanHistory(selectedProject.id);
      showToast(
        updatedTask?.status === "cancelling"
          ? "Cancellation requested. The worker will stop at the next safe checkpoint."
          : "Task cancelled.",
        "success"
      );
    } catch (err) {
      console.error("Error cancelling task:", err);
      showToast(`Failed to cancel task: ${err.message}`, "error");
    }
  };

  const retryTask = async (taskId) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/v2/tasks/${taskId}/retry`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || res.statusText);
      }
      await loadScanHistory(selectedProject.id);
      showToast("Task re-queued.", "success");
    } catch (err) {
      console.error("Error retrying task:", err);
      showToast(`Failed to retry task: ${err.message}`, "error");
    }
  };

  const loadTaskDetails = async (taskId, { showSpinner = false, failSilently = false } = {}) => {
    if (!selectedProject?.id) return false;
    if (showSpinner) {
      setIsTaskDetailsLoading(true);
    }
    try {
      const [taskRes, eventsRes, artifactsRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_BASE_URL}/v2/tasks/${taskId}`, { credentials: "include" }),
        fetch(`${import.meta.env.VITE_API_BASE_URL}/v2/tasks/${taskId}/events`, { credentials: "include" }),
        fetch(
          `${import.meta.env.VITE_API_BASE_URL}/v2/projects/${selectedProject.id}/artifacts?page=1&page_size=20&task_id=${taskId}`,
          { credentials: "include" }
        ),
      ]);

      if (!taskRes.ok || !eventsRes.ok || !artifactsRes.ok) {
        throw new Error("Failed to load task details");
      }

      const [taskData, eventsData, artifactsData] = await Promise.all([
        taskRes.json(),
        eventsRes.json(),
        artifactsRes.json(),
      ]);

      setSelectedTaskDetails(taskData);
      setSelectedTaskEvents(eventsData.items || []);
      setSelectedTaskArtifacts(artifactsData.items || []);
      return true;
    } catch (err) {
      console.error("Error loading task details:", err);
      if (!failSilently) {
        showToast(`Failed to load task details: ${err.message}`, "error");
        setShowTaskDetailsModal(false);
        setSelectedTaskId(null);
      }
      return false;
    } finally {
      if (showSpinner) {
        setIsTaskDetailsLoading(false);
      }
    }
  };

  const openTaskDetails = async (taskId) => {
    if (!selectedProject?.id) return;

    setSelectedTaskId(taskId);
    setShowTaskDetailsModal(true);
    setSelectedTaskDetails(null);
    setSelectedTaskEvents([]);
    setSelectedTaskArtifacts([]);
    await loadTaskDetails(taskId, { showSpinner: true });
  };

  useEffect(() => {
    if (!showTaskDetailsModal || !selectedTaskId || !selectedProject?.id) {
      return undefined;
    }

    const source = new EventSource(
      `${import.meta.env.VITE_API_BASE_URL}/v2/tasks/${selectedTaskId}/events/stream`,
      { withCredentials: true }
    );

    const refreshTaskDetails = async () => {
      await loadTaskDetails(selectedTaskId, { failSilently: true });
      await loadScanHistory(selectedProject.id);
    };

    source.addEventListener("task_event", refreshTaskDetails);
    source.addEventListener("task_terminal", async () => {
      await refreshTaskDetails();
      source.close();
    });
    source.onerror = () => {
      source.close();
    };

    return () => {
      source.close();
    };
  }, [selectedProject?.id, selectedTaskId, showTaskDetailsModal]);

  const formatDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const scanIcons = {
    subfinder: <Globe className="h-4 w-4" />,
    httpx: <Server className="h-4 w-4" />,
    naabu: <Radar className="h-4 w-4" />,
    nuclei: <Bug className="h-4 w-4" />,
    enumerate_scope: <Globe className="h-4 w-4" />,
    enrich_assets: <Server className="h-4 w-4" />,
    capture_screenshots: <Radar className="h-4 w-4" />,
    analyze_project: <Activity className="h-4 w-4" />,
    run_findings_scan: <Bug className="h-4 w-4" />,
    port_scan: <Radar className="h-4 w-4" />,
    service_discovery: <Server className="h-4 w-4" />,
  };

  const statusBadge = (status) => {
    const map = {
      completed: { variant: "success", icon: <Check className="h-3 w-3" />, label: "Completed" },
      failed: { variant: "danger", icon: <X className="h-3 w-3" />, label: "Failed" },
      running: { variant: "info", icon: <RefreshCw className="h-3 w-3 animate-spin" />, label: "Running" },
      cancelling: { variant: "warning", icon: <X className="h-3 w-3" />, label: "Cancelling" },
      pending: { variant: "warning", icon: <Clock className="h-3 w-3" />, label: "Pending" },
      cancelled: { variant: "default", icon: <X className="h-3 w-3" />, label: "Cancelled" },
    };
    const m = map[status] || { variant: "default", label: status };
    return (
      <Badge variant={m.variant} className="gap-1">
        {m.icon} {m.label}
      </Badge>
    );
  };

  const selectedTaskCapability =
    taskCapabilities.find((capability) => capability.task_type === selectedTaskType) ||
    taskCapabilities[0] ||
    DEFAULT_TASK_CAPABILITIES[0];
  const activeFilters = (filterType !== "all" ? 1 : 0) + (filterStatus !== "all" ? 1 : 0);
  const typeOptions = [
    { value: "all", label: "All Types" },
    ...taskCapabilities.map((capability) => ({
      value: capability.task_type,
      label: capability.display_name,
    })),
  ];
  const statusOptions = [
    { value: "all", label: "All Statuses" },
    { value: "pending", label: "Pending" },
    { value: "running", label: "Running" },
    { value: "cancelling", label: "Cancelling" },
    { value: "completed", label: "Completed" },
    { value: "failed", label: "Failed" },
    { value: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Tasks
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Queue agent work, inspect execution history, and review task artifacts.
              </p>
            </div>
          </div>
        </div>

        {/* No Project */}
        {!selectedProject && !isLoading && (
          <Card className="p-0">
            <EmptyState
              icon={Radar}
              title="No Project Selected"
              description="Select a project from the Projects page to view task history."
            />
          </Card>
        )}

        {selectedProject && (
          <>
            <Card className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="primary">Agent</Badge>
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Queue New Task</h3>
                    </div>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
                      {selectedTaskCapability?.description || "Queue a supported v2 task for automatic worker pickup."}
                    </p>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Tasks are picked up automatically by the worker.
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Task Type</label>
                    <Select
                      value={selectedTaskType}
                      onChange={(e) => setSelectedTaskType(e.target.value)}
                      options={taskCapabilities.map((capability) => ({
                        value: capability.task_type,
                        label: capability.display_name,
                      }))}
                      placeholder=""
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Optional Label</label>
                    <Input
                      value={taskForm.label}
                      onChange={(e) => updateTaskForm({ label: e.target.value })}
                      placeholder="Leave blank to auto-generate"
                    />
                  </div>

                  {selectedTaskType === "enumerate_scope" ? (
                    <>
                      <div className="lg:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Root Domain</label>
                        <Input
                          value={taskForm.scopeValue}
                          onChange={(e) => updateTaskForm({ scopeValue: e.target.value })}
                          placeholder="example.com"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 p-4 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.03]">
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">HTTP Enrichment</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Run httpx after enumeration to collect titles, status codes, tech, and ports.</p>
                        </div>
                        <Checkbox
                          checked={taskForm.includeHttpEnrichment}
                          onChange={(val) => updateTaskForm({ includeHttpEnrichment: val })}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 p-4 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.03]">
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Capture Screenshots</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Enable screenshot capture during HTTP enrichment for live web assets.</p>
                        </div>
                        <Checkbox
                          checked={taskForm.includeScreenshots}
                          onChange={(val) => updateTaskForm({ includeScreenshots: val })}
                        />
                      </div>
                    </>
                  ) : selectedTaskType === "port_scan" ? (
                    <>
                      <div className="lg:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Targets</label>
                        <textarea
                          value={taskForm.targets}
                          onChange={(e) => updateTaskForm({ targets: e.target.value })}
                          placeholder={"192.168.1.0/24\n10.0.0.1\nexample.com"}
                          className="block min-h-[104px] w-full rounded-lg border border-gray-300 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] px-3 py-2 text-sm font-mono text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/50"
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">IPs, CIDR ranges, or hostnames — one per line or comma-separated.</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Top Ports</label>
                        <Select value={taskForm.topPorts} onChange={(e) => updateTaskForm({ topPorts: e.target.value })}>
                          <option value="100">Top 100</option>
                          <option value="1000">Top 1000</option>
                          <option value="">Custom (specify below)</option>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Custom Ports</label>
                        <Input
                          value={taskForm.ports}
                          onChange={(e) => updateTaskForm({ ports: e.target.value })}
                          placeholder="80, 443, 8080-8090"
                          disabled={taskForm.topPorts !== ""}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Scan Type</label>
                        <Select value={taskForm.scanType} onChange={(e) => updateTaskForm({ scanType: e.target.value })}>
                          <option value="sT">TCP Connect (no root needed)</option>
                          <option value="sS">SYN Scan (fast, requires root)</option>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Timing Template (0-5)</label>
                        <Select value={taskForm.timing} onChange={(e) => updateTaskForm({ timing: e.target.value })}>
                          <option value="1">T1 — Sneaky</option>
                          <option value="2">T2 — Polite</option>
                          <option value="3">T3 — Normal</option>
                          <option value="4">T4 — Aggressive (default)</option>
                          <option value="5">T5 — Insane</option>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Max Rate (packets/sec)</label>
                        <Input
                          type="number"
                          min="1"
                          value={taskForm.portScanMaxRate}
                          onChange={(e) => updateTaskForm({ portScanMaxRate: e.target.value })}
                          placeholder="Leave blank for timing default"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Command Timeout (s)</label>
                        <Input
                          type="number"
                          min="1"
                          value={taskForm.portScanCommandTimeout}
                          onChange={(e) => updateTaskForm({ portScanCommandTimeout: e.target.value })}
                          placeholder="600"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 p-4 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.03] lg:col-span-2">
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Create Assets</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Automatically create assets in the project for each discovered host.</p>
                        </div>
                        <Checkbox
                          checked={taskForm.createAssets}
                          onChange={(val) => updateTaskForm({ createAssets: val })}
                        />
                      </div>
                    </>
                  ) : selectedTaskType === "service_discovery" ? (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Target Hostnames</label>
                        <textarea
                          value={taskForm.hostnames}
                          onChange={(e) => updateTaskForm({ hostnames: e.target.value })}
                          placeholder={"192.168.1.1\n192.168.1.50\nexample.com"}
                          className="block min-h-[104px] w-full rounded-lg border border-gray-300 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] px-3 py-2 text-sm font-mono text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Asset IDs</label>
                        <textarea
                          value={taskForm.assetIds}
                          onChange={(e) => updateTaskForm({ assetIds: e.target.value })}
                          placeholder="asset_123, asset_456"
                          className="block min-h-[104px] w-full rounded-lg border border-gray-300 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/50"
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Provide either hostnames or asset IDs from the project.</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Ports Override</label>
                        <Input
                          value={taskForm.ports}
                          onChange={(e) => updateTaskForm({ ports: e.target.value })}
                          placeholder="80, 443, 8080"
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Leave empty to use ports discovered from port scan.</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Command Timeout (s)</label>
                        <Input
                          type="number"
                          min="1"
                          value={taskForm.serviceDiscoveryCommandTimeout}
                          onChange={(e) => updateTaskForm({ serviceDiscoveryCommandTimeout: e.target.value })}
                          placeholder="300"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 p-4 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.03] lg:col-span-2">
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Capture Screenshots</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Take screenshots of discovered web services during enrichment.</p>
                        </div>
                        <Checkbox
                          checked={taskForm.includeScreenshots}
                          onChange={(val) => updateTaskForm({ includeScreenshots: val })}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Target Hostnames</label>
                        <textarea
                          value={taskForm.hostnames}
                          onChange={(e) => updateTaskForm({ hostnames: e.target.value })}
                          placeholder="app.example.com, api.example.com"
                          className="block min-h-[104px] w-full rounded-lg border border-gray-300 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Asset IDs</label>
                        <textarea
                          value={taskForm.assetIds}
                          onChange={(e) => updateTaskForm({ assetIds: e.target.value })}
                          placeholder="asset_123, asset_456"
                          className="block min-h-[104px] w-full rounded-lg border border-gray-300 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Max Assets</label>
                        <Input
                          type="number"
                          min="1"
                          value={taskForm.maxAssets}
                          onChange={(e) => updateTaskForm({ maxAssets: e.target.value })}
                          placeholder="25"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Ports Override</label>
                        <Input
                          value={taskForm.ports}
                          onChange={(e) => updateTaskForm({ ports: e.target.value })}
                          placeholder="443, 8443"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Templates</label>
                        <Input
                          value={taskForm.templates}
                          onChange={(e) => updateTaskForm({ templates: e.target.value })}
                          placeholder="/app/nuclei-templates/http/exposures/apis/swagger-api.yaml"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Tags</label>
                        <Input
                          value={taskForm.tags}
                          onChange={(e) => updateTaskForm({ tags: e.target.value })}
                          placeholder="cve, exposure, default-login"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Severity Filter</label>
                        <Input
                          value={taskForm.severity}
                          onChange={(e) => updateTaskForm({ severity: e.target.value })}
                          placeholder="medium, high, critical"
                        />
                      </div>
                      <div className="flex items-center justify-end">
                        <Button variant="ghost" type="button" onClick={() => setShowAdvancedTaskOptions((value) => !value)}>
                          {showAdvancedTaskOptions ? "Hide Advanced Options" : "Show Advanced Options"}
                        </Button>
                      </div>

                      {showAdvancedTaskOptions && (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Exclude Tags</label>
                            <Input
                              value={taskForm.excludeTags}
                              onChange={(e) => updateTaskForm({ excludeTags: e.target.value })}
                              placeholder="dos, intrusive"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Exclude Severity</label>
                            <Input
                              value={taskForm.excludeSeverity}
                              onChange={(e) => updateTaskForm({ excludeSeverity: e.target.value })}
                              placeholder="info, low"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Rate Limit</label>
                            <Input
                              type="number"
                              min="1"
                              value={taskForm.rateLimit}
                              onChange={(e) => updateTaskForm({ rateLimit: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Nuclei Timeout</label>
                            <Input
                              type="number"
                              min="1"
                              value={taskForm.timeout}
                              onChange={(e) => updateTaskForm({ timeout: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Retries</label>
                            <Input
                              type="number"
                              min="0"
                              value={taskForm.retries}
                              onChange={(e) => updateTaskForm({ retries: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Command Timeout</label>
                            <Input
                              type="number"
                              min="1"
                              value={taskForm.commandTimeout}
                              onChange={(e) => updateTaskForm({ commandTimeout: e.target.value })}
                            />
                          </div>
                        </>
                      )}

                      <div className="flex items-center justify-between gap-3 p-4 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.03]">
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Use Primary URL</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Prefer each asset's canonical primary URL before expanding explicit ports.</p>
                        </div>
                        <Checkbox
                          checked={taskForm.usePrimaryUrl}
                          onChange={(val) => updateTaskForm({ usePrimaryUrl: val })}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 p-4 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.03]">
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Run All Templates</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Ignore tag and template filters and let nuclei run its full template set.</p>
                        </div>
                        <Checkbox
                          checked={taskForm.runAllTemplates}
                          onChange={(val) => updateTaskForm({ runAllTemplates: val })}
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between gap-3 border-t border-gray-200 dark:border-white/[0.06] pt-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Supports: enumerate scope, port scan, service discovery, and findings scan.
                  </p>
                  <Button onClick={createTask} loading={isCreatingTask}>
                    <Plus className="h-4 w-4" />
                    Queue Task
                  </Button>
                </div>
              </Card>

            {/* Search & Filters */}
            <Card className="p-5">
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative flex-1 max-w-md w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search tasks…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="secondary" onClick={() => setShowFilters(!showFilters)}>
                  <Filter className="h-4 w-4" />
                  Filters
                  {activeFilters > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-primary-500/15 text-primary-400">
                      {activeFilters}
                    </span>
                  )}
                </Button>
              </div>

              {showFilters && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/[0.06]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Task Type</label>
                      <Select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        options={typeOptions}
                        placeholder=""
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Status</label>
                      <Select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        options={statusOptions}
                        placeholder=""
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setFilterType("all"); setFilterStatus("all"); setSearchTerm(""); }}
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            {/* Scan History Table */}
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/[0.06]">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-gray-400" />
                  Task History
                  <Badge variant="default">{filteredHistory.length}</Badge>
                </h3>
              </div>

              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Spinner size="lg" />
                  </div>
                ) : filteredHistory.length === 0 ? (
                  <EmptyState
                    icon={Calendar}
                    title="No Tasks Yet"
                    description={searchTerm || filterType !== "all" || filterStatus !== "all"
                      ? "Try adjusting your filters or search term."
                      : "Queue a task to start building execution history for this project."}
                  />
                ) : (
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 dark:bg-white/[0.03] border-b border-gray-100 dark:border-white/[0.06] sticky top-0 z-10">
                      <tr>
                        {["Type", "Target", "Status", "Started", "Duration", "Results", ""].map((h, i) => (
                          <th
                            key={h || i}
                            className={`px-5 py-3 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider ${
                              i === 6 ? "text-right" : "text-left"
                            }`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/[0.04]">
                      {filteredHistory.map((scan) => (
                        <tr key={scan.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400">{scanIcons[scan.scan_type] || <Radar className="h-4 w-4" />}</span>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{formatTypeLabel(scan.scan_type)}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-sm text-gray-600 dark:text-gray-300 font-mono">{scan.target}</span>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">{statusBadge(scan.status)}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                              <Clock className="h-3.5 w-3.5" />
                              {formatDate(scan.started_at)}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            <LiveDuration startTime={scan.started_at} status={scan.status} staticDuration={scan.duration} />
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{scan.results_count || 0}</span>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {scan.raw_status === "queued" && (
                                <Button size="sm" variant="ghost" onClick={() => cancelTask(scan.id)} title="Cancel task">
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {["completed", "failed", "cancelled"].includes(scan.raw_status) && (
                                <Button size="sm" variant="ghost" onClick={() => retryTask(scan.id)} title="Retry task">
                                  <RefreshCw className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => openTaskDetails(scan.id)} title="View task details">
                                <Activity className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
          </>
        )}
      </div>

      {showTaskDetailsModal && (
        <div className="fixed inset-0 z-[100] overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setShowTaskDetailsModal(false);
              setSelectedTaskId(null);
              setSelectedTaskDetails(null);
              setSelectedTaskEvents([]);
              setSelectedTaskArtifacts([]);
            }}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/[0.08] rounded-xl shadow-2xl dark:shadow-[0_25px_50px_rgba(0,0,0,0.5)] animate-scale-in">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary-500/10 border border-primary-500/20">
                    <Activity className="h-5 w-5 text-primary-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">Task Details</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {selectedTaskDetails?.label || "Loading task details"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowTaskDetailsModal(false);
                    setSelectedTaskId(null);
                    setSelectedTaskDetails(null);
                    setSelectedTaskEvents([]);
                    setSelectedTaskArtifacts([]);
                  }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-5 max-h-[75vh] overflow-y-auto">
                {isTaskDetailsLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Spinner size="lg" />
                  </div>
                ) : selectedTaskDetails ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-lg bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06]">
                        <p className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Type</p>
                        <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-200">
                          {formatTypeLabel(selectedTaskDetails.task_type)}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06]">
                        <p className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</p>
                        <div className="mt-2">{statusBadge(selectedTaskDetails.status)}</div>
                      </div>
                      <div className="p-4 rounded-lg bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06]">
                        <p className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Assigned Agent</p>
                        <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-200">
                          {selectedTaskDetails.assigned_agent || "Unassigned"}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-primary-500/[0.04] border border-primary-500/10">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Result Summary</p>
                      {selectedTaskDetails.last_error && (
                        <p className="mt-2 text-sm text-red-500">{selectedTaskDetails.last_error}</p>
                      )}
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        {Object.entries(selectedTaskDetails.result_summary || {}).map(([key, value]) => (
                          <div key={key} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-white dark:bg-black/20 border border-gray-200 dark:border-white/[0.06]">
                            <span className="text-gray-500 dark:text-gray-400">{formatTypeLabel(key)}</span>
                            <span className="text-gray-800 dark:text-gray-200 text-right break-all">{String(value)}</span>
                          </div>
                        ))}
                        {Object.keys(selectedTaskDetails.result_summary || {}).length === 0 && (
                          <p className="text-gray-500 dark:text-gray-400">No summary available yet.</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Artifacts</h4>
                        <Badge variant="default">{selectedTaskArtifacts.length}</Badge>
                      </div>
                      <div className="space-y-2">
                        {selectedTaskArtifacts.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400">No artifacts available.</p>
                        ) : selectedTaskArtifacts.map((artifact) => (
                          <div key={artifact.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.03]">
                            <div>
                              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{artifact.storage_key.split("/").pop()}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {formatTypeLabel(artifact.artifact_type)} · {formatDate(artifact.created_at)}
                              </p>
                            </div>
                            <a
                              href={`${import.meta.env.VITE_API_BASE_URL}/v2/projects/${selectedProject.id}/artifacts/by-id/${artifact.id}/content`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm text-primary-500 hover:text-primary-400"
                            >
                              Open
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Events</h4>
                        <Badge variant="default">{selectedTaskEvents.length}</Badge>
                      </div>
                      <div className="space-y-2">
                        {selectedTaskEvents.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400">No task events available.</p>
                        ) : selectedTaskEvents.map((event) => (
                          <div key={event.id} className="p-3 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.03]">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{formatTypeLabel(event.event_type)}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(event.created_at)}</p>
                            </div>
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{event.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Task details are unavailable.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Scans;
