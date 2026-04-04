import React, { useState } from 'react';
import { Button, Input } from '../ui';
import { Plus, X, ClipboardList, List } from 'lucide-react';

function parseBulkText(text) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => ({ hostname: line, ip: '' }));
}

/**
 * Modal for adding manual targets (hostname + IP pairs).
 * Supports both row-by-row entry and bulk paste mode.
 */
export default function ManualTargetsModal({
  show,
  targets,
  setTargets,
  onAdd,
  onClose,
  title = "Add Manual Targets",
  description = "Add hostnames and IP addresses not discovered by Subfinder",
  submitLabel = "Add",
}) {
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');

  if (!show) return null;

  const switchToBulk = () => {
    // Pre-fill textarea with any existing row entries
    const existing = targets
      .filter(t => t.hostname.trim())
      .map(t => t.hostname.trim())
      .join('\n');
    setBulkText(existing);
    setBulkMode(true);
  };

  const switchToRows = () => {
    // Parse bulk text back into rows, preserving any content
    const parsed = parseBulkText(bulkText);
    setTargets(parsed.length > 0 ? parsed : [{ hostname: '', ip: '' }]);
    setBulkMode(false);
  };

  const handleSubmit = () => {
    if (bulkMode) {
      const parsed = parseBulkText(bulkText);
      onAdd(parsed);
    } else {
      onAdd(targets);
    }
  };

  const activeCount = bulkMode
    ? parseBulkText(bulkText).length
    : targets.filter(t => t.hostname.trim() || t.ip.trim()).length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111827]/95 backdrop-blur-md border border-white/[0.06] rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary-400" />
              {title}
            </h3>
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          </div>
          {/* Mode toggle */}
          <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-lg p-0.5 ml-4 flex-shrink-0">
            <button
              onClick={() => { if (bulkMode) switchToRows(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                !bulkMode ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              Row
            </button>
            <button
              onClick={() => { if (!bulkMode) switchToBulk(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                bulkMode ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              Bulk Paste
            </button>
          </div>
        </div>
        
        <div className="px-6 py-5 overflow-y-auto max-h-[60vh]">
          {bulkMode ? (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">
                Paste subdomains — one per line
              </label>
              <textarea
                autoFocus
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={`sub1.example.com\nsub2.example.com\nsub3.example.com`}
                rows={16}
                className="w-full bg-white/[0.03] border border-white/[0.08] text-gray-300 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary-500/40 focus:border-primary-500/40 resize-none font-mono placeholder-gray-600"
              />
              {activeCount > 0 && (
                <p className="mt-2 text-xs text-gray-500">{activeCount} subdomain{activeCount !== 1 ? 's' : ''} detected</p>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {targets.map((target, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Hostname / Domain</label>
                      <Input
                        type="text"
                        placeholder="subdomain.example.com"
                        value={target.hostname}
                        onChange={(e) => {
                          const updated = [...targets];
                          updated[index].hostname = e.target.value;
                          setTargets(updated);
                        }}
                        className="w-full bg-white/[0.04] border-white/[0.08] text-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">IP Address (optional)</label>
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          placeholder="192.168.1.1 or /24"
                          value={target.ip}
                          onChange={(e) => {
                            const updated = [...targets];
                            updated[index].ip = e.target.value;
                            setTargets(updated);
                          }}
                          className="w-full bg-white/[0.04] border-white/[0.08] text-gray-300 rounded-lg"
                        />
                        {targets.length > 1 && (
                          <button
                            onClick={() => setTargets(targets.filter((_, i) => i !== index))}
                            className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 flex justify-center">
                <button
                  onClick={() => setTargets([...targets, { hostname: '', ip: '' }])}
                  className="flex items-center gap-1.5 text-sm text-primary-400 hover:text-primary-300 font-medium transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add Another Target
                </button>
              </div>
            </>
          )}

          <div className="mt-5 p-4 bg-white/[0.02] border border-white/[0.06] rounded-lg">
            <h4 className="text-xs font-medium text-gray-400 mb-2">Tips</h4>
            <ul className="text-xs text-gray-500 space-y-1">
              {bulkMode ? (
                <>
                  <li>• Paste a raw subfinder output — one hostname per line</li>
                  <li>• Blank lines and whitespace are ignored</li>
                  <li>• Switch to Row mode to also specify IP addresses</li>
                </>
              ) : (
                <>
                  <li>• Add just a hostname, just an IP, or both</li>
                  <li>• Supports CIDR notation (e.g., 192.168.1.0/24)</li>
                  <li>• Switch to Bulk Paste to add many subdomains at once</li>
                </>
              )}
            </ul>
          </div>
        </div>
        
        <div className="px-6 py-4 border-t border-white/[0.06] flex justify-end gap-3">
          <Button onClick={onClose} variant="secondary">Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="primary"
            className="flex items-center gap-2"
            disabled={activeCount === 0}
          >
            <Plus className="h-4 w-4" />
            {submitLabel} {activeCount} Target{activeCount !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    </div>
  );
}
