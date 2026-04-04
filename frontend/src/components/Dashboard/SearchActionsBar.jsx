import React from 'react';
import { Button, Input } from '../ui';
import { Search, Filter, Download, Play, Wifi, Plus } from 'lucide-react';

/**
 * Modern search + action bar with glass styling.
 */
export default function SearchActionsBar({
  searchTerm, setSearchTerm,
  showFilters, setShowFilters,
  filters,
  filteredResults,
  onExport,
  onOpenCustomScan,
  onOpenNetworkScan,
  onOpenManualTargets,
  showNotification,
  actionLabel = "Scan Target",
}) {
  const activeFilterCount = Object.values(filters).filter(f => f !== 'all').length;

  return (
    <div className="mb-5 flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
      {/* Search */}
      <div className="relative flex-1 max-w-lg w-full">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <Input
          type="text"
          placeholder="Search domains, IPs, technologies..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 text-sm bg-white/[0.03] border-white/[0.06] rounded-lg focus:ring-primary-500/30 focus:border-primary-500/40"
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm" variant="secondary"
          onClick={() => setShowFilters(!showFilters)}
          className={`gap-1.5 ${
            showFilters || activeFilterCount > 0
              ? '!bg-primary-600/15 !text-primary-300 !border-primary-500/30'
              : ''
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="bg-primary-500 text-white text-[10px] font-bold rounded-full px-1.5 py-px ml-0.5">
              {activeFilterCount}
            </span>
          )}
        </Button>

        <Button
          size="sm" variant="secondary"
          onClick={() => {
            if (filteredResults.length === 0) {
              showNotification('No data to export', 'error');
              return;
            }
            onExport(filteredResults);
          }}
          className="gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export</span>
        </Button>

        <div className="h-5 w-px bg-white/[0.08] hidden sm:block" />

        {onOpenManualTargets && (
          <Button
            size="sm" variant="secondary"
            onClick={onOpenManualTargets}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Assets</span>
          </Button>
        )}

        {onOpenNetworkScan && (
          <Button
            size="sm" variant="secondary"
            onClick={onOpenNetworkScan}
            className="gap-1.5"
          >
            <Wifi className="h-3.5 w-3.5" />
            <span>Network Scan</span>
          </Button>
        )}

        <Button
          size="sm" variant="primary"
          onClick={onOpenCustomScan}
          className="gap-1.5"
        >
          <Play className="h-3.5 w-3.5" />
          <span>{actionLabel}</span>
        </Button>
      </div>
    </div>
  );
}
