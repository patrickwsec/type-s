import React from 'react';

/**
 * Custom animated checkbox with refined styling.
 * Replaces native <input type="checkbox"> with a visually rich toggle.
 */
export default function Checkbox({ checked, onChange, indeterminate = false, size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-[18px] h-[18px]',
    lg: 'w-5 h-5',
  };

  const iconSizes = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-3.5 h-3.5',
  };

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      onClick={(e) => {
        e.stopPropagation();
        onChange?.({ target: { checked: !checked } });
      }}
      className={`
        ${sizes[size]}
        relative inline-flex items-center justify-center flex-shrink-0
        rounded-[5px] border-[1.5px]
        transition-all duration-200 ease-out
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-950
        ${checked || indeterminate
          ? 'bg-primary-500 border-primary-500 shadow-[0_0_8px_rgba(139,92,246,0.3)]'
          : 'bg-white/[0.04] border-white/[0.15] hover:border-white/[0.3] hover:bg-white/[0.08]'
        }
        ${className}
      `}
    >
      {/* Check mark */}
      <svg
        className={`
          ${iconSizes[size]}
          transition-all duration-200 ease-out
          ${checked ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}
        `}
        viewBox="0 0 12 12"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2.5 6.5L5 9L9.5 3.5" />
      </svg>

      {/* Indeterminate dash */}
      {indeterminate && !checked && (
        <svg
          className={`${iconSizes[size]} opacity-100`}
          viewBox="0 0 12 12"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M3 6H9" />
        </svg>
      )}
    </button>
  );
}
