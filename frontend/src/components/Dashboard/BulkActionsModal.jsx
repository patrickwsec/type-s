import React from 'react';
import { Button, Input } from '../ui';
import {
  List, X, CloudDownload, Plus, Minus, Trash2
} from 'lucide-react';

/**
 * Modal for performing bulk actions on selected assets.
 */
export default function BulkActionsModal({
  show, selectedCount, actionType, setActionType,
  tagValue, setTagValue, onExecute, onClose
}) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111827]/95 backdrop-blur-md border border-white/[0.06] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
              <List className="h-5 w-5 text-primary-400" />
              Bulk Actions
            </h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 p-1 rounded-lg hover:bg-white/[0.06] transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Perform actions on {selectedCount} selected assets
          </p>
        </div>
        
        <div className="p-6 space-y-5">
          {/* Action Type Selection */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-3">Select Action</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'export', icon: CloudDownload, label: 'Export', desc: 'Download as CSV' },
                { key: 'add_tag', icon: Plus, label: 'Add Tag', desc: 'Tag assets' },
                { key: 'remove_tag', icon: Minus, label: 'Remove Tag', desc: 'Untag assets' },
                { key: 'delete', icon: Trash2, label: 'Delete', desc: 'Remove assets', danger: true },
              ].map(({ key, icon: Icon, label, desc, danger }) => (
                <button
                  key={key}
                  onClick={() => setActionType(key)}
                  className={`p-3.5 rounded-lg border transition-all text-left ${
                    actionType === key
                      ? danger
                        ? 'border-red-500/30 bg-red-500/[0.08]'
                        : 'border-primary-500/30 bg-primary-500/[0.08]'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 ${danger ? 'text-red-400' : actionType === key ? 'text-primary-400' : 'text-gray-500'}`} />
                    <div>
                      <div className="text-sm font-medium text-gray-300">{label}</div>
                      <div className="text-xs text-gray-500">{desc}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Tag Input */}
          {(actionType === 'add_tag' || actionType === 'remove_tag') && (
            <div className="animate-fade-in">
              <label className="block text-xs font-medium text-gray-400 mb-2">Tag Value</label>
              <Input
                type="text"
                placeholder="Enter tag name"
                value={tagValue}
                onChange={(e) => setTagValue(e.target.value)}
                className="w-full bg-white/[0.04] border-white/[0.08] text-gray-300 rounded-lg"
              />
            </div>
          )}

          {/* Action Summary */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-4">
            <h4 className="text-xs font-medium text-gray-400 mb-1.5">Summary</h4>
            <div className="text-sm text-gray-500">
              {actionType === 'export' && <p>Export {selectedCount} selected assets to CSV file</p>}
              {actionType === 'add_tag' && <p>Add tag "{tagValue || '...'}" to {selectedCount} selected assets</p>}
              {actionType === 'remove_tag' && <p>Remove tag "{tagValue || '...'}" from {selectedCount} selected assets</p>}
              {actionType === 'delete' && <p className="text-red-400">Delete {selectedCount} selected assets permanently</p>}
              {!actionType && <p>Select an action above to continue</p>}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button onClick={onClose} variant="secondary">Cancel</Button>
            <Button
              onClick={onExecute}
              disabled={!actionType || ((actionType === 'add_tag' || actionType === 'remove_tag') && !tagValue.trim())}
              variant={actionType === 'delete' ? 'danger' : 'primary'}
            >
              {actionType === 'export' && 'Export CSV'}
              {actionType === 'add_tag' && 'Add Tag'}
              {actionType === 'remove_tag' && 'Remove Tag'}
              {actionType === 'delete' && 'Delete Assets'}
              {!actionType && 'Select Action'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
