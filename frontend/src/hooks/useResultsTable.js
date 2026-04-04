import { useState, useEffect, useCallback, useMemo } from 'react';

const STORAGE_KEY = 'types_assets_columns';

const DEFAULT_COLUMNS = {
  select: true,
  domain: true,
  ip: true,
  status: true,
  screenshot: true,
  title: false,
  technology: true,
  ports: false,
  vulnerabilities: true,
  cdn: false,
  tags: true,
};

function loadColumnsFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_COLUMNS;
    const parsed = JSON.parse(stored);
    // Merge with defaults so new columns added in future get their default value
    return { ...DEFAULT_COLUMNS, ...parsed };
  } catch {
    return DEFAULT_COLUMNS;
  }
}

/**
 * Hook for managing results table: filtering, sorting, pagination, column visibility.
 * @param {Array} results - Raw results array
 * @returns table state + helpers
 */
export function useResultsTable(results) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [filters, setFilters] = useState({
    status: 'all',
    vulnerability: 'all',
    technology: 'all',
    cdn: 'all',
    ports: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showColumnControls, setShowColumnControls] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(loadColumnsFromStorage);
  const [compactView, setCompactView] = useState(false);

  // Persist column visibility to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumns));
    } catch {
      // Storage unavailable — silently ignore
    }
  }, [visibleColumns]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters, sortField, sortDirection]);

  const handleSort = useCallback((field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  const clearFilters = useCallback(() => {
    setFilters({ status: 'all', vulnerability: 'all', technology: 'all', cdn: 'all', ports: 'all' });
    setSearchTerm('');
  }, []);

  const toggleColumn = useCallback((column) => {
    setVisibleColumns(prev => ({ ...prev, [column]: !prev[column] }));
  }, []);

  const resetColumns = useCallback(() => {
    setVisibleColumns(DEFAULT_COLUMNS);
  }, []);

  const showAllColumns = useCallback(() => {
    setVisibleColumns(Object.fromEntries(Object.keys(DEFAULT_COLUMNS).map(k => [k, true])));
  }, []);

  const goToPage = useCallback((page) => {
    setCurrentPage(page);
  }, []);

  // Filtered and sorted results
  const filteredResults = useMemo(() => {
    if (!Array.isArray(results)) return [];

    let filtered = results.filter(result => {
      // Text search filter
      const matchesSearch = !searchTerm || (
        result.domain?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        result.ip_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        result.tech?.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())) ||
        result.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        result.webserver?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        result.cdn_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        result.cdn_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        result.ports?.some(port => {
          const portStr = typeof port === 'object' ? port.port?.toString() : port?.toString();
          return portStr?.toLowerCase().includes(searchTerm.toLowerCase());
        }) ||
        result.vulnerabilities?.some(vuln =>
          vuln.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          vuln.severity?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
      if (!matchesSearch) return false;

      // Status filter
      if (filters.status !== 'all') {
        const isLive = result.status_code && result.status_code !== 0;
        if (filters.status === 'live' && !isLive) return false;
        if (filters.status === 'dead' && isLive) return false;
      }

      // Vulnerability filter
      if (filters.vulnerability !== 'all') {
        const hasVulns = result.vulnerabilities && result.vulnerabilities.length > 0;
        if (filters.vulnerability === 'has_vulns' && !hasVulns) return false;
        if (filters.vulnerability === 'no_vulns' && hasVulns) return false;
        if (filters.vulnerability === 'critical' && !result.vulnerabilities?.some(v => v.severity?.toLowerCase() === 'critical')) return false;
        if (filters.vulnerability === 'high' && !result.vulnerabilities?.some(v => v.severity?.toLowerCase() === 'high')) return false;
      }

      // Technology filter
      if (filters.technology !== 'all') {
        const hasTech = result.tech && result.tech.length > 0;
        if (filters.technology === 'has_tech' && !hasTech) return false;
        if (filters.technology === 'no_tech' && hasTech) return false;
      }

      // CDN filter
      if (filters.cdn !== 'all') {
        const hasCDN = result.cdn_name || result.cdn_type;
        if (filters.cdn === 'has_cdn' && !hasCDN) return false;
        if (filters.cdn === 'no_cdn' && hasCDN) return false;
      }

      // Ports filter
      if (filters.ports !== 'all') {
        const hasPorts = result.ports && result.ports.length > 0;
        if (filters.ports === 'has_ports' && !hasPorts) return false;
        if (filters.ports === 'no_ports' && hasPorts) return false;
        if (filters.ports === 'common_ports' && hasPorts) {
          const commonPorts = ['80', '443', '8080', '8443', '3000', '8000'];
          const hasCommonPort = result.ports.some(port => {
            const portStr = typeof port === 'object' ? port.port?.toString() : port?.toString();
            return commonPorts.includes(portStr);
          });
          if (!hasCommonPort) return false;
        }
      }

      return true;
    });

    // Sorting
    if (sortField) {
      filtered.sort((a, b) => {
        let aVal, bVal;
        switch (sortField) {
          case 'domain': aVal = a.domain || ''; bVal = b.domain || ''; break;
          case 'ip': aVal = a.ip_address || ''; bVal = b.ip_address || ''; break;
          case 'status': aVal = a.status_code || 0; bVal = b.status_code || 0; break;
          case 'title': aVal = a.title || ''; bVal = b.title || ''; break;
          case 'technology': aVal = a.tech?.join(', ') || ''; bVal = b.tech?.join(', ') || ''; break;
          case 'ports': aVal = a.ports?.length || 0; bVal = b.ports?.length || 0; break;
          case 'vulnerabilities': aVal = a.vulnerabilities?.length || 0; bVal = b.vulnerabilities?.length || 0; break;
          case 'cdn': aVal = a.cdn_name || a.cdn_type || ''; bVal = b.cdn_name || b.cdn_type || ''; break;
          default: return 0;
        }
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }

    return filtered;
  }, [results, searchTerm, filters, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedResults = filteredResults.slice(startIndex, endIndex);

  // Get unique values for filter dropdowns
  const getUniqueValues = useCallback((field) => {
    const values = new Set();
    results.forEach(result => {
      if (field === 'tech' && result.tech) {
        result.tech.forEach(tech => values.add(tech));
      } else if (field === 'cdn' && (result.cdn_name || result.cdn_type)) {
        values.add(result.cdn_name || result.cdn_type);
      }
    });
    return Array.from(values).sort();
  }, [results]);

  return {
    // Search & filter state
    searchTerm, setSearchTerm,
    filters, setFilters,
    showFilters, setShowFilters,
    sortField, sortDirection,
    handleSort,
    clearFilters,
    // Column visibility
    visibleColumns, showColumnControls, setShowColumnControls,
    toggleColumn, resetColumns, showAllColumns,
    compactView, setCompactView,
    // Pagination
    currentPage, setCurrentPage, itemsPerPage, setItemsPerPage,
    totalPages, startIndex, endIndex,
    paginatedResults, filteredResults,
    goToPage,
    // Helpers
    getUniqueValues,
  };
}
