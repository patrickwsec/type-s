import { useState, useEffect, useCallback } from 'react';
import { buildV2ResultsModel } from '../utils/v2Data';

const API_BASE = import.meta.env.VITE_API_BASE_URL;
const V2_PAGE_SIZE = 500;

const createEmptyStats = (assetLabel) => ({
  assetLabel,
  totalSubdomains: 0,
  totalVulnerabilities: 0,
  criticalVulns: 0,
  highVulns: 0,
  mediumVulns: 0,
  lowVulns: 0,
  infoVulns: 0,
  totalPorts: 0,
  liveHosts: 0
});

/**
 * Hook for managing project data: results, vulnerabilities, stats.
 * @param {Function} showNotification
 * @returns project data state + loaders
 */
export function useProjectData(showNotification) {
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectName, setProjectName] = useState("Loading...");
  const [results, setResults] = useState([]);
  const [vulnerabilities, setVulnerabilities] = useState([]);
  const [stats, setStats] = useState(createEmptyStats('Assets'));
  const [isLoading, setIsLoading] = useState(false);

  const fetchAllV2Pages = useCallback(async (path) => {
    let page = 1;
    let totalPages = 1;
    const items = [];

    while (page <= totalPages) {
      const response = await fetch(
        `${API_BASE}${path}${path.includes('?') ? '&' : '?'}page=${page}&page_size=${V2_PAGE_SIZE}`,
        { credentials: 'include' }
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch ${path}`);
      }

      const data = await response.json();
      items.push(...(data.items || []));
      totalPages = data.pagination?.total_pages || 0;
      if (!totalPages) {
        break;
      }
      page += 1;
    }

    return items;
  }, []);

  const loadV2ProjectData = useCallback(async (projectId) => {
    const [assets, findings, screenshotArtifacts] = await Promise.all([
      fetchAllV2Pages(`/v2/projects/${projectId}/assets`),
      fetchAllV2Pages(`/v2/projects/${projectId}/findings`),
      fetchAllV2Pages(`/v2/projects/${projectId}/artifacts?artifact_type=screenshot`),
    ]);

    const v2Data = buildV2ResultsModel({
      projectId,
      apiBase: API_BASE,
      assets,
      findings,
      screenshotArtifacts,
    });

    setResults(v2Data.results);
    setVulnerabilities(v2Data.vulnerabilities);
    setStats(v2Data.stats);
  }, [fetchAllV2Pages]);

  const loadProjectData = useCallback(async (projectId) => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      await loadV2ProjectData(projectId);
    } catch (error) {
      console.error("Error loading project data:", error);
      setResults([]);
      setVulnerabilities([]);
      setStats(createEmptyStats('Assets'));
    } finally {
      setIsLoading(false);
    }
  }, [loadV2ProjectData]);

  return {
    selectedProject, setSelectedProject,
    projectName, setProjectName,
    results, vulnerabilities, stats,
    isLoading,
    loadProjectData,
  };
}
