import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Button, Badge, Spinner, EmptyState } from "./components/ui";
import { useProject } from "./contexts/useProject";
import {
  Globe,
  ShieldCheck,
  Radar,
  Camera,
  BarChart3,
  Bug,
  ArrowRight,
  Clock,
} from "lucide-react";

const EMPTY_V2_OVERVIEW = {
  asset_count: 0,
  vulnerability_count: 0,
  info_finding_count: 0,
  task_count: 0,
};

function ProjectOverview() {
  const { project, projectId, projectName } = useProject();
  const navigate = useNavigate();
  const [stats, setStats] = useState(EMPTY_V2_OVERVIEW);
  const [recentTasks, setRecentTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    const fetchOverview = async () => {
      setLoading(true);
      try {
        const overviewRes = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/v2/projects/${projectId}/overview`,
          { credentials: "include" }
        );
        if (!overviewRes.ok) {
          throw new Error("Failed to fetch v2 project overview");
        }
        const overview = await overviewRes.json();
        setStats(overview.stats || EMPTY_V2_OVERVIEW);
        setRecentTasks(overview.recent_activity || []);
      } catch (err) {
        console.error("Error fetching project overview:", err);
        setStats(EMPTY_V2_OVERVIEW);
        setRecentTasks([]);
      } finally {
        setLoading(false);
      }
    };
    fetchOverview();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  const statCards = [
    { label: "Assets", value: stats?.asset_count ?? 0, icon: Globe, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", path: "assets" },
    { label: "Vulnerabilities", value: stats?.vulnerability_count ?? 0, icon: Bug, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", path: "vulnerabilities" },
    { label: "Tasks", value: stats?.task_count ?? 0, icon: Radar, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", path: "scans" },
  ];

  const quickActions = [
    { label: "View Assets", desc: "Browse discovered subdomains, IPs, and technologies", icon: Globe, path: "assets" },
    { label: "Vulnerabilities", desc: "Review and triage discovered security issues", icon: ShieldCheck, path: "vulnerabilities" },
    { label: "Tasks", desc: "Queue agent tasks and review execution progress.", icon: Radar, path: "scans" },
    { label: "Screenshots", desc: "Visual gallery of discovered web applications", icon: Camera, path: "screenshots" },
    { label: "Analytics", desc: "Charts and insights from project data", icon: BarChart3, path: "analytics" },
  ];

  const formatTimeAgo = (d) => {
    if (!d) return "Unknown";
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  };

  const scanIcons = {
    subfinder: <Globe className="h-4 w-4" />,
    nuclei: <Bug className="h-4 w-4" />,
    httpx: <BarChart3 className="h-4 w-4" />,
    naabu: <Radar className="h-4 w-4" />,
    enumerate_scope: <Globe className="h-4 w-4" />,
    port_scan: <Radar className="h-4 w-4" />,
    service_discovery: <BarChart3 className="h-4 w-4" />,
    capture_screenshots: <Camera className="h-4 w-4" />,
    run_findings_scan: <Bug className="h-4 w-4" />,
    analyze_project: <BarChart3 className="h-4 w-4" />,
    enrich_assets: <Globe className="h-4 w-4" />,
  };

  const statusBadge = (status) => {
    const map = {
      completed: "success",
      running: "info",
      planning: "warning",
      queued: "default",
      awaiting_approval: "warning",
      cancelling: "warning",
      ingesting: "info",
      failed: "danger",
      cancelled: "default",
    };
    return <Badge variant={map[status] || "default"}>{status || "—"}</Badge>;
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {projectName || "Project Overview"}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {project?.description || "Attack surface overview and quick actions"}
          </p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {statCards.map((card) => (
            <Card
              key={card.label}
              hover
              className="cursor-pointer p-5 group"
              onClick={() => navigate(`/project/${projectId}/${card.path}`)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg border ${card.bg}`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-3xl font-semibold text-gray-900 dark:text-white">{card.value.toLocaleString()}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{card.label}</p>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <div className="lg:col-span-2">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {quickActions.map((a) => (
                <Card
                  key={a.label}
                  hover
                  className="cursor-pointer p-4 group"
                  onClick={() => navigate(`/project/${projectId}/${a.path}`)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 p-2 rounded-lg bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06]">
                      <a.icon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{a.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{a.desc}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Recent Tasks */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Recent Tasks
              </h2>
              <Button variant="ghost" size="sm" onClick={() => navigate(`/project/${projectId}/scans`)}>
                View All
              </Button>
            </div>
            <Card className="divide-y divide-gray-100 dark:divide-white/[0.04]">
              {recentTasks.length === 0 ? (
                <div className="p-8 text-center">
                  <Clock className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No tasks yet</p>
                </div>
              ) : (
                recentTasks.map((task, idx) => (
                  <div key={idx} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-gray-400 flex-shrink-0">
                        {scanIcons[task.item_type] || <Radar className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 capitalize truncate">
                          {task.item_type || "task"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {task.target || task.label || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {statusBadge(task.status)}
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatTimeAgo(task.created_at)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProjectOverview;
