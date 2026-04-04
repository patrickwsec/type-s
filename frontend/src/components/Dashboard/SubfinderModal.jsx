import React from 'react';
import { Button, Input } from '../ui';
import { Globe, Play } from 'lucide-react';
import useToast from '../../contexts/useToast';

/**
 * Modal for entering a domain to discover subdomains with Subfinder.
 */
export default function SubfinderModal({
  show,
  domain,
  setDomain,
  onStart,
  onClose,
  title = "Subfinder Discovery",
  description = "Enter a domain to discover subdomains via passive recon",
  submitLabel = "Start Discovery",
}) {
  const showToast = useToast();
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111827]/95 backdrop-blur-md border border-white/[0.06] rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary-400" />
            {title}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {description}
          </p>
        </div>
        
        <div className="px-6 py-5">
          <label className="block text-xs font-medium text-gray-400 mb-2">Domain Name</label>
          <Input
            type="text"
            placeholder="example.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="w-full bg-white/[0.04] border-white/[0.08] text-gray-300 rounded-lg"
            onKeyPress={(e) => {
              if (e.key === 'Enter' && domain.trim()) onStart(domain.trim());
            }}
          />
          <p className="text-xs text-gray-600 mt-2">
            e.g. google.com, github.com, tesla.com
          </p>
        </div>
        
        <div className="px-6 py-4 border-t border-white/[0.06] flex justify-end gap-3">
          <Button onClick={onClose} variant="secondary">Cancel</Button>
          <Button
            onClick={() => {
              if (domain.trim()) onStart(domain.trim());
              else showToast('Please enter a domain name', 'error');
            }}
            variant="primary"
            disabled={!domain.trim()}
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
