import React from 'react';
import { Button, Card, Badge, Spinner } from '../ui';
import Checkbox from '../ui/Checkbox';
import { getSeverityColor, summarizeVulnerabilities } from '../../utils/severity';
import {
  Globe, Server, Check, Camera, FileText,
  Activity, List, Bug, Shield, Tag,
  X, Radar, RefreshCw, Eye, FolderOpen
} from 'lucide-react';

/**
 * Modern results table with refined dark theme styling.
 */
export default function ResultsTable({
  selectedProject, navigate,
  filteredResults, paginatedResults, isLoading,
  visibleColumns, showColumnControls, setShowColumnControls,
  toggleColumn, resetColumns, showAllColumns,
  compactView, setCompactView,
  selectedItems, toggleItemSelection, selectAllItems, selectAllOnAllPages,
  clearSelection, setSelectedItems,
  setShowScanSelectedModal, setShowBulkActions,
  sortField, sortDirection, handleSort,
  currentPage, totalPages, startIndex, endIndex,
  itemsPerPage, setItemsPerPage, setCurrentPage, goToPage,
  setScreenshotModal,
  getVulnerabilitiesForHost, handleHostClick, openVulnerabilityDetails,
  loadProjectData,
  onAssetClick,
  selectionActionLabel = "Scan",
}) {
  const resolveScreenshotSrc = (result) => {
    if (!result.screenshot_url) {
      return null;
    }
    return result.screenshot_url;
  };

  if (!selectedProject) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] mb-4">
          <FolderOpen className="h-12 w-12 text-gray-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-200 mb-2">No Project Selected</h3>
        <p className="text-gray-500 text-sm mb-5">Select a project to view scan results.</p>
        <Button onClick={() => navigate("/")} variant="primary">Go to Projects</Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}>
      {/* Toolbar */}
      <div className="px-4 py-3 bg-white/[0.02] border-b border-white/[0.06]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-200">{filteredResults.length} <span className="text-gray-500 font-normal">results</span></span>
            {selectedItems.size > 0 && (
              <div className="flex items-center gap-2 pl-3 border-l border-white/[0.08]">
                <span className="text-xs text-primary-400 font-medium">{selectedItems.size} selected</span>
                <Button size="sm" variant="primary" onClick={() => setShowScanSelectedModal(true)} className="gap-1 text-xs">
                  <Radar className="h-3 w-3" /> {selectionActionLabel}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setShowBulkActions(true)} className="gap-1 text-xs">
                  <List className="h-3 w-3" /> Actions
                </Button>
                <button onClick={clearSelection} className="text-gray-500 hover:text-gray-300 p-1 rounded-lg hover:bg-white/[0.06] transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {isLoading && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mr-2">
                <Spinner size="sm" /> Loading...
              </div>
            )}
            <Button size="sm" variant="ghost" onClick={() => setShowColumnControls(!showColumnControls)} className="gap-1 text-xs px-2">
              <List className="h-3.5 w-3.5" /> Columns
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCompactView(!compactView)}
              className={`gap-1 text-xs px-2 ${compactView ? '!text-primary-400 !bg-primary-500/10' : ''}`}>
              <Eye className="h-3.5 w-3.5" /> Compact
            </Button>
            <Button size="sm" variant="ghost" onClick={() => loadProjectData(selectedProject.id)}
              className="text-xs px-2" disabled={isLoading}>
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Column Controls */}
      {showColumnControls && (
        <div className="px-5 py-4 bg-white/[0.02] border-b border-white/[0.06] animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Column Visibility</h4>
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={resetColumns} className="text-xs">Reset</Button>
              <Button size="sm" variant="ghost" onClick={showAllColumns} className="text-xs">Show All</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {Object.entries(visibleColumns).map(([column, isVisible]) => (
              <label key={column} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/[0.04] cursor-pointer transition-colors">
                <Checkbox checked={isVisible} onChange={() => toggleColumn(column)} size="sm" />
                <span className="text-sm text-gray-400 capitalize">
                  {column === 'ip' ? 'IP Address' : column === 'select' ? 'Select' : column === 'cdn' ? 'CDN' : column}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Select-all banners */}
      {selectedItems.size > 0 && selectedItems.size === paginatedResults.length && selectedItems.size < filteredResults.length && (
        <div className="bg-primary-500/[0.06] border-b border-primary-500/10 px-5 py-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">All {paginatedResults.length} on this page selected.</span>
            <button onClick={selectAllOnAllPages} className="text-primary-400 hover:text-primary-300 font-medium underline underline-offset-2">
              Select all {filteredResults.length} items
            </button>
          </div>
        </div>
      )}
      {selectedItems.size > 0 && selectedItems.size === filteredResults.length && filteredResults.length > paginatedResults.length && (
        <div className="bg-primary-500/[0.06] border-b border-primary-500/10 px-5 py-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">All {filteredResults.length} items selected.</span>
            <button onClick={clearSelection} className="text-primary-400 hover:text-primary-300 font-medium underline underline-offset-2">Clear selection</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
        <table className="min-w-full">
          <thead className="bg-white/[0.02] sticky top-0 z-10 border-b border-white/[0.06]">
            <tr>
              {visibleColumns.select && (
                <th className="px-4 py-3 text-left">
                  <Checkbox
                    checked={paginatedResults.length > 0 && paginatedResults.every(r => selectedItems.has(r.id))}
                    indeterminate={selectedItems.size > 0 && !paginatedResults.every(r => selectedItems.has(r.id))}
                    onChange={(e) => {
                      if (e.target.checked) { selectAllItems(); }
                      else {
                        const newSel = new Set(selectedItems);
                        paginatedResults.forEach(r => newSel.delete(r.id));
                        setSelectedItems(newSel);
                      }
                    }} />
                </th>
              )}
              {[
                { key: 'domain', icon: Globe, label: 'Domain', sortable: true },
                { key: 'ip', icon: Server, label: 'IP Address', sortable: true },
                { key: 'status', icon: Check, label: 'Status', sortable: true },
                { key: 'screenshot', icon: Camera, label: 'Preview', sortable: false },
                { key: 'title', icon: FileText, label: 'Title', sortable: true },
                { key: 'technology', icon: Activity, label: 'Technology', sortable: true },
                { key: 'ports', icon: List, label: 'Ports', sortable: true },
                { key: 'vulnerabilities', icon: Bug, label: 'Vulns', sortable: true },
                { key: 'cdn', icon: Shield, label: 'CDN', sortable: true },
                { key: 'tags', icon: Tag, label: 'Tags', sortable: false },
              ].map(({ key, icon: Icon, label, sortable }) => (
                visibleColumns[key] && (
                  <th key={key}
                    className={`px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider ${sortable ? 'cursor-pointer hover:text-gray-300 transition-colors' : ''}`}
                    onClick={sortable ? () => handleSort(key) : undefined}>
                    <div className="flex items-center gap-1.5">
                      <span>{label}</span>
                      {sortable && sortField === key && (
                        <span className="text-primary-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                )
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {paginatedResults.length === 0 ? (
              <tr>
                <td colSpan={Object.values(visibleColumns).filter(Boolean).length} className="px-6 py-20 text-center">
                  <div className="flex flex-col items-center">
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] mb-4">
                      <Globe className="h-10 w-10 text-gray-600" />
                    </div>
                    <p className="text-base font-semibold text-gray-300 mb-1">No results found</p>
                    <p className="text-gray-500 text-sm">Use discovery tools to find targets</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedResults.map((result, index) => (
                <tr key={index} className="hover:bg-white/[0.02] transition-colors duration-150 group">
                  {visibleColumns.select && (
                    <td className={`px-4 ${compactView ? 'py-2' : 'py-3'} whitespace-nowrap`}>
                      <Checkbox checked={selectedItems.has(result.id)}
                        onChange={() => toggleItemSelection(result.id)} />
                    </td>
                  )}
                  {visibleColumns.domain && (
                    <td className={`px-4 ${compactView ? 'py-2' : 'py-3'} whitespace-nowrap`}>
                      {(() => {
                        const hostVulns = getVulnerabilitiesForHost(result.domain);
                        const hasVulns = hostVulns.length > 0 || (result.vulnerabilities && result.vulnerabilities.length > 0);
                        const vulnCount = hostVulns.length || (result.vulnerabilities ? result.vulnerabilities.length : 0);
                        return (
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-mono cursor-pointer hover:text-primary-400 transition-colors ${hasVulns ? 'text-gray-200' : 'text-gray-300'}`}
                              onClick={() => onAssetClick ? onAssetClick(result) : (hasVulns && handleHostClick(result.domain))}
                              title={onAssetClick ? 'Click to view asset details' : hasVulns ? `View ${vulnCount} vulnerabilities` : ''}>
                              {result.domain || 'N/A'}
                            </span>
                            {hasVulns && (
                              <span
                                className="text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 px-1.5 py-0.5 rounded-md font-mono font-bold cursor-pointer hover:bg-red-500/20 transition-colors"
                                onClick={(e) => { e.stopPropagation(); handleHostClick(result.domain); }}
                                title={`View ${vulnCount} vulnerabilities`}>
                                {vulnCount}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                  )}
                  {visibleColumns.ip && (
                    <td className={`px-4 ${compactView ? 'py-2' : 'py-3'} whitespace-nowrap`}>
                      <span className="text-sm text-gray-500 font-mono">{result.ip_address || 'N/A'}</span>
                    </td>
                  )}
                  {visibleColumns.status && (
                    <td className={`px-4 ${compactView ? 'py-2' : 'py-3'} whitespace-nowrap`}>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium font-mono border ${
                        result.status_code >= 200 && result.status_code < 300
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : result.status_code >= 300 && result.status_code < 400
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : result.status_code >= 400 && result.status_code < 500
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : result.status_code >= 500
                          ? 'bg-red-500/10 text-red-400 border-red-500/20'
                          : 'bg-white/[0.04] text-gray-500 border-white/[0.06]'
                      }`}>
                        {result.status_code || '—'}
                      </span>
                    </td>
                  )}
                  {visibleColumns.screenshot && (
                    <td className={`px-4 ${compactView ? 'py-2' : 'py-3'} whitespace-nowrap`}>
                      {result.screenshot_url ? (
                        <div className="relative w-20 h-14 rounded-lg border border-white/[0.08] overflow-hidden cursor-pointer hover:border-primary-500/30 transition-all group/ss"
                          onClick={() => setScreenshotModal({ isOpen: true, url: result.screenshot_url, domain: result.domain })}>
                          <img
                            src={resolveScreenshotSrc(result)}
                            alt={`Screenshot of ${result.domain}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-white/[0.02] text-gray-600 text-[10px]">N/A</div>';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover/ss:bg-black/30 transition-all flex items-center justify-center">
                            <Camera className="text-white opacity-0 group-hover/ss:opacity-100 transition-opacity h-4 w-4" />
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-600">—</span>
                      )}
                    </td>
                  )}
                  {visibleColumns.title && (
                    <td className={`px-4 ${compactView ? 'py-2' : 'py-3'} whitespace-nowrap max-w-[200px]`}>
                      <span className="text-sm text-gray-400 truncate block">{result.title || '—'}</span>
                    </td>
                  )}
                  {visibleColumns.technology && (
                    <td className={`px-4 ${compactView ? 'py-2' : 'py-3'} whitespace-nowrap`}>
                      <span className="text-sm text-gray-500">
                        {Array.isArray(result.tech) && result.tech.length > 0
                          ? result.tech.slice(0, 3).join(', ') + (result.tech.length > 3 ? ` +${result.tech.length - 3}` : '')
                          : result.webserver || '—'}
                      </span>
                    </td>
                  )}
                  {visibleColumns.ports && (
                    <td className={`px-4 ${compactView ? 'py-2' : 'py-3'} whitespace-nowrap`}>
                      <div className="flex flex-wrap gap-1">
                        {result.ports && result.ports.length > 0 ? (
                          <>
                            {result.ports.slice(0, 4).map((port, idx) => (
                              <span key={idx} className="px-1.5 py-0.5 text-[10px] font-mono bg-white/[0.04] border border-white/[0.06] rounded-md text-gray-400">
                                {typeof port === 'object' ? port.port : port}
                              </span>
                            ))}
                            {result.ports.length > 4 && <span className="text-[10px] text-gray-600 self-center">+{result.ports.length - 4}</span>}
                          </>
                        ) : (
                          <span className="text-[11px] text-gray-600">—</span>
                        )}
                      </div>
                    </td>
                  )}
                  {visibleColumns.vulnerabilities && (
                    <td className={`px-4 ${compactView ? 'py-2' : 'py-3'} whitespace-nowrap`}>
                      {result.vulnerabilities?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {summarizeVulnerabilities(result.vulnerabilities).map(({ severity, count }, idx) => (
                            <span key={idx}
                              className={`${getSeverityColor(severity)} cursor-pointer hover:brightness-125 transition-all px-1.5 py-0.5 rounded-md text-[10px] font-bold font-mono border`}
                              onClick={() => {
                                const vulnOfSeverity = result.vulnerabilities.find(v => v.severity?.toLowerCase() === severity);
                                if (vulnOfSeverity) openVulnerabilityDetails(vulnOfSeverity);
                              }}
                              title={`${count} ${severity} vulnerabilities`}>
                              {count} {severity}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-600">—</span>
                      )}
                    </td>
                  )}
                  {visibleColumns.cdn && (
                    <td className={`px-4 ${compactView ? 'py-2' : 'py-3'} whitespace-nowrap`}>
                      {result.cdn_name ? (
                        <div>
                          <span className="text-sm text-gray-300">{result.cdn_name}</span>
                          {result.cdn_type && <span className="ml-1.5 text-[10px] text-gray-600 uppercase">{result.cdn_type}</span>}
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-600">—</span>
                      )}
                    </td>
                  )}
                  {visibleColumns.tags && (
                    <td className={`px-4 ${compactView ? 'py-2' : 'py-3'} whitespace-nowrap`}>
                      {result.tags && result.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {result.tags.map((tag, idx) => (
                            <span key={idx} className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-primary-500/10 text-primary-400 border border-primary-500/20">{tag}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-600">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filteredResults.length > 0 && (
        <div className="px-4 py-3 border-t border-white/[0.06] bg-white/[0.01]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-xs text-gray-500">
                <span className="text-gray-300 font-medium">{startIndex + 1}–{Math.min(endIndex, filteredResults.length)}</span> of <span className="text-gray-300 font-medium">{filteredResults.length}</span>
              </span>
              <select value={itemsPerPage}
                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="px-2 py-1 text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg text-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500/30 cursor-pointer">
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
                <option value={200}>200 / page</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button onClick={() => goToPage(1)} disabled={currentPage === 1}
                className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none">First</button>
              <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}
                className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none">Prev</button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) pageNum = i + 1;
                else if (currentPage <= 3) pageNum = i + 1;
                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = currentPage - 2 + i;
                return (
                  <button key={pageNum} onClick={() => goToPage(pageNum)}
                    className={`px-2.5 py-1 min-w-[2rem] text-xs rounded-lg transition-all ${
                      currentPage === pageNum
                        ? 'bg-primary-600/20 text-primary-400 border border-primary-500/30 font-medium'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
                    }`}>{pageNum}</button>
                );
              })}

              <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}
                className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none">Next</button>
              <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages}
                className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none">Last</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
