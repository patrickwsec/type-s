import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../utils/api";

/**
 * Query key factory for findings.
 */
export const findingKeys = {
  all: (projectId) => ["findings", projectId],
  list: (projectId, params) => ["findings", projectId, "list", params],
  stats: (projectId) => ["findings", projectId, "stats"],
  hostnames: (projectId) => ["findings", projectId, "hostnames"],
  templateIds: (projectId) => ["findings", projectId, "template-ids"],
  tags: (projectId) => ["findings", projectId, "tags"],
};

/**
 * Fetch paginated, filtered, sorted findings from the server.
 */
export function useFindings(projectId, filters) {
  const params = new URLSearchParams();
  params.set("page", String(filters.page || 1));
  params.set("page_size", String(filters.page_size || 50));
  if (filters.search) params.set("search", filters.search);
  if (filters.severities?.length) params.set("severities", filters.severities.join(","));
  if (filters.triage_statuses?.length) params.set("triage_statuses", filters.triage_statuses.join(","));
  if (filters.hostname) params.set("hostname", filters.hostname);
  if (filters.template_id) params.set("template_id", filters.template_id);
  if (filters.tags?.length) params.set("tags", filters.tags.join(","));
  if (filters.sort_by) params.set("sort_by", filters.sort_by);
  if (filters.sort_order) params.set("sort_order", filters.sort_order);

  const queryString = params.toString();

  return useQuery({
    queryKey: findingKeys.list(projectId, queryString),
    queryFn: () => api.get(`/v2/projects/${projectId}/findings?${queryString}`),
    enabled: !!projectId,
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
}

/**
 * Fetch severity + triage stats (unfiltered project-wide counts).
 */
export function useFindingStats(projectId) {
  return useQuery({
    queryKey: findingKeys.stats(projectId),
    queryFn: () => api.get(`/v2/projects/${projectId}/findings/stats`),
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

/**
 * Fetch distinct hostnames for the filter dropdown.
 */
export function useFindingHostnames(projectId) {
  return useQuery({
    queryKey: findingKeys.hostnames(projectId),
    queryFn: () => api.get(`/v2/projects/${projectId}/findings/hostnames`),
    enabled: !!projectId,
    staleTime: 60_000,
  });
}

/**
 * Fetch distinct template IDs for the filter dropdown.
 */
export function useFindingTemplateIds(projectId) {
  return useQuery({
    queryKey: findingKeys.templateIds(projectId),
    queryFn: () => api.get(`/v2/projects/${projectId}/findings/template-ids`),
    enabled: !!projectId,
    staleTime: 60_000,
  });
}

/**
 * Fetch distinct tags for the filter dropdown.
 */
export function useFindingTags(projectId) {
  return useQuery({
    queryKey: findingKeys.tags(projectId),
    queryFn: () => api.get(`/v2/projects/${projectId}/findings/tags`),
    enabled: !!projectId,
    staleTime: 60_000,
  });
}

/**
 * Mutation: update triage status for a single finding.
 */
export function useUpdateTriage(projectId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ findingId, triageStatus }) =>
      api.patch(`/v2/projects/${projectId}/findings/${findingId}`, { triage_status: triageStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: findingKeys.all(projectId) });
    },
  });
}

/**
 * Mutation: bulk update triage status.
 */
export function useBulkTriage(projectId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ findingIds, triageStatus }) =>
      api.patch(`/v2/projects/${projectId}/findings/bulk-triage`, { finding_ids: findingIds, triage_status: triageStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: findingKeys.all(projectId) });
    },
  });
}
