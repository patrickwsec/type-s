/**
 * React Query hooks for project-level data.
 *
 * These wrap the most common API calls with caching, deduplication,
 * background re-fetches, and stale-while-revalidate semantics.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../utils/api";
import { buildV2ResultsModel } from "../utils/v2Data";

const V2_PAGE_SIZE = 500;

// ─── Query key factories ──────────────────────────────────────
export const queryKeys = {
  projects: {
    all: ["projects"],
    detail: (id) => ["projects", id],
    stats: (id) => ["projects", id, "stats"],
    results: (id) => ["projects", id, "results"],
    graphData: (id, type) => ["projects", id, "graphs", type],
    v2Data: (id) => ["projects", id, "v2-data"],
    scans: (id) => ["projects", id, "scans"],
    screenshots: (id) => ["projects", id, "screenshots"],
  },
  nuclei: {
    templates: ["nuclei", "templates"],
  },
};

async function fetchAllPaginated(path) {
  let page = 1;
  let totalPages = 1;
  const items = [];

  while (page <= totalPages) {
    const data = await api.get(
      `${path}${path.includes("?") ? "&" : "?"}page=${page}&page_size=${V2_PAGE_SIZE}`
    );
    items.push(...(data.items || []));
    totalPages = data.pagination?.total_pages || 0;
    if (!totalPages) {
      break;
    }
    page += 1;
  }

  return items;
}

async function fetchV2ProjectData(projectId) {
  const [assets, findings, screenshotArtifacts] = await Promise.all([
    fetchAllPaginated(`/v2/projects/${projectId}/assets`),
    fetchAllPaginated(`/v2/projects/${projectId}/findings`),
    fetchAllPaginated(`/v2/projects/${projectId}/artifacts?artifact_type=screenshot`),
  ]);

  return buildV2ResultsModel({
    projectId,
    apiBase: import.meta.env.VITE_API_BASE_URL,
    assets,
    findings,
    screenshotArtifacts,
  });
}

// ─── Projects list ────────────────────────────────────────────
export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects.all,
    queryFn: async () => {
      const data = await api.get("/v2/projects");
      return {
        projects: data.items || [],
        total: data.total ?? (data.items || []).length,
      };
    },
  });
}

export function useProjectStats(projectId) {
  return useQuery({
    queryKey: queryKeys.projects.stats(projectId),
    queryFn: async () => {
      const data = await api.get(`/v2/projects/${projectId}/overview`);
      return {
        subdomain_count: data.stats.asset_count,
        vulnerability_count: data.stats.vulnerability_count,
        scan_count: data.stats.task_count,
        info_finding_count: data.stats.info_finding_count,
      };
    },
    enabled: !!projectId,
  });
}

// ─── Mutations ────────────────────────────────────────────────
export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post("/v2/projects", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.projects.all }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId) => api.del(`/v2/projects/${projectId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.projects.all }),
  });
}

// ─── Project results (assets + embedded vulns) ────────────────
export function useProjectResults(projectId, pageSize = 10_000) {
  return useQuery({
    queryKey: queryKeys.projects.results(projectId),
    queryFn: async () => fetchV2ProjectData(projectId),
    enabled: !!projectId,
    staleTime: 60_000,
  });
}

// ─── Graph data ───────────────────────────────────────────────
export function useGraphData(projectId, graphType) {
  return useQuery({
    queryKey: queryKeys.projects.graphData(projectId, graphType),
    queryFn: async () => {
      const data = await api.get(
        `/v2/projects/${projectId}/graph-data?graph_type=${graphType}`
      );
      return data.data;
    },
    enabled: !!projectId && !!graphType,
    staleTime: 60_000,
  });
}

/**
 * Convenience hook that fetches all six graph types in parallel
 * via individual useQuery calls (React Query deduplicates).
 */
export function useAllGraphData(projectId) {
  const severity = useGraphData(projectId, "severity_summary");
  const technology = useGraphData(projectId, "technology_summary");
  const waf = useGraphData(projectId, "waf_detection");
  const ports = useGraphData(projectId, "ports_summary");
  const anomalies = useGraphData(projectId, "anomalies");
  const vulnDist = useGraphData(projectId, "vulnerability_distribution");

  const isLoading =
    severity.isLoading ||
    technology.isLoading ||
    waf.isLoading ||
    ports.isLoading ||
    anomalies.isLoading ||
    vulnDist.isLoading;

  return {
    isLoading,
    severity: severity.data ?? null,
    technology: technology.data ?? null,
    waf: waf.data ?? null,
    ports: ports.data ?? null,
    anomalies: anomalies.data ?? null,
    vulnerabilities: vulnDist.data ?? null,
  };
}

// ─── Nuclei templates ─────────────────────────────────────────
export function useNucleiTemplates() {
  return useQuery({
    queryKey: queryKeys.nuclei.templates,
    queryFn: () => api.get("/nuclei/templates"),
    staleTime: 5 * 60_000, // templates rarely change
  });
}
