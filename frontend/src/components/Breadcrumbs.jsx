import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ChevronRight } from "lucide-react";

const routeLabels = {
  assets: "Assets",
  vulnerabilities: "Vulnerabilities",
  scans: "Tasks",
  screenshots: "Screenshots",
  analytics: "Analytics",
  settings: "Settings",
};

export default function Breadcrumbs({ projectName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { projectId } = useParams();

  const parts = location.pathname.split("/").filter(Boolean);
  // e.g. ["project", "abc123", "assets"]

  const crumbs = [];

  // Always show home (projects)
  crumbs.push({
    label: "Projects",
    path: "/",
  });

  if (projectId && parts[0] === "project") {
    // Project crumb
    crumbs.push({
      label: projectName || "Project",
      path: `/project/${projectId}`,
    });

    // Sub-page crumb
    const subPage = parts[2];
    if (subPage && routeLabels[subPage]) {
      crumbs.push({
        label: routeLabels[subPage],
        path: `/project/${projectId}/${subPage}`,
      });
    }
  } else if (parts[0] === "settings") {
    crumbs.push({ label: "Settings", path: "/settings" });
  }

  return (
    <nav className="flex items-center gap-1.5 text-xs mb-4 overflow-x-auto">
      {crumbs.map((crumb, idx) => {
        const isLast = idx === crumbs.length - 1;
        return (
          <React.Fragment key={crumb.path}>
            {idx > 0 && (
              <ChevronRight className="h-3 w-3 text-gray-600 flex-shrink-0" />
            )}
            {isLast ? (
              <span className="text-gray-200 font-semibold truncate max-w-[200px]">
                {crumb.label}
              </span>
            ) : (
              <button
                onClick={() => navigate(crumb.path)}
                className="text-gray-500 hover:text-gray-300 transition-colors truncate max-w-[200px]"
              >
                {crumb.label}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
