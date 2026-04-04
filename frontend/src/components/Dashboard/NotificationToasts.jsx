import React from 'react';
import { Check, X, AlertTriangle } from 'lucide-react';

/**
 * Fixed-position toast notification stack.
 */
export default function NotificationToasts({ notifications, onDismiss }) {
  if (!notifications || notifications.length === 0) return null;
  
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`px-4 py-3 rounded-lg border backdrop-blur-md transition-all duration-300 animate-slide-in-right ${
            notification.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : notification.type === 'error'
              ? 'bg-red-500/10 border-red-500/20 text-red-300'
              : 'bg-primary-500/10 border-primary-500/20 text-primary-300'
          }`}
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
        >
          <div className="flex items-center gap-2.5">
            <div className={`p-1 rounded-md ${
              notification.type === 'success'
                ? 'bg-emerald-500/20'
                : notification.type === 'error'
                ? 'bg-red-500/20'
                : 'bg-primary-500/20'
            }`}>
              {notification.type === 'success' ? (
                <Check className="h-3.5 w-3.5" />
              ) : notification.type === 'error' ? (
                <X className="h-3.5 w-3.5" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
            </div>
            <span className="text-sm font-medium flex-1">{notification.message}</span>
            <button
              onClick={() => onDismiss(notification.id)}
              className="text-gray-500 hover:text-gray-300 p-0.5 rounded hover:bg-white/[0.06] transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
