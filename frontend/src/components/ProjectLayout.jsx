import React from "react";
import { Outlet } from "react-router-dom";
import { ProjectProvider } from "../contexts/ProjectContext";
import ErrorBoundary from "./ErrorBoundary";

/**
 * Wraps all /project/:projectId/* routes.
 * Provides ProjectContext, catches render errors, and renders the matched child route via <Outlet />.
 */
export default function ProjectLayout() {
  return (
    <ProjectProvider>
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
    </ProjectProvider>
  );
}
