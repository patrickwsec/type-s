import React, { createContext, useState, useCallback } from 'react';

export const SidebarContext = createContext();

export function SidebarProvider({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sidebarProps, setSidebarPropsState] = useState({});

  const toggleSidebar = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  // Allows pages to set dynamic sidebar props (scan statuses, vuln callbacks, etc.)
  const setSidebarProps = useCallback((props) => {
    setSidebarPropsState(prev => ({ ...prev, ...props }));
  }, []);

  // Reset sidebar props (useful when navigating away from a page)
  const resetSidebarProps = useCallback(() => {
    setSidebarPropsState({});
  }, []);

  return (
    <SidebarContext.Provider value={{
      isCollapsed,
      setIsCollapsed,
      toggleSidebar,
      sidebarProps,
      setSidebarProps,
      resetSidebarProps,
    }}>
      {children}
    </SidebarContext.Provider>
  );
}
