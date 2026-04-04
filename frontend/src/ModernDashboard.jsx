import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Button } from "./components/ui";
import { useSidebar } from "./contexts/useSidebar";
import { useProject } from "./contexts/useProject";
import VulnerabilityDetails from "./VulnerabilityDetails";

// Hooks
import { useProjectData } from "./hooks/useProjectData";
import { useResultsTable } from "./hooks/useResultsTable";
import { useBulkOperations } from "./hooks/useBulkOperations";
import { useNucleiConfig } from "./hooks/useNucleiConfig";

// Utilities
import { expandCIDR } from "./utils/cidr";

import useToast from "./contexts/useToast";
// Components
import StatsBar from "./components/Dashboard/StatsBar";
import SearchActionsBar from "./components/Dashboard/SearchActionsBar";
import FilterPanel from "./components/Dashboard/FilterPanel";
import ResultsTable from "./components/Dashboard/ResultsTable";
import SubfinderModal from "./components/Dashboard/SubfinderModal";
import ManualTargetsModal from "./components/Dashboard/ManualTargetsModal";
import CustomScanModal from "./components/Dashboard/CustomScanModal";
import VulnDetailModal from "./components/Dashboard/VulnDetailModal";
import BulkActionsModal from "./components/Dashboard/BulkActionsModal";
import ScreenshotModal from "./components/Dashboard/ScreenshotModal";
import ScanSelectedModal from "./components/Dashboard/ScanSelectedModal";
import NucleiConfigModal from "./components/Dashboard/NucleiConfigModal";
import NetworkScanModal from "./components/Dashboard/NetworkScanModal";
import AssetDetailDrawer from "./components/Dashboard/AssetDetailDrawer";

import { Globe, Plus, Wifi } from "lucide-react";

const DEFAULT_CUSTOM_ACTION = "enumerate_scope";
const DEFAULT_SELECTED_ACTION = "run_findings_scan";

