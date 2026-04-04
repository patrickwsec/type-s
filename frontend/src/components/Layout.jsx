import React from 'react';
import { useParams } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import Breadcrumbs from './Breadcrumbs';
import { useSidebar } from '../contexts/useSidebar';

export const Layout = ({ children }) => {
  const { isCollapsed, sidebarProps } = useSidebar();
  const { projectId } = useParams();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1e]">
      <Sidebar />
      <main className={`
        min-h-screen transition-all duration-300 ease-in-out
        ${isCollapsed ? 'lg:ml-16' : 'lg:ml-64'}
      `}>
        <div className="px-4 sm:px-6 lg:px-8 pt-5">
          <Breadcrumbs projectName={sidebarProps.projectName} />
        </div>
        {children}
      </main>
    </div>
  );
};

export default Layout;
