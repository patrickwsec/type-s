import React from "react";

// ─── Card ────────────────────────────────────────────────────
export const Card = ({ children, className = "", hover = false, glass = false, ...props }) => {
  const base = [
    "bg-white dark:bg-gray-900/60",
    "border border-gray-200 dark:border-white/[0.06]",
    "rounded-xl",
    "shadow-sm dark:shadow-none",
  ].join(" ");

  const hoverCls = hover
    ? "hover:border-primary-500/20 hover:shadow-lg dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-all duration-300"
    : "";

  const glassCls = glass
    ? "backdrop-blur-xl bg-white/60 dark:bg-gray-900/40"
    : "";

  return (
    <div
      className={`${base} ${hoverCls} ${glassCls} ${className}`}
      style={glass ? {} : { boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}
      {...props}
    >
      {children}
    </div>
  );
};

// ─── Button ──────────────────────────────────────────────────
export const Button = ({
  children,
  variant = "primary",
  size = "md",
  className = "",
  disabled = false,
  loading = false,
  ...props
}) => {
  const base =
    "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-gray-950";

  const variants = {
    primary:
      "bg-primary-600 hover:bg-primary-500 text-white focus:ring-primary-500/50 shadow-sm hover:shadow-[0_4px_12px_rgba(139,92,246,0.25)]",
    secondary:
      "bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 hover:text-white border border-white/[0.08] hover:border-white/[0.15] focus:ring-white/20",
    outline:
      "border border-gray-300 dark:border-white/[0.1] hover:bg-white/[0.05] text-gray-700 dark:text-gray-300 hover:text-white focus:ring-primary-500/30",
    danger:
      "bg-red-600/90 hover:bg-red-500 text-white focus:ring-red-500/50 shadow-sm",
    ghost:
      "bg-transparent hover:bg-white/[0.06] text-gray-400 hover:text-gray-200 focus:ring-white/10",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-6 py-2.5 text-base gap-2",
  };

  const disabledCls =
    disabled || loading ? "opacity-40 cursor-not-allowed pointer-events-none" : "";

  return (
    <button
      className={`${base} ${variants[variant] || variants.primary} ${sizes[size]} ${disabledCls} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-0.5 mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  );
};

// ─── Input ───────────────────────────────────────────────────
export const Input = ({ className = "", error = false, ...props }) => {
  const base = [
    "block w-full px-3 py-2",
    "bg-gray-50 dark:bg-white/[0.04]",
    "border border-gray-300 dark:border-white/[0.08]",
    "rounded-lg text-sm",
    "text-gray-900 dark:text-gray-100",
    "placeholder-gray-400 dark:placeholder-gray-500",
    "focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/50",
    "transition-all duration-200",
  ].join(" ");

  const errorCls = error
    ? "border-red-400 dark:border-red-500/50 focus:ring-red-500/30 focus:border-red-500/50"
    : "";

  return <input className={`${base} ${errorCls} ${className}`} {...props} />;
};

// ─── Badge ───────────────────────────────────────────────────
export const Badge = ({ children, className = "", variant = "default" }) => {
  const base = "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium tracking-wide";

  const variants = {
    default: "bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/[0.06]",
    success: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    danger: "bg-red-500/10 text-red-400 border border-red-500/20",
    info: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    primary: "bg-primary-500/10 text-primary-400 border border-primary-500/20",
  };

  return (
    <span className={`${base} ${variants[variant] || ""} ${className}`}>
      {children}
    </span>
  );
};

// ─── Spinner ─────────────────────────────────────────────────
export const Spinner = ({ size = "md", className = "" }) => {
  const sizes = {
    sm: "h-4 w-4 border-[1.5px]",
    md: "h-6 w-6 border-2",
    lg: "h-10 w-10 border-2",
  };

  return (
    <div
      className={`animate-spin rounded-full border-gray-700 border-t-primary-500 ${sizes[size]} ${className}`}
    />
  );
};

// ─── Skeleton ────────────────────────────────────────────────
export const Skeleton = ({ className = "", variant = "text", rows = 1 }) => {
  const base =
    "bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-white/[0.04] dark:via-white/[0.08] dark:to-white/[0.04] bg-[length:200%_100%] animate-shimmer rounded";

  const variants = {
    text: "h-4 w-full rounded",
    title: "h-6 w-3/4 rounded",
    avatar: "h-10 w-10 rounded-full",
    card: "h-32 w-full rounded-xl",
    thumbnail: "h-24 w-24 rounded-lg",
    button: "h-9 w-24 rounded-lg",
    table: "h-12 w-full rounded-lg",
  };

  if (rows > 1) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className={`${base} ${variants[variant]} ${className}`}
            style={variant === "text" ? { width: `${85 + Math.random() * 15}%` } : undefined}
          />
        ))}
      </div>
    );
  }

  return <div className={`${base} ${variants[variant]} ${className}`} />;
};

// ─── Table ───────────────────────────────────────────────────
export const Table = ({ children, className = "" }) => (
  <div className={`overflow-x-auto rounded-xl border border-gray-200 dark:border-white/[0.06] ${className}`}>
    <table className="w-full text-sm text-left">{children}</table>
  </div>
);

Table.Head = ({ children, className = "" }) => (
  <thead
    className={`bg-gray-50 dark:bg-white/[0.03] border-b border-gray-200 dark:border-white/[0.06] ${className}`}
  >
    {children}
  </thead>
);

Table.HeadCell = ({ children, className = "", sortable = false, sorted = null, onClick, ...props }) => (
  <th
    className={`px-4 py-3 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider ${
      sortable ? "cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" : ""
    } ${className}`}
    onClick={sortable ? onClick : undefined}
    {...props}
  >
    <span className="flex items-center gap-1">
      {children}
      {sortable && sorted !== null && (
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={sorted === "asc" ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
        </svg>
      )}
    </span>
  </th>
);

Table.Body = ({ children, className = "" }) => (
  <tbody className={`divide-y divide-gray-100 dark:divide-white/[0.04] ${className}`}>{children}</tbody>
);

Table.Row = ({ children, className = "", hover = true, selected = false, ...props }) => (
  <tr
    className={`transition-colors ${
      hover ? "hover:bg-gray-50 dark:hover:bg-white/[0.03]" : ""
    } ${selected ? "bg-primary-500/[0.06] dark:bg-primary-500/[0.08]" : ""} ${className}`}
    {...props}
  >
    {children}
  </tr>
);

Table.Cell = ({ children, className = "", ...props }) => (
  <td className={`px-4 py-3 text-sm text-gray-700 dark:text-gray-300 ${className}`} {...props}>
    {children}
  </td>
);

// ─── Modal ───────────────────────────────────────────────────
export const Modal = ({ open, onClose, children, size = "md", className = "" }) => {
  if (!open) return null;

  const sizes = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-6xl",
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={`relative w-full ${sizes[size]} bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/[0.08] rounded-xl shadow-2xl dark:shadow-[0_25px_50px_rgba(0,0,0,0.5)] animate-scale-in ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

Modal.Header = ({ children, onClose, className = "" }) => (
  <div className={`flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/[0.06] ${className}`}>
    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{children}</h3>
    {onClose && (
      <button
        onClick={onClose}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    )}
  </div>
);

Modal.Body = ({ children, className = "" }) => (
  <div className={`px-6 py-5 ${className}`}>{children}</div>
);

Modal.Footer = ({ children, className = "" }) => (
  <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-white/[0.06] ${className}`}>
    {children}
  </div>
);

// ─── Tabs ────────────────────────────────────────────────────
export const Tabs = ({ tabs, activeTab, onChange, className = "" }) => (
  <div className={`flex border-b border-gray-200 dark:border-white/[0.06] ${className}`}>
    {tabs.map((tab) => {
      const isActive = activeTab === tab.id;
      return (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`relative px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
            isActive
              ? "text-primary-600 dark:text-primary-400"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          }`}
        >
          <span className="flex items-center gap-2">
            {tab.icon && <tab.icon className="h-4 w-4" />}
            {tab.label}
            {tab.badge != null && (
              <span className={`ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-md ${
                isActive
                  ? "bg-primary-500/15 text-primary-400"
                  : "bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-gray-400"
              }`}>
                {tab.badge}
              </span>
            )}
          </span>
          {isActive && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-full" />
          )}
        </button>
      );
    })}
  </div>
);

// ─── Toast ───────────────────────────────────────────────────
export const Toast = ({ message, type = "info", onClose, className = "" }) => {
  const icons = {
    success: (
      <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    warning: (
      <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    info: (
      <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  const colors = {
    success: "border-emerald-500/30 bg-emerald-500/[0.08]",
    error: "border-red-500/30 bg-red-500/[0.08]",
    warning: "border-amber-500/30 bg-amber-500/[0.08]",
    info: "border-blue-500/30 bg-blue-500/[0.08]",
  };

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm animate-slide-up ${colors[type]} ${className}`}
    >
      {icons[type]}
      <span className="text-sm text-gray-200 flex-1">{message}</span>
      {onClose && (
        <button onClick={onClose} className="text-gray-400 hover:text-gray-200 transition-colors">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};

// ─── Select ──────────────────────────────────────────────────
export const Select = ({ options = [], value, onChange, placeholder = "Select…", className = "", error = false, ...props }) => {
  const base = [
    "block w-full px-3 py-2",
    "bg-gray-50 dark:bg-gray-800",
    "border border-gray-300 dark:border-white/[0.08]",
    "rounded-lg text-sm",
    "text-gray-900 dark:text-gray-100",
    "focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/50",
    "transition-all duration-200",
    "appearance-none cursor-pointer",
  ].join(" ");

  const errorCls = error
    ? "border-red-400 dark:border-red-500/50 focus:ring-red-500/30 focus:border-red-500/50"
    : "";

  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  return (
    <div className="relative">
      <select
        className={`${base} ${errorCls} ${className}`}
        value={value}
        onChange={onChange}
        style={isDark ? { colorScheme: "dark" } : undefined}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            {opt.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
};

// ─── Tooltip ─────────────────────────────────────────────────
export const Tooltip = ({ children, content, position = "top", className = "" }) => {
  const [show, setShow] = React.useState(false);

  const positions = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && content && (
        <div
          className={`absolute z-[200] px-2.5 py-1.5 text-xs font-medium text-white bg-gray-800 dark:bg-gray-700 rounded-lg shadow-lg whitespace-nowrap animate-fade-in pointer-events-none ${positions[position]} ${className}`}
        >
          {content}
        </div>
      )}
    </div>
  );
};

// ─── EmptyState ──────────────────────────────────────────────
export const EmptyState = ({ icon: Icon, title, description, action, className = "" }) => (
  <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
    {Icon && (
      <div className="p-4 rounded-2xl bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] mb-5">
        <Icon className="h-8 w-8 text-gray-400 dark:text-gray-500" />
      </div>
    )}
    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-1.5">{title}</h3>
    {description && <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6">{description}</p>}
    {action}
  </div>
);

// ─── ErrorBoundaryFallback ───────────────────────────────────
export const ErrorFallback = ({ error, onRetry, className = "" }) => (
  <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
    <div className="p-4 rounded-2xl bg-red-500/[0.08] border border-red-500/20 mb-5">
      <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    </div>
    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Something went wrong</h3>
    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6">
      {error?.message || "An unexpected error occurred. Please try again."}
    </p>
    {onRetry && (
      <Button variant="secondary" onClick={onRetry}>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Try Again
      </Button>
    )}
  </div>
);