function ModernDashboard() {
  const navigate = useNavigate();
  const { setSidebarProps } = useSidebar();
  const { project: contextProject, projectId, projectName: ctxProjectName } = useProject();

  // ─── Core hooks ────────────────────────────────────────────────
  const showNotification = useToast();

  const {
    selectedProject, setSelectedProject,
    projectName, setProjectName,
    results, vulnerabilities, stats,
    isLoading, loadProjectData,
  } = useProjectData(showNotification);

  const {
    showNucleiConfig, setShowNucleiConfig,
    nucleiConfig, setNucleiConfig,
    templateCategories,
    validateNucleiConfig, loadNucleiTemplates,
  } = useNucleiConfig(showNotification);

  const {
    searchTerm, setSearchTerm,
    filters, setFilters, showFilters, setShowFilters,
    sortField, sortDirection, handleSort, clearFilters,
    visibleColumns, showColumnControls, setShowColumnControls,
    toggleColumn, resetColumns, showAllColumns,
    compactView, setCompactView,
    currentPage, setCurrentPage, itemsPerPage, setItemsPerPage,
    totalPages, startIndex, endIndex,
    paginatedResults, filteredResults, goToPage,
  } = useResultsTable(results);

  const {
    selectedItems, setSelectedItems,
    showBulkActions, setShowBulkActions,
    bulkActionType, setBulkActionType,
    bulkTagValue, setBulkTagValue,
    toggleItemSelection, selectAllItems, selectAllOnCurrentPage,
    selectAllOnAllPages, clearSelection,
    exportSelectedResults, handleBulkAction,
  } = useBulkOperations({
    filteredResults, paginatedResults,
    selectedProject, loadProjectData, showNotification,
  });

  // ─── Local UI state (modal toggles, vuln details view) ────────
  const [showVulnerabilityDetails, setShowVulnerabilityDetails] = useState(false);
  const [selectedHost, setSelectedHost] = useState(null);
  const [showVulnDetails, setShowVulnDetails] = useState(false);
  const [selectedVulnerability, setSelectedVulnerability] = useState(null);
  const [screenshotModal, setScreenshotModal] = useState({ isOpen: false, url: null, domain: null });

  // Subfinder modal
  const [showSubfinderModal, setShowSubfinderModal] = useState(false);
  const [subfinderDomain, setSubfinderDomain] = useState('');

  // Manual targets modal
  const [showManualTargets, setShowManualTargets] = useState(false);
  const [manualTargets, setManualTargets] = useState([{ hostname: '', ip: '' }]);

  // Custom scan modal
  const [showCustomScanModal, setShowCustomScanModal] = useState(false);
  const [customScanTarget, setCustomScanTarget] = useState('');
  const [customScanType, setCustomScanType] = useState(DEFAULT_CUSTOM_ACTION);
  const [customScanError, setCustomScanError] = useState('');

  // Scan selected modal
  const [showScanSelectedModal, setShowScanSelectedModal] = useState(false);
  const [selectedScanType, setSelectedScanType] = useState(DEFAULT_SELECTED_ACTION);

  // Network scan modal
  const [showNetworkScanModal, setShowNetworkScanModal] = useState(false);

  // Port scan config (used in ScanSelectedModal)
  const [portScanConfig, setPortScanConfig] = useState({
    topPorts: 100,
    customPorts: '',
    useCustomPorts: false,
    scanType: 'sT',
    timing: 4,
    versionScan: false,
    defaultScripts: false,
  });

  const [selectedAsset, setSelectedAsset] = useState(null);

  // New vulnerability badge
  const [newVulnCount, setNewVulnCount] = useState(0);
  const [lastViewedVulnCount, setLastViewedVulnCount] = useState(() => {
    const stored = localStorage.getItem('lastViewedVulnCount');
    return stored ? parseInt(stored, 10) : 0;
  });

  // ─── Derived: vulnerability helpers ───────────────────────────
  const getVulnerabilitiesForHost = useCallback((host) => {
    return vulnerabilities.filter(vuln => {
      if (vuln.host === host) return true;
      if (vuln.host && vuln.host.toLowerCase() === host.toLowerCase()) return true;
      if (vuln.host && vuln.host.includes(host)) return true;
      if (vuln.host && host.includes(vuln.host)) return true;
      return false;
    });
  }, [vulnerabilities]);

  const handleHostClick = useCallback((host) => {
    let hostVulns = getVulnerabilitiesForHost(host);
    if (hostVulns.length === 0) {
      const result = results.find(r => r.domain === host);
      if (result?.vulnerabilities) hostVulns = result.vulnerabilities;
    }
    if (hostVulns.length > 0) {
      setSelectedHost(host);
      setShowVulnerabilityDetails(true);
    }
  }, [getVulnerabilitiesForHost, results]);

  const openVulnerabilityDetails = useCallback((vulnerability) => {
    setSelectedVulnerability(vulnerability);
    setShowVulnDetails(true);
  }, []);

  const buildFindingsTaskInput = useCallback((overrides = {}) => {
    const requestedInput = {
      use_primary_url: true,
      run_all_templates: !nucleiConfig.isCustom && nucleiConfig.category === 'comprehensive',
      rate_limit: nucleiConfig.rateLimit,
      timeout: nucleiConfig.timeout,
      retries: nucleiConfig.retries ?? 1,
      ...overrides,
    };

    if (Array.isArray(nucleiConfig.ports) && nucleiConfig.ports.length > 0) {
      requestedInput.ports = nucleiConfig.ports;
    }
    if (Array.isArray(nucleiConfig.customSeverity) && nucleiConfig.customSeverity.length > 0) {
      requestedInput.severity = nucleiConfig.customSeverity;
    }
    if (Array.isArray(nucleiConfig.excludeTags) && nucleiConfig.excludeTags.length > 0) {
      requestedInput.exclude_tags = nucleiConfig.excludeTags;
    }
    if (Array.isArray(nucleiConfig.excludeSeverity) && nucleiConfig.excludeSeverity.length > 0) {
      requestedInput.exclude_severity = nucleiConfig.excludeSeverity;
    }

    if (nucleiConfig.isCustom) {
      if (Array.isArray(nucleiConfig.customTemplates) && nucleiConfig.customTemplates.length > 0) {
        requestedInput.templates = nucleiConfig.customTemplates;
      } else if (Array.isArray(nucleiConfig.customTags) && nucleiConfig.customTags.length > 0) {
        requestedInput.tags = nucleiConfig.customTags;
      }
    } else if (!requestedInput.run_all_templates) {
      const category = templateCategories.template_categories?.[nucleiConfig.category];
      if (Array.isArray(category?.tags) && category.tags.length > 0) {
        requestedInput.tags = category.tags;
      }
    }

    return requestedInput;
  }, [nucleiConfig, templateCategories]);

  // Poll a task until it reaches a terminal state, then refresh asset data.
  const pollTaskCompletion = useCallback((taskId, taskLabel, projectId) => {
    const TERMINAL = new Set(['completed', 'failed', 'cancelled']);
    const POLL_MS = 4000;
    const MAX_POLLS = 150; // 10 minutes max
    let polls = 0;

    const poll = async () => {
      if (polls++ >= MAX_POLLS) return;
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/v2/tasks/${taskId}`,
          { credentials: 'include' }
        );
        if (!res.ok) return;
        const task = await res.json();
        if (TERMINAL.has(task?.status)) {
          if (task.status === 'completed') {
            showNotification(`"${taskLabel}" finished — refreshing assets...`, 'success');
          } else {
            showNotification(`"${taskLabel}" ${task.status}.`, 'error');
          }
          await loadProjectData(projectId);
          return;
        }
      } catch (_) { /* silently ignore network errors during polling */ }
      setTimeout(poll, POLL_MS);
    };

    setTimeout(poll, POLL_MS);
  }, [showNotification, loadProjectData]);

  const queueTask = useCallback(async (payload, successMessage) => {
    if (!selectedProject?.id) {
      throw new Error('No project selected.');
    }

    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/v2/projects/${selectedProject.id}/tasks`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      }
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const detail = errorData.detail;
      const message = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map(e => e.msg || JSON.stringify(e)).join('; ')
          : `HTTP error! status: ${response.status}`;
      throw new Error(message);
    }

    const data = await response.json();
    showNotification(successMessage || `${data.task.label} queued for agent pickup.`, 'success');
    // Start background polling so assets auto-refresh when the task finishes
    pollTaskCompletion(data.task.id, data.task.label, selectedProject.id);
    return data.task;
  }, [selectedProject, showNotification, pollTaskCompletion]);

  const queueDiscoveryTask = useCallback(async (scopeValue) => {
    const normalizedScope = (scopeValue || '').trim().toLowerCase();
    if (!normalizedScope) {
      throw new Error('Please enter a root domain.');
    }

    return queueTask(
      {
        task_type: 'enumerate_scope',
        approval_mode: 'auto',
        requested_input: {
          scope_type: 'domain',
          scope_value: normalizedScope,
          include_http_enrichment: true,
          include_screenshots: false,
        },
      },
      `Queued discovery task for ${normalizedScope}.`
    );
  }, [queueTask]);

  const queueFindingsTask = useCallback(async ({ hostnames = [], assetIds = [] }) => {
    const normalizedHostnames = hostnames
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean);
    const normalizedAssetIds = assetIds
      .map((value) => String(value || '').trim())
      .filter(Boolean);

    if (normalizedHostnames.length === 0 && normalizedAssetIds.length === 0) {
      throw new Error('Select at least one hostname or asset.');
    }

    return queueTask(
      {
        task_type: 'run_findings_scan',
        approval_mode: 'auto',
        requested_input: buildFindingsTaskInput({
          hostnames: normalizedHostnames,
          asset_ids: normalizedAssetIds,
        }),
      },
      `Queued findings task for ${normalizedAssetIds.length || normalizedHostnames.length} target(s).`
    );
  }, [buildFindingsTaskInput, queueTask]);

  const queuePortScan = useCallback(async (portScanInput) => {
    return queueTask(
      {
        task_type: 'port_scan',
        approval_mode: 'auto',
        requested_input: portScanInput,
      },
      `Queued port scan for ${portScanInput.targets?.join(', ') || 'targets'}.`
    );
  }, [queueTask]);

  const queueServiceDiscovery = useCallback(async ({ hostnames = [], assetIds = [], includeScreenshots = false }) => {
    const normalizedHostnames = hostnames
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean);
    const normalizedAssetIds = assetIds
      .map((value) => String(value || '').trim())
      .filter(Boolean);

    if (normalizedHostnames.length === 0 && normalizedAssetIds.length === 0) {
      throw new Error('Select at least one hostname or asset.');
    }

    const label = includeScreenshots ? 'screenshot capture' : 'service discovery';
    return queueTask(
      {
        task_type: 'service_discovery',
        approval_mode: 'auto',
        requested_input: {
          hostnames: normalizedHostnames,
          asset_ids: normalizedAssetIds,
          include_screenshots: includeScreenshots,
        },
      },
      `Queued ${label} for ${normalizedAssetIds.length || normalizedHostnames.length} target(s).`
    );
  }, [queueTask]);

  // ─── Custom scan runner ───────────────────────────────────────
  const runCustomScan = useCallback(async () => {
    setCustomScanError('');
    const target = (customScanTarget || '').trim();
    if (!selectedProject?.id) {
      setCustomScanError('No project selected.');
      return;
    }
    if (!target) {
      setCustomScanError('Please enter a target.');
      return;
    }
    try {
      if (customScanType === 'enumerate_scope') {
        await queueDiscoveryTask(target);
      } else if (customScanType === 'run_findings_scan') {
        await queueFindingsTask({ hostnames: [target] });
      } else if (customScanType === 'port_scan') {
        await queuePortScan({ targets: [target] });
      } else if (customScanType === 'service_discovery') {
        await queueServiceDiscovery({ hostnames: [target] });
      } else {
        throw new Error('Unsupported task type.');
      }

      setShowCustomScanModal(false);
      setCustomScanTarget('');
      setCustomScanType(DEFAULT_CUSTOM_ACTION);
    } catch (error) {
      setCustomScanError(error?.message || 'Failed to start scan');
      showNotification(`Failed to queue task: ${error?.message || ''}`, 'error');
    }
  }, [customScanTarget, customScanType, selectedProject, showNotification, queueDiscoveryTask, queueFindingsTask]);

  // ─── Manual targets handler ───────────────────────────────────
  const addManualTargets = useCallback(async (targets) => {
    if (!selectedProject?.id) { showNotification("No project selected", "error"); return; }
    const validTargets = targets.filter(t => t.hostname.trim() || t.ip.trim());
    if (validTargets.length === 0) { showNotification("Please provide at least one hostname or IP", "error"); return; }

    const expandedTargets = [];
    for (const target of validTargets) {
      const hostname = target.hostname.trim();
      const ipInput = target.ip.trim();
      if (ipInput && ipInput.includes('/')) {
        try {
          const expandedIPs = expandCIDR(ipInput);
          showNotification(`Expanding subnet ${ipInput} into ${expandedIPs.length} IPs...`, 'info');
          for (const ip of expandedIPs) expandedTargets.push({ domain: hostname || ip, ip_address: ip });
        } catch (error) { showNotification(`Error: ${error.message}`, 'error'); return; }
      } else {
        expandedTargets.push({ domain: hostname || ipInput, ip_address: ipInput || null });
      }
    }

    if (expandedTargets.length > 50 && !window.confirm(`This will add ${expandedTargets.length} targets. Continue?`)) return;

    try {
      showNotification(`Saving ${expandedTargets.length} manual asset(s)...`, 'info');
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/v2/projects/${selectedProject.id}/assets/import`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            items: expandedTargets.map((target) => ({
              hostname: target.domain,
              ip_address: target.ip_address,
            })),
          }),
        }
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to import assets');
      }

      const data = await response.json();
      showNotification(`Saved ${data.updated_count} manual asset(s).`, 'success');
      await loadProjectData(selectedProject.id);
      setShowManualTargets(false);
      setManualTargets([{ hostname: '', ip: '' }]);
    } catch (error) {
      showNotification(`Failed to import assets: ${error.message}`, 'error');
    }
  }, [selectedProject, showNotification, loadProjectData]);

  // ─── Vulnerability badge tracking ────────────────────────────
  useEffect(() => {
    setNewVulnCount(Math.max(0, stats.totalVulnerabilities - lastViewedVulnCount));
  }, [stats.totalVulnerabilities, lastViewedVulnCount]);

  const handleViewVulnerabilities = useCallback(() => {
    setLastViewedVulnCount(stats.totalVulnerabilities);
    localStorage.setItem('lastViewedVulnCount', stats.totalVulnerabilities.toString());
    setNewVulnCount(0);
    setShowVulnerabilityDetails(true);
  }, [stats.totalVulnerabilities]);

  // ─── Sidebar sync ────────────────────────────────────────────
  useEffect(() => {
    setSidebarProps({
      statuses: {},
      projectName,
      projectId: selectedProject?.id,
      onViewVulnerabilities: handleViewVulnerabilities,
      totalVulnerabilities: stats.totalVulnerabilities,
      totalFindingsCount: stats.totalVulnerabilities + stats.infoVulns,
      newVulnCount,
    });
  }, [setSidebarProps, projectName, selectedProject?.id, handleViewVulnerabilities, stats.totalVulnerabilities, stats.infoVulns, newVulnCount]);

  // ─── Bootstrap on mount ──────────────────────────────────────
  useEffect(() => {
    if (contextProject && projectId) {
      setSelectedProject(contextProject);
      setProjectName(ctxProjectName || contextProject.name || "Unknown Project");
      loadProjectData(projectId);
    }

    loadNucleiTemplates();
  }, [
    contextProject,
    projectId,
    ctxProjectName,
    setSelectedProject,
    setProjectName,
    loadProjectData,
    loadNucleiTemplates,
  ]);

  // ─── Scan-selected handler ────────────────────────────────────
  const handleStartScanSelected = useCallback(() => {
    const selectedResults = filteredResults.filter(r => selectedItems.has(r.id));
    const targets = selectedResults.map(r => r.domain || r.url).filter(Boolean);
    if (targets.length === 0) { showNotification('No valid targets', 'error'); return; }
    const assetIds = selectedResults.map((result) => result.id).filter(Boolean);

    let taskPromise;
    if (selectedScanType === 'port_scan') {
      const portsPayload = portScanConfig.useCustomPorts && portScanConfig.customPorts.trim()
        ? portScanConfig.customPorts.split(',').map(s => s.trim()).filter(Boolean)
        : undefined;
      taskPromise = queuePortScan({
        targets,
        ports: portsPayload,
        top_ports: portScanConfig.useCustomPorts ? undefined : portScanConfig.topPorts,
        scan_type: portScanConfig.scanType,
        timing: portScanConfig.timing,
        version_scan: portScanConfig.versionScan,
        default_scripts: portScanConfig.defaultScripts,
        create_assets: true,
      });
    } else if (selectedScanType === 'service_discovery') {
      taskPromise = queueServiceDiscovery({
        assetIds,
        hostnames: assetIds.length === 0 ? targets : [],
      });
    } else if (selectedScanType === 'capture_screenshots') {
      taskPromise = queueServiceDiscovery({
        assetIds,
        hostnames: assetIds.length === 0 ? targets : [],
        includeScreenshots: true,
      });
    } else {
      taskPromise = queueFindingsTask({
        assetIds,
        hostnames: assetIds.length === 0 ? targets : [],
      });
    }

    taskPromise
      .then(() => {
        setShowScanSelectedModal(false);
        setSelectedScanType(DEFAULT_SELECTED_ACTION);
        clearSelection();
      })
      .catch((error) => {
        showNotification(`Failed to queue task: ${error.message}`, 'error');
      });
  }, [filteredResults, selectedItems, selectedScanType, portScanConfig, clearSelection, showNotification, queueFindingsTask, queuePortScan, queueServiceDiscovery]);

  // ─── Vulnerability details full-page view ─────────────────────
  if (showVulnerabilityDetails && selectedHost) {
    return (
      <VulnerabilityDetails
        host={selectedHost}
        vulnerabilities={getVulnerabilitiesForHost(selectedHost).length > 0
          ? getVulnerabilitiesForHost(selectedHost)
          : results.find(r => r.domain === selectedHost)?.vulnerabilities || []}
        onBack={() => { setShowVulnerabilityDetails(false); setSelectedHost(null); }}
      />
    );
  }

  // ─── Main render ─────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Stats Bar */}
      <StatsBar stats={stats} />

      {/* Empty-project CTA */}
      {stats.totalSubdomains === 0 && (
        <div className="mb-6">
          <div className="p-10 rounded-xl border border-white/[0.06] bg-white/[0.02]" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}>
            <div className="text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center mb-4">
                <Globe className="h-7 w-7 text-primary-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-200 mb-2">
                Ready to Build This Project?
              </h3>
              <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
                Queue discovery tasks to enumerate assets, or add known hosts and IPs directly so the agent can process them.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => setShowSubfinderModal(true)}
                  className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-5 py-2.5 rounded-lg transition-all shadow-sm hover:shadow-[0_4px_12px_rgba(139,92,246,0.25)] text-sm font-medium">
                  <Globe className="w-4 h-4" /><span>Queue Discovery Task</span>
                </Button>
                <Button onClick={() => setShowNetworkScanModal(true)}
                  className="flex items-center justify-center gap-2 bg-blue-600/90 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg transition-all shadow-sm hover:shadow-[0_4px_12px_rgba(59,130,246,0.25)] text-sm font-medium">
                  <Wifi className="w-4 h-4" /><span>Network Discovery</span>
                </Button>
                <Button onClick={() => setShowManualTargets(true)}
                  className="flex items-center justify-center gap-2 bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 border border-white/[0.08] hover:border-white/[0.15] px-5 py-2.5 rounded-lg transition-all text-sm font-medium">
                  <Plus className="w-4 h-4" /><span>Import Manual Assets</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search & Actions */}
      <SearchActionsBar
        searchTerm={searchTerm} setSearchTerm={setSearchTerm}
        showFilters={showFilters} setShowFilters={setShowFilters}
        filters={filters}
        filteredResults={filteredResults}
        onExport={exportSelectedResults}
        onOpenCustomScan={() => setShowCustomScanModal(true)}
        onOpenNetworkScan={() => setShowNetworkScanModal(true)}
        onOpenManualTargets={() => setShowManualTargets(true)}
        showNotification={showNotification}
        actionLabel="Queue Task"
      />

      {/* Filter Panel */}
      <FilterPanel show={showFilters} filters={filters} setFilters={setFilters} onClear={clearFilters} />

      {/* Results Table */}
      <ResultsTable
        selectedProject={selectedProject} navigate={navigate}
        filteredResults={filteredResults} paginatedResults={paginatedResults} isLoading={isLoading}
        visibleColumns={visibleColumns} showColumnControls={showColumnControls}
        setShowColumnControls={setShowColumnControls}
        toggleColumn={toggleColumn} resetColumns={resetColumns} showAllColumns={showAllColumns}
        compactView={compactView} setCompactView={setCompactView}
        selectedItems={selectedItems} toggleItemSelection={toggleItemSelection}
        selectAllItems={selectAllItems} selectAllOnAllPages={selectAllOnAllPages}
        clearSelection={clearSelection} setSelectedItems={setSelectedItems}
        setShowScanSelectedModal={setShowScanSelectedModal} setShowBulkActions={setShowBulkActions}
        sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}
        currentPage={currentPage} totalPages={totalPages} startIndex={startIndex} endIndex={endIndex}
        itemsPerPage={itemsPerPage} setItemsPerPage={setItemsPerPage}
        setCurrentPage={setCurrentPage} goToPage={goToPage}
        setScreenshotModal={setScreenshotModal}
        getVulnerabilitiesForHost={getVulnerabilitiesForHost}
        handleHostClick={handleHostClick}
        openVulnerabilityDetails={openVulnerabilityDetails}
        loadProjectData={loadProjectData}
        onAssetClick={setSelectedAsset}
        selectionActionLabel="Queue"
      />

      {/* ─── Modals ──────────────────────────────────────────── */}
      <SubfinderModal
        show={showSubfinderModal}
        domain={subfinderDomain} setDomain={setSubfinderDomain}
        title="Queue Discovery Task"
        description="Enter a root domain to queue an agent discovery task."
        submitLabel="Queue Task"
        onStart={async () => {
          try {
            await queueDiscoveryTask(subfinderDomain.trim());
            setShowSubfinderModal(false);
            setSubfinderDomain('');
          } catch (error) {
            showNotification(`Failed to queue task: ${error.message}`, 'error');
          }
        }}
        onClose={() => setShowSubfinderModal(false)}
      />

      <ManualTargetsModal
        show={showManualTargets}
        targets={manualTargets} setTargets={setManualTargets}
        title="Import Manual Assets"
        description="Add known hostnames and IPs directly to the project so agent tasks can work from stored assets."
        submitLabel="Import"
        onAdd={() => addManualTargets(manualTargets)}
        onClose={() => setShowManualTargets(false)}
      />

      <CustomScanModal
        show={showCustomScanModal}
        target={customScanTarget} setTarget={setCustomScanTarget}
        scanType={customScanType} setScanType={setCustomScanType}
        error={customScanError}
        title="Queue Agent Task"
        targetLabel="Root Domain or Hostname"
        targetPlaceholder="example.com or app.example.com"
        scanOptions={[
          { key: 'enumerate_scope', label: 'Enumerate Scope' },
          { key: 'port_scan', label: 'Port Scan' },
          { key: 'service_discovery', label: 'Service Discovery' },
          { key: 'run_findings_scan', label: 'Findings Scan' },
        ]}
        submitLabel="Queue Task"
        onRun={runCustomScan}
        onClose={() => {
          setShowCustomScanModal(false);
          setCustomScanError('');
          setCustomScanType(DEFAULT_CUSTOM_ACTION);
        }}
      />

      <VulnDetailModal
        show={showVulnDetails}
        vulnerability={selectedVulnerability}
        onClose={() => { setShowVulnDetails(false); setSelectedVulnerability(null); }}
      />

      <BulkActionsModal
        show={showBulkActions}
        selectedCount={selectedItems.size}
        actionType={bulkActionType} setActionType={setBulkActionType}
        tagValue={bulkTagValue} setTagValue={setBulkTagValue}
        onExecute={handleBulkAction}
        onClose={() => { setShowBulkActions(false); setBulkActionType(''); setBulkTagValue(''); }}
      />

      <ScreenshotModal
        show={screenshotModal.isOpen}
        url={screenshotModal.url}
        domain={screenshotModal.domain}
        onClose={() => setScreenshotModal({ isOpen: false, url: null, domain: null })}
      />

      <ScanSelectedModal
        show={showScanSelectedModal}
        onClose={() => { setShowScanSelectedModal(false); setSelectedScanType(DEFAULT_SELECTED_ACTION); }}
        selectedItems={selectedItems} filteredResults={filteredResults}
        scanType={selectedScanType} setScanType={setSelectedScanType}
        nucleiConfig={nucleiConfig}
        templateCategories={templateCategories}
        onOpenNucleiConfig={() => setShowNucleiConfig(true)}
        portScanConfig={portScanConfig}
        setPortScanConfig={setPortScanConfig}
        onStartScan={handleStartScanSelected}
      />

      <NucleiConfigModal
        show={showNucleiConfig} onClose={() => setShowNucleiConfig(false)}
        config={nucleiConfig} setConfig={setNucleiConfig}
        templateCategories={templateCategories}
        validateConfig={validateNucleiConfig}
      />

      <NetworkScanModal
        show={showNetworkScanModal}
        onClose={() => setShowNetworkScanModal(false)}
        onQueuePortScan={async (input) => {
          await queuePortScan(input);
          showNotification('Port scan queued. Refresh the assets table in a moment to see discovered hosts.', 'success');
        }}
      />

      {/* Asset Detail Drawer */}
      {selectedAsset && (
        <AssetDetailDrawer
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
        />
      )}
    </div>
  );
}

export default ModernDashboard;
