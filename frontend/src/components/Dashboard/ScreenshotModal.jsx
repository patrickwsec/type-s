import React from 'react';
import { Camera, X } from 'lucide-react';

/**
 * Full-screen screenshot preview modal.
 */
export default function ScreenshotModal({ show, url, domain, onClose }) {
  if (!show) return null;
  const screenshotSrc = url;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative max-w-7xl max-h-[90vh] bg-[#111827]/95 backdrop-blur-md border border-white/[0.06] rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary-500/10 border border-primary-500/20 rounded-lg flex items-center justify-center">
              <Camera className="h-5 w-5 text-primary-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-200">Screenshot Preview</h3>
              <p className="text-xs text-gray-500">{domain}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/[0.06] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-auto max-h-[calc(90vh-72px)]">
          <img
            src={screenshotSrc}
            alt={`Screenshot of ${domain}`}
            className="w-full h-auto rounded-lg"
            onError={(e) => {
              e.target.parentElement.innerHTML = '<div class="w-full h-64 flex items-center justify-center bg-white/[0.03] border border-white/[0.06] text-gray-500 rounded-lg text-sm">Failed to load screenshot</div>';
            }}
          />
        </div>
      </div>
    </div>
  );
}
