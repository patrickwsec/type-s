import React, { useEffect, useState } from "react";
import { Home, Folder, BarChart3, ShieldCheck, Radar, ChevronLeft, ChevronRight, LogOut, User, Globe, Camera, Settings, ScanLine } from "lucide-react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import ThemeToggle from './ThemeToggle';
import { useSidebar } from '../contexts/useSidebar';

export const Sidebar = () => {
  const { isCollapsed, toggleSidebar, sidebarProps } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId: urlProjectId } = useParams();
  const [username, setUsername] = useState("");

  const {
    statuses = {},
    projectName,
    projectId: ctxProjectId,
    totalVulnerabilities = 0,
    totalFindingsCount = 0,
    newVulnCount = 0,
  } = sidebarProps;

  const activeProjectId = urlProjectId || ctxProjectId;
  const inProject = location.pathname.startsWith('/project/') && activeProjectId;

  useEffect(() => {
    const storedUsername = localStorage.getItem("username");
    if (storedUsername) setUsername(storedUsername);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Error logging out:", error);
    } finally {
      localStorage.clear();
      navigate("/login");
    }
  };

  const navigationItems = inProject
    ? [
        { name: 'Overview', icon: Home, path: `/project/${activeProjectId}`, active: location.pathname === `/project/${activeProjectId}` },
        { name: 'Assets', icon: Globe, path: `/project/${activeProjectId}/assets`, active: location.pathname === `/project/${activeProjectId}/assets` },
        { name: 'Vulnerabilities', icon: ShieldCheck, path: `/project/${activeProjectId}/vulnerabilities`, active: location.pathname === `/project/${activeProjectId}/vulnerabilities`, badge: newVulnCount > 0 ? newVulnCount : null },
        { name: 'Tasks', icon: Radar, path: `/project/${activeProjectId}/scans`, active: location.pathname === `/project/${activeProjectId}/scans` },
        { name: 'Screenshots', icon: Camera, path: `/project/${activeProjectId}/screenshots`, active: location.pathname === `/project/${activeProjectId}/screenshots` },
        { name: 'Analytics', icon: BarChart3, path: `/project/${activeProjectId}/analytics`, active: location.pathname === `/project/${activeProjectId}/analytics` },
      ]
    : [
        { name: 'Projects', icon: Folder, path: '/', active: location.pathname === '/' },
        { name: 'Settings', icon: Settings, path: '/settings', active: location.pathname === '/settings' },
      ];

  return (
    <>
      {/* Mobile overlay */}
      {!isCollapsed && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full z-50 flex flex-col
        bg-white dark:bg-[#0c1120] border-r border-gray-200 dark:border-white/[0.06]
        transition-all duration-300 ease-in-out
        ${isCollapsed ? '-translate-x-full lg:translate-x-0 lg:w-16' : 'translate-x-0 w-64'}
      `}>
        {/* Header / Brand */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/[0.06]">
          {!isCollapsed && (
            <div className="flex items-center space-x-3">
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500/20 to-primary-600/10 border border-primary-500/25 shadow-[0_0_12px_rgba(139,92,246,0.15)] flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="text-primary-400" />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" className="text-primary-300" />
                  <line x1="12" y1="2" x2="12" y2="9" stroke="currentColor" strokeWidth="1.5" className="text-primary-400/60" />
                  <line x1="12" y1="15" x2="12" y2="22" stroke="currentColor" strokeWidth="1.5" className="text-primary-400/60" />
                  <line x1="3" y1="7" x2="9" y2="12" stroke="currentColor" strokeWidth="1.5" className="text-primary-400/60" />
                  <line x1="15" y1="12" x2="21" y2="7" stroke="currentColor" strokeWidth="1.5" className="text-primary-400/60" />
                </svg>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center space-x-1">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 tracking-widest uppercase">
                    TYPE
                  </span>
                  <span className="text-lg font-bold text-gray-800 dark:text-white">[</span>
                  <span className="text-lg font-mono font-bold text-primary-400">
                    S
                  </span>
                  <span className="text-lg font-bold text-gray-800 dark:text-white">]</span>
                </div>
                <span className="text-[9px] text-gray-400 dark:text-gray-500 font-mono tracking-[0.15em] uppercase">
                  Attack Surface Mgmt
                </span>
              </div>
            </div>
          )}

          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] transition-all duration-200"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Project context indicator */}
        {inProject && !isCollapsed && (
          <div className="mx-3 mt-3">
            <button
              onClick={() => navigate('/')}
              className="w-full text-left px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:border-primary-500/20 hover:bg-white/[0.05] transition-all duration-200 group"
            >
              <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                <Folder className="h-2.5 w-2.5 text-primary-400/60" />
                Project
              </p>
              <p className="text-xs font-semibold text-gray-200 truncate group-hover:text-white transition-colors">
                {projectName || 'Loading...'}
              </p>
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <ul className="space-y-0.5">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.name}>
                  <button
                    onClick={item.onClick || (() => navigate(item.path))}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm
                      ${item.active
                        ? 'bg-primary-600/[0.12] text-white border border-primary-500/20 shadow-[0_0_12px_rgba(139,92,246,0.06)]'
                        : 'text-gray-500 hover:text-gray-200 hover:bg-white/[0.04] border border-transparent'
                      }
                    `}
                    title={isCollapsed ? item.name : ''}
                  >
                    <Icon size={16} className={`flex-shrink-0 ${item.active ? 'text-primary-400' : ''}`} />
                    {!isCollapsed && (
                      <span className="font-medium flex-1 text-left">{item.name}</span>
                    )}
                    {!isCollapsed && item.badge && (
                      <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-red-500/20 text-red-400 border border-red-500/30">
                        {item.badge}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {inProject && (
            <div className="mt-4 pt-4 border-t border-white/[0.06]">
              <button
                onClick={() => navigate('/settings')}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm
                  ${location.pathname === '/settings'
                    ? 'bg-primary-600/[0.12] text-white border border-primary-500/20'
                    : 'text-gray-500 hover:text-gray-200 hover:bg-white/[0.04] border border-transparent'
                  }
                `}
                title={isCollapsed ? 'Settings' : ''}
              >
                <Settings size={16} className="flex-shrink-0" />
                {!isCollapsed && <span className="font-medium">Settings</span>}
              </button>
            </div>
          )}
        </nav>

        {/* Bottom Section — User + Theme */}
        <div className="mt-auto p-3 border-t border-white/[0.06]">
          {!isCollapsed && username && (
            <div className="space-y-2">
              {/* User row */}
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.04] transition-colors group">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="p-1.5 rounded-lg bg-primary-500/10 border border-primary-500/20">
                    <User className="h-3.5 w-3.5 text-primary-400" />
                  </div>
                  <span className="text-xs font-medium text-gray-400 truncate">{username}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                  title="Logout"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Theme Toggle */}
              <div className="flex items-center justify-center p-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <ThemeToggle showLabels={false} className="w-full" />
              </div>
            </div>
          )}

          {isCollapsed && username && (
            <div className="flex flex-col items-center space-y-2">
              <div className="p-1.5 rounded-lg bg-primary-500/10 border border-primary-500/20" title={`Logged in as ${username}`}>
                <User className="h-4 w-4 text-primary-400" />
              </div>
              <div className="p-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <ThemeToggle showLabels={false} className="scale-75" />
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
