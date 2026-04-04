import React, { createContext, useCallback, useState } from "react";
import NotificationToasts from "../components/Dashboard/NotificationToasts";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  const showToast = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    setNotifications((current) => [...current, { id, message, type }]);
    setTimeout(() => {
      setNotifications((current) => current.filter((n) => n.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id) => {
    setNotifications((current) => current.filter((n) => n.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <NotificationToasts notifications={notifications} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export default ToastContext;
