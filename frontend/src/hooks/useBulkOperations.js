import { useState, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

/**
 * Hook for bulk operations: selection, export, tag, delete.
 * @param {Object} params
 * @param {Array} params.filteredResults
 * @param {Array} params.paginatedResults
 * @param {Object|null} params.selectedProject
 * @param {Function} params.loadProjectData
 * @param {Function} params.showNotification
 * @returns bulk ops state + actions
 */
export function useBulkOperations({ filteredResults, paginatedResults, selectedProject, loadProjectData, showNotification }) {
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkActionType, setBulkActionType] = useState('');
  const [bulkTagValue, setBulkTagValue] = useState('');

  const toggleItemSelection = useCallback((itemId) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const selectAllItems = useCallback(() => {
    setSelectedItems(new Set(filteredResults.map(r => r.id)));
  }, [filteredResults]);

  const selectAllOnCurrentPage = useCallback(() => {
    setSelectedItems(new Set(paginatedResults.map(r => r.id)));
  }, [paginatedResults]);

  const selectAllOnAllPages = useCallback(() => {
    setSelectedItems(new Set(filteredResults.map(r => r.id)));
  }, [filteredResults]);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  const exportSelectedResults = useCallback((results) => {
    const csvContent = [
      ['Domain', 'URL', 'IP Address', 'Status', 'Title', 'Technology', 'CDN', 'Webserver', 'Ports', 'Vulnerabilities', 'Tags'],
      ...results.map(result => [
        result.domain || '',
        result.url || '',
        result.ip_address || '',
        result.status_code || '',
        result.title || '',
        Array.isArray(result.tech) ? result.tech.join('; ') : (result.tech || ''),
        result.cdn_name || '',
        result.webserver || '',
        Array.isArray(result.ports) ? result.ports.join(', ') : (result.ports || ''),
        result.vulnerabilities ? result.vulnerabilities.length : 0,
        Array.isArray(result.tags) ? result.tags.join(', ') : (result.tags || '')
      ])
    ].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `selected_assets_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    showNotification(`Exported ${results.length} assets to CSV`, 'success');
  }, [showNotification]);

  const bulkAddTag = useCallback(async (results, tag) => {
    const assetIds = results.map(r => r.id).filter(Boolean);
    if (assetIds.length === 0) throw new Error('No valid assets found');
    const response = await fetch(`${API_BASE}/v2/projects/${selectedProject.id}/assets/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ asset_ids: assetIds, tags: [tag] }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Failed to add tag');
    }
    showNotification(`Added tag "${tag}" to ${assetIds.length} assets`, 'success');
    loadProjectData(selectedProject.id);
  }, [selectedProject?.id, showNotification, loadProjectData]);

  const bulkRemoveTag = useCallback(async (results, tag) => {
    const assetIds = results.map(r => r.id).filter(Boolean);
    if (assetIds.length === 0) throw new Error('No valid assets found');
    const response = await fetch(`${API_BASE}/v2/projects/${selectedProject.id}/assets/tags`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ asset_ids: assetIds, tags: [tag] }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Failed to remove tag');
    }
    showNotification(`Removed tag "${tag}" from ${assetIds.length} assets`, 'success');
    loadProjectData(selectedProject.id);
  }, [selectedProject?.id, showNotification, loadProjectData]);

  const bulkDelete = useCallback(async (results) => {
    const assetIds = results.map(r => r.id).filter(Boolean);
    if (assetIds.length === 0) {
      showNotification('No valid assets to delete.', 'error');
      return;
    }

    const response = await fetch(
      `${API_BASE}/v2/projects/${selectedProject.id}/assets/delete`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ asset_ids: assetIds }),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Failed to delete assets');
    }

    showNotification(`Deleted ${assetIds.length} asset(s)`, 'success');
    loadProjectData(selectedProject.id);
  }, [selectedProject?.id, showNotification, loadProjectData]);

  const handleBulkAction = useCallback(async () => {
    if (selectedItems.size === 0) {
      showNotification('Please select items first', 'error');
      return;
    }
    const selectedResults = filteredResults.filter(r => selectedItems.has(r.id));
    try {
      switch (bulkActionType) {
        case 'export':
          exportSelectedResults(selectedResults);
          break;
        case 'add_tag':
          if (!bulkTagValue.trim()) { showNotification('Please enter a tag value', 'error'); return; }
          await bulkAddTag(selectedResults, bulkTagValue);
          break;
        case 'remove_tag':
          if (!bulkTagValue.trim()) { showNotification('Please enter a tag value', 'error'); return; }
          await bulkRemoveTag(selectedResults, bulkTagValue);
          break;
        case 'delete':
          if (!confirm(`Are you sure you want to delete ${selectedItems.size} selected items?`)) return;
          await bulkDelete(selectedResults);
          break;
        default:
          showNotification('Please select an action', 'error');
          return;
      }
      setShowBulkActions(false);
      setBulkActionType('');
      setBulkTagValue('');
      clearSelection();
    } catch (error) {
      showNotification(`Bulk action failed: ${error.message}`, 'error');
    }
  }, [selectedItems, filteredResults, bulkActionType, bulkTagValue, showNotification, exportSelectedResults, bulkAddTag, bulkRemoveTag, bulkDelete, clearSelection]);

  return {
    selectedItems, setSelectedItems,
    showBulkActions, setShowBulkActions,
    bulkActionType, setBulkActionType,
    bulkTagValue, setBulkTagValue,
    toggleItemSelection,
    selectAllItems,
    selectAllOnCurrentPage,
    selectAllOnAllPages,
    clearSelection,
    exportSelectedResults,
    handleBulkAction,
  };
}
