import React, { createContext, useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";

export const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProject = useCallback(async (id) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/v2/projects/${id}`,
        { method: "GET", credentials: "include" }
      );
      if (!response.ok) {
        console.error("Failed to fetch project, redirecting to projects list");
        navigate("/", { replace: true });
        return;
      }
      const data = await response.json();
      const proj = data.project || data;
      const projectObj = { id: proj.id || id, name: proj.name, description: proj.description };
      setProject(projectObj);

    } catch (error) {
      console.error("Error fetching project:", error);
      navigate("/", { replace: true });
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (!projectId) {
      navigate("/", { replace: true });
      return;
    }

    setProject(null);
    fetchProject(projectId);
  }, [projectId, navigate, fetchProject]);

  const value = {
    project,
    projectId,
    projectName: project?.name || "",
    loading,
    refetchProject: () => fetchProject(projectId),
  };

  if (loading && !project) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Loading project…
          </p>
        </div>
      </div>
    );
  }

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}
