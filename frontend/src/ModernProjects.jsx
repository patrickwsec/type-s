import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input, Spinner } from "./components/ui";
import useToast from "./contexts/useToast";
import {
  Plus,
  FolderOpen,
  Trash2,
  Calendar,
  Clock,
  Shield,
  Search,
  Server,
  Bug,
  ListChecks,
  ArrowRight,
  X,
  Layers,
} from "lucide-react";

function ModernProjects() {
  const navigate = useNavigate();
  const showToast = useToast();
  
  const [projects, setProjects] = useState([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/v2/projects`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to fetch projects.");
      }

      const data = await response.json();
      const projectsWithStats = await Promise.all(
        (data.items || []).map(async (project) => {
          try {
            const overviewResponse = await fetch(
              `${import.meta.env.VITE_API_BASE_URL}/v2/projects/${project.id}/overview`,
              {
                method: "GET",
                credentials: "include",
              }
            );

            if (overviewResponse.ok) {
              const overviewData = await overviewResponse.json();
              return {
                ...project,
                subdomain_count: overviewData.stats?.asset_count || 0,
                vulnerability_count: overviewData.stats?.vulnerability_count || 0,
                scan_count: overviewData.stats?.task_count || 0,
              };
            }

            return {
              ...project,
              subdomain_count: 0,
              vulnerability_count: 0,
              scan_count: 0,
            };
          } catch (err) {
            console.error(`Error fetching stats for project ${project.id}:`, err);
            return {
              ...project,
              subdomain_count: 0,
              vulnerability_count: 0,
              scan_count: 0,
            };
          }
        })
      );

      setProjects(projectsWithStats);
    } catch (err) {
      console.error("Error fetching projects:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProjectSelect = (project) => {
    navigate(`/project/${project.id}`);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      showToast("Project name cannot be empty.", "error");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/v2/projects`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            name: newProjectName,
            description: newProjectDescription,
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to create project.");
      }

      const data = await response.json();
      const createdProject = data;
      if (createdProject?.id) {
        setProjects((prev) => [
          {
            ...createdProject,
            subdomain_count: 0,
            vulnerability_count: 0,
            scan_count: 0,
          },
          ...prev,
        ]);
      } else {
        await fetchProjects();
      }
      setNewProjectName("");
      setNewProjectDescription("");
      setShowCreateForm(false);
      setError(null);
    } catch (err) {
      console.error("Error creating project:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!confirm("Are you sure you want to delete this project?")) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/v2/projects/${projectId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (response.ok) {
        setProjects(projects.filter(p => p.id !== projectId));
      }
    } catch (err) {
      console.error("Error deleting project:", err.message);
      setError(err.message);
    }
  };

  const filteredProjects = projects.filter(project =>
    project.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const totalAssets = projects.reduce((sum, p) => sum + (p.subdomain_count || 0), 0);
  const totalVulns = projects.reduce((sum, p) => sum + (p.vulnerability_count || 0), 0);
  const totalTasks = projects.reduce((sum, p) => sum + (p.scan_count || 0), 0);

  if (loading && projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary-500/15 to-primary-600/5 border border-primary-500/20">
              <Layers className="h-5 w-5 text-primary-400" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Projects</h1>
          </div>
          <p className="text-sm text-gray-500 ml-[52px]">
            {projects.length} project{projects.length !== 1 ? 's' : ''} &middot; {totalAssets} assets &middot; {totalVulns} vulnerabilities
          </p>
        </div>
        <Button
          onClick={() => setShowCreateForm(!showCreateForm)}
          variant="primary"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg shadow-primary-500/10 hover:shadow-primary-500/20 transition-shadow"
        >
          <Plus className="h-4 w-4" />
          <span>New Project</span>
        </Button>
      </div>

      {/* Summary Stats Bar */}
      {projects.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Assets', value: totalAssets, icon: Server, color: 'text-blue-400', bg: 'from-blue-500/10 to-blue-600/5', border: 'border-blue-500/15' },
            { label: 'Vulnerabilities', value: totalVulns, icon: Bug, color: 'text-amber-400', bg: 'from-amber-500/10 to-amber-600/5', border: 'border-amber-500/15' },
            { label: 'Total Tasks', value: totalTasks, icon: ListChecks, color: 'text-emerald-400', bg: 'from-emerald-500/10 to-emerald-600/5', border: 'border-emerald-500/15' },
          ].map((stat) => (
            <div key={stat.label} className={`relative overflow-hidden rounded-xl border ${stat.border} bg-gradient-to-br ${stat.bg} p-4`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-1">{stat.label}</p>
                  <p className={`text-2xl font-bold tabular-nums ${stat.color}`}>{stat.value.toLocaleString()}</p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color} opacity-20`} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search Bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <Input
          type="text"
          placeholder="Search projects..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 pr-8 bg-white/[0.03] border-white/[0.08] text-gray-300 placeholder-gray-600 rounded-xl text-sm focus:border-primary-500/40 focus:ring-1 focus:ring-primary-500/20 h-10"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Create Project Form */}
      {showCreateForm && (
        <div className="rounded-2xl border border-primary-500/20 bg-gradient-to-br from-primary-500/[0.04] to-transparent p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary-400" />
              New Project
            </h3>
            <button onClick={() => setShowCreateForm(false)} className="p-1 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/[0.05]">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Project Name</label>
              <Input
                type="text"
                placeholder="e.g. Client Pentest Q4"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="bg-white/[0.04] border-white/[0.08] text-gray-300 placeholder-gray-600 rounded-xl text-sm focus:border-primary-500/40 focus:ring-1 focus:ring-primary-500/20"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Description</label>
              <Input
                type="text"
                placeholder="Optional description..."
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                className="bg-white/[0.04] border-white/[0.08] text-gray-300 placeholder-gray-600 rounded-xl text-sm focus:border-primary-500/40 focus:ring-1 focus:ring-primary-500/20"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleCreateProject} 
              disabled={loading || !newProjectName.trim()}
              variant="primary"
              className="px-5 rounded-xl"
            >
              {loading ? <Spinner size="sm" /> : "Create"}
            </Button>
            <Button 
              variant="secondary" 
              onClick={() => setShowCreateForm(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/[0.06] border border-red-500/15">
          <Shield className="h-4 w-4 text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-400">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto p-1 rounded-lg text-red-400/60 hover:text-red-400">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01]">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500/10 to-primary-600/5 border border-primary-500/15 flex items-center justify-center mb-5">
            <FolderOpen className="h-8 w-8 text-primary-400/60" />
          </div>
          <h3 className="text-lg font-semibold text-gray-300 mb-2">
            {searchTerm ? 'No Results' : 'No Projects Yet'}
          </h3>
          <p className="text-sm text-gray-500 mb-6 max-w-xs text-center">
            {searchTerm ? 'Try a different search term.' : 'Create your first project to begin scanning and discovering vulnerabilities.'}
          </p>
          {!searchTerm && (
            <Button 
              onClick={() => setShowCreateForm(true)}
              variant="primary"
              className="inline-flex items-center gap-2 rounded-xl px-5"
            >
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <div 
              key={project.id} 
              className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-primary-500/25 transition-all duration-300 cursor-pointer overflow-hidden"
              onClick={() => handleProjectSelect(project)}
            >
              {/* Hover glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              
              <div className="relative p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/15 to-primary-600/5 border border-primary-500/20 flex items-center justify-center group-hover:border-primary-500/30 group-hover:shadow-[0_0_15px_rgba(139,92,246,0.08)] transition-all duration-300">
                      <FolderOpen className="h-[18px] w-[18px] text-primary-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-semibold text-gray-200 group-hover:text-white transition-colors truncate">
                        {project.name}
                      </h3>
                      {project.description ? (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{project.description}</p>
                      ) : (
                        <p className="text-xs text-gray-600 mt-0.5 italic">No description</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(project.id);
                    }}
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10"
                    title="Delete project"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Stats Row */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-1.5">
                    <Server className="h-3.5 w-3.5 text-blue-400/70" />
                    <span className="text-sm font-medium text-gray-300 tabular-nums">{project.subdomain_count || 0}</span>
                    <span className="text-xs text-gray-600">assets</span>
                  </div>
                  <div className="w-px h-3 bg-white/[0.06]" />
                  <div className="flex items-center gap-1.5">
                    <Bug className="h-3.5 w-3.5 text-amber-400/70" />
                    <span className="text-sm font-medium text-gray-300 tabular-nums">{project.vulnerability_count || 0}</span>
                    <span className="text-xs text-gray-600">vulns</span>
                  </div>
                  <div className="w-px h-3 bg-white/[0.06]" />
                  <div className="flex items-center gap-1.5">
                    <ListChecks className="h-3.5 w-3.5 text-emerald-400/70" />
                    <span className="text-sm font-medium text-gray-300 tabular-nums">{project.scan_count || 0}</span>
                    <span className="text-xs text-gray-600">tasks</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-white/[0.04]">
                  <div className="flex items-center gap-3 text-[11px] text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(project.created_at)}</span>
                    </div>
                    {project.last_scan && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(project.last_scan)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-primary-400 font-medium opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-1 group-hover:translate-x-0">
                    Open
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ModernProjects;
