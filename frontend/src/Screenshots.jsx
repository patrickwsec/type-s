import React, { useState, useEffect } from "react";
import { Card, Button, Input, Badge, Spinner, EmptyState } from "./components/ui";
import { useProject } from "./contexts/useProject";
import { Camera, X, Search, Download, LayoutGrid, List } from "lucide-react";

const V2_PAGE_SIZE = 500;

function Screenshots() {
  const { project: selectedProject, projectId } = useProject();
  const [screenshots, setScreenshots] = useState([]);
  const [filteredScreenshots, setFilteredScreenshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedScreenshot, setSelectedScreenshot] = useState(null);
  const [viewMode, setViewMode] = useState("grid");

  useEffect(() => {
    if (projectId) loadScreenshots(projectId);
  }, [projectId]);

  const loadScreenshots = async (pid) => {
    setLoading(true);
    try {
      await loadV2Screenshots(pid);
    } catch (err) {
      console.error("Error loading screenshots:", err);
      setScreenshots([]);
      setFilteredScreenshots([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllV2Pages = async (path) => {
    let page = 1;
    let totalPages = 1;
    const items = [];

    while (page <= totalPages) {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || ""}${path}${path.includes("?") ? "&" : "?"}page=${page}&page_size=${V2_PAGE_SIZE}`,
        { credentials: "include" }
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch ${path}`);
      }
      const data = await response.json();
      items.push(...(data.items || []));
      totalPages = data.pagination?.total_pages || 0;
      if (!totalPages) break;
      page += 1;
    }

    return items;
  };

  const loadV2Screenshots = async (pid) => {
    const [assets, artifacts] = await Promise.all([
      fetchAllV2Pages(`/v2/projects/${pid}/assets`),
      fetchAllV2Pages(`/v2/projects/${pid}/artifacts?artifact_type=screenshot`),
    ]);

    const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
    const assetsByHostname = new Map(
      assets.map((asset) => [(asset.hostname || "").toLowerCase(), asset])
    );

    const items = artifacts.map((artifact) => {
      const hostname = artifact.metadata?.hostname?.toLowerCase();
      const asset =
        assetsById.get(artifact.asset_id) ||
        assetsByHostname.get(hostname) ||
        null;
      return {
        id: artifact.id,
        domain: asset?.hostname || artifact.metadata?.hostname || "Unknown Host",
        url: asset?.primary_url || "",
        screenshot_url: `${import.meta.env.VITE_API_BASE_URL || ""}/v2/projects/${pid}/artifacts/by-id/${artifact.id}/content`,
        status_code: asset?.status_code || (asset?.primary_url ? 200 : null),
        title: asset?.title,
        webserver: asset?.webserver,
        updated_at: artifact.created_at,
      };
    });

    setScreenshots(items);
    setFilteredScreenshots(items);
  };

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredScreenshots(screenshots);
    } else {
      const q = searchTerm.toLowerCase();
      setFilteredScreenshots(
        screenshots.filter(
          (s) =>
            s.domain?.toLowerCase().includes(q) ||
            s.title?.toLowerCase().includes(q) ||
            s.url?.toLowerCase().includes(q)
        )
      );
    }
  }, [searchTerm, screenshots]);

  const downloadScreenshot = async (shot) => {
    if (!shot?.screenshot_url) {
      return;
    }

    try {
      const res = await fetch(shot.screenshot_url, { credentials: "include" });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${shot.domain.replace(/[^a-zA-Z0-9]/g, "_")}_screenshot.png`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error("Error downloading screenshot:", err);
    }
  };

  const imgSrc = (shot) => shot.screenshot_url;

  const statusColor = (code) => {
    if (code >= 200 && code < 300) return "success";
    if (code >= 300 && code < 400) return "warning";
    return "danger";
  };

  const ImgFallback = ({ className = "h-12 w-12" }) => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-white/[0.04] text-gray-400">
      <Camera className={className} />
    </div>
  );

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary-500/10 border border-primary-500/20">
              <Camera className="h-6 w-6 text-primary-400" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Screenshots</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {selectedProject?.name || "Loading…"} · {filteredScreenshots.length} screenshot{filteredScreenshots.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] rounded-lg p-1">
            {[
              { mode: "grid", icon: LayoutGrid },
              { mode: "list", icon: List },
            ].map(({ mode, icon: Icon }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === mode
                    ? "bg-white dark:bg-white/[0.1] text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-white/[0.08]"
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <Card className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by domain, title, or URL…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </Card>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Spinner size="lg" />
          </div>
        ) : filteredScreenshots.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              icon={Camera}
              title="No Screenshots Found"
              description={
                screenshots.length === 0
                  ? "Run an enumerate task with screenshots enabled to capture web page previews."
                  : "Try adjusting your search filter."
              }
            />
          </Card>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredScreenshots.map((shot, i) => (
              <Card key={shot.id || i} hover className="overflow-hidden group">
                {/* Image */}
                <div
                  className="relative w-full h-48 bg-gray-100 dark:bg-white/[0.03] cursor-pointer overflow-hidden"
                  onClick={() => setSelectedScreenshot(shot)}
                >
                  <img
                    src={imgSrc(shot)}
                    alt={`Screenshot of ${shot.domain}`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.nextSibling.style.display = "flex";
                    }}
                  />
                  <div className="hidden w-full h-full items-center justify-center bg-gray-100 dark:bg-white/[0.04] text-gray-400 absolute inset-0">
                    <Camera className="h-12 w-12" />
                  </div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all" />
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate" title={shot.domain}>
                    {shot.domain}
                  </h3>
                  {shot.title && (
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate" title={shot.title}>
                      {shot.title}
                    </p>
                  )}
                  <div className="mt-2.5 flex items-center justify-between">
                    {shot.status_code && <Badge variant={statusColor(shot.status_code)}>{shot.status_code}</Badge>}
                    <button
                      onClick={() => downloadScreenshot(shot)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors"
                      title="Download screenshot"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          /* List View */
          <Card className="overflow-hidden divide-y divide-gray-100 dark:divide-white/[0.04]">
            {filteredScreenshots.map((shot, i) => (
              <div key={shot.id || i} className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                {/* Thumbnail */}
                <div
                  className="flex-shrink-0 w-32 h-20 bg-gray-100 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-lg cursor-pointer overflow-hidden"
                  onClick={() => setSelectedScreenshot(shot)}
                >
                  <img
                    src={imgSrc(shot)}
                    alt={`Screenshot of ${shot.domain}`}
                    className="w-full h-full object-cover hover:opacity-80 transition-opacity"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{shot.domain}</h3>
                  {shot.title && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">{shot.title}</p>}
                  {shot.url && <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500 truncate font-mono">{shot.url}</p>}
                </div>

                {/* Meta */}
                <div className="flex items-center gap-3">
                  {shot.status_code && <Badge variant={statusColor(shot.status_code)}>{shot.status_code}</Badge>}
                  {shot.webserver && <span className="text-xs text-gray-500 dark:text-gray-400">{shot.webserver}</span>}
                  <button
                    onClick={() => downloadScreenshot(shot)}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors"
                    title="Download screenshot"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>

      {/* Screenshot Preview Modal */}
      {selectedScreenshot && (
        <div className="fixed inset-0 z-[100] overflow-y-auto">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedScreenshot(null)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="relative w-full max-w-5xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/[0.08] rounded-xl shadow-2xl dark:shadow-[0_25px_50px_rgba(0,0,0,0.5)] animate-scale-in overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary-500/10 border border-primary-500/20">
                    <Camera className="h-5 w-5 text-primary-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">{selectedScreenshot.domain}</h3>
                    {selectedScreenshot.title && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{selectedScreenshot.title}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => downloadScreenshot(selectedScreenshot)} title="Download">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedScreenshot(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Image */}
              <div className="p-6 overflow-auto max-h-[calc(90vh-80px)] bg-gray-50 dark:bg-gray-950">
                <img
                  src={imgSrc(selectedScreenshot)}
                  alt={`Screenshot of ${selectedScreenshot.domain}`}
                  className="w-full h-auto rounded-lg shadow-lg border border-gray-200 dark:border-white/[0.06]"
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Screenshots;
