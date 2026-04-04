import React from 'react';
import { Button, Card } from '../ui';
import { Filter } from 'lucide-react';

/**
 * Collapsible advanced filter panel with 5 filter dropdowns.
 */
export default function FilterPanel({ show, filters, setFilters, onClear }) {
  if (!show) return null;

  const filterFields = [
    {
      key: 'status', label: 'Status',
      options: [
        { value: 'all', label: 'All Status' },
        { value: 'live', label: 'Live Only' },
        { value: 'dead', label: 'Dead Only' },
      ]
    },
    {
      key: 'vulnerability', label: 'Vulnerabilities',
      options: [
        { value: 'all', label: 'All' },
        { value: 'has_vulns', label: 'Has Vulnerabilities' },
        { value: 'no_vulns', label: 'No Vulnerabilities' },
        { value: 'critical', label: 'Critical Only' },
        { value: 'high', label: 'High+ Only' },
      ]
    },
    {
      key: 'technology', label: 'Technology',
      options: [
        { value: 'all', label: 'All' },
        { value: 'has_tech', label: 'Has Technology' },
        { value: 'no_tech', label: 'No Technology' },
      ]
    },
    {
      key: 'cdn', label: 'CDN',
      options: [
        { value: 'all', label: 'All' },
        { value: 'has_cdn', label: 'Has CDN' },
        { value: 'no_cdn', label: 'No CDN' },
      ]
    },
    {
      key: 'ports', label: 'Ports',
      options: [
        { value: 'all', label: 'All' },
        { value: 'has_ports', label: 'Has Ports' },
        { value: 'no_ports', label: 'No Ports' },
        { value: 'common_ports', label: 'Common Ports Only' },
      ]
    },
  ];

  return (
    <div
      className="mb-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 animate-fade-in"
      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-300">
          <Filter className="h-4 w-4 text-primary-400" />
          Filters
        </h3>
        <Button variant="ghost" size="sm" onClick={onClear} className="text-xs text-gray-500 hover:text-gray-300">
          Clear All
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
        {filterFields.map(({ key, label, options }) => (
          <div key={key}>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-gray-500">
              {label}
            </label>
            <select
              value={filters[key]}
              onChange={(e) => setFilters(prev => ({ ...prev, [key]: e.target.value }))}
              className="w-full cursor-pointer appearance-none rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-gray-200 transition-all duration-200 focus:border-primary-500/40 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            >
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
