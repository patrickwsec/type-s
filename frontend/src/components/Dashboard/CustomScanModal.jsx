import React from 'react';
import { Button, Input } from '../ui';
import { Radar, X, Play } from 'lucide-react';

/**
 * Modal for starting a task or scan against a single target.
 */
const DEFAULT_SCAN_OPTIONS = [
  { key: 'subfinder', label: 'Subfinder' },
  { key: 'naabu', label: 'Naabu' },
  { key: 'httpx', label: 'HttpX' },
  { key: 'nuclei', label: 'Nuclei' },
];

export default function CustomScanModal({
  show,
  target,
  setTarget,
  scanType,
  setScanType,
  error,
  onRun,
  onClose,
  title = "Scan Custom Target",
  targetLabel = "Target (domain or host)",
  targetPlaceholder = "example.com or sub.example.com",
  scanOptions = DEFAULT_SCAN_OPTIONS,
  submitLabel = "Run Scan",
}) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111827]/95 backdrop-blur-md border border-white/[0.06] rounded-xl shadow-2xl w-full max-w-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Radar className="h-5 w-5 text-primary-400" />
            <h3 className="text-lg font-semibold text-gray-100">{title}</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 p-1 rounded-lg hover:bg-white/[0.06] transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">{targetLabel}</label>
            <Input
              type="text"
              placeholder={targetPlaceholder}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full bg-white/[0.04] border-white/[0.08] text-gray-300 rounded-lg"
            />
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Action Type</label>
            <div className="flex gap-2">
              {scanOptions.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setScanType(key)}
                  className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                    scanType === key
                      ? 'bg-primary-600/20 border-primary-500/30 text-primary-300'
                      : 'bg-white/[0.03] border-white/[0.06] text-gray-400 hover:border-white/[0.12] hover:text-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button onClick={onClose} variant="secondary">Cancel</Button>
            <Button onClick={onRun} variant="primary" className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              {submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
