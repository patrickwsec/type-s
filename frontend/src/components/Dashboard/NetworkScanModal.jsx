import React, { useState } from 'react';
import { Button, Input } from '../ui';
import {
  Wifi, X, Server, Search, Bug, ChevronRight, Play, Zap, Shield
} from 'lucide-react';

const TOP_PORT_OPTIONS = [
  { value: 100, label: 'Top 100', desc: 'Common services (fast)' },
  { value: 1000, label: 'Top 1000', desc: 'Extended scan (moderate)' },
];

/**
 * Network Discovery & Scan modal.
 * Lets the user enter a CIDR/IP range and queue a port scan to discover active hosts.
 */
export default function NetworkScanModal({ show, onClose, onQueuePortScan }) {
  const [target, setTarget] = useState('');
  const [topPorts, setTopPorts] = useState(100);
  const [customPorts, setCustomPorts] = useState('');
  const [useCustomPorts, setUseCustomPorts] = useState(false);
  const [scanType, setScanType] = useState('s');
  const [rateLimit, setRateLimit] = useState(1000);
  const [versionScan, setVersionScan] = useState(false);
  const [defaultScripts, setDefaultScripts] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!show) return null;

  const handleSubmit = async () => {
    setError('');
    const trimmedTarget = target.trim();
    if (!trimmedTarget) {
      setError('Please enter a target IP, range, or CIDR subnet.');
      return;
    }

    setIsSubmitting(true);
    try {
      const ports = useCustomPorts && customPorts.trim()
        ? customPorts.split(',').map(p => p.trim()).filter(Boolean)
        : [];

      await onQueuePortScan({
        targets: trimmedTarget.split(/[,\n]+/).map(t => t.trim()).filter(Boolean),
        ports,
        top_ports: useCustomPorts ? undefined : topPorts,
        scan_type: scanType,
        rate_limit: rateLimit,
        version_scan: versionScan,
        default_scripts: defaultScripts,
        create_assets: true,
      });

      // Reset and close
      setTarget('');
      setCustomPorts('');
      setUseCustomPorts(false);
      setTopPorts(100);
      setScanType('s');
      setRateLimit(1000);
      onClose();
    } catch (err) {
      const msg = typeof err === 'string' ? err : err?.message || 'Failed to queue port scan';
      setError(typeof msg === 'string' ? msg : String(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111827]/95 backdrop-blur-md border border-white/[0.06] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/20">
                <Wifi className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-100">Network Discovery</h3>
                <p className="text-xs text-gray-500 mt-0.5">Scan a subnet to discover active hosts and open ports</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 p-1 rounded-lg hover:bg-white/[0.06] transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Workflow preview */}
          <div className="flex items-center gap-2 p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
            {[
              { icon: Wifi, label: 'Port Scan', color: 'text-blue-400', active: true },
              { icon: Search, label: 'Enumerate', color: 'text-emerald-400', active: false },
              { icon: Bug, label: 'Vuln Scan', color: 'text-red-400', active: false },
            ].map(({ icon: StepIcon, label, color, active }, idx) => (
              <React.Fragment key={label}>
                {idx > 0 && <ChevronRight className="h-3 w-3 text-gray-700 flex-shrink-0" />}
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${
                  active ? 'bg-blue-500/10 border border-blue-500/20' : ''
                }`}>
                  <StepIcon className={`h-3 w-3 ${active ? color : 'text-gray-600'}`} />
                  <span className={`text-[11px] font-medium ${active ? color : 'text-gray-600'}`}>{label}</span>
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Target Input */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Target Subnet or IP
            </label>
            <Input
              type="text"
              placeholder="192.168.1.0/24 or 10.0.0.1-10.0.0.254"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full bg-white/[0.04] border-white/[0.08] text-gray-200 rounded-lg font-mono text-sm"
            />
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            <p className="mt-1.5 text-[11px] text-gray-600">
              Supports CIDR notation, comma-separated IPs, or ranges
            </p>
          </div>

          {/* Port Selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Port Selection
            </label>
            <div className="space-y-2">
              {TOP_PORT_OPTIONS.map(({ value, label, desc }) => (
                <button
                  key={value}
                  onClick={() => { setTopPorts(value); setUseCustomPorts(false); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                    !useCustomPorts && topPorts === value
                      ? 'border-blue-500/30 bg-blue-500/[0.06]'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
                  }`}
                >
                  <Server className={`h-4 w-4 flex-shrink-0 ${!useCustomPorts && topPorts === value ? 'text-blue-400' : 'text-gray-500'}`} />
                  <div>
                    <div className="text-sm font-medium text-gray-300">{label}</div>
                    <div className="text-[11px] text-gray-500">{desc}</div>
                  </div>
                </button>
              ))}
              <button
                onClick={() => setUseCustomPorts(true)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                  useCustomPorts
                    ? 'border-blue-500/30 bg-blue-500/[0.06]'
                    : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
                }`}
              >
                <Zap className={`h-4 w-4 flex-shrink-0 ${useCustomPorts ? 'text-blue-400' : 'text-gray-500'}`} />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-300">Custom Ports</div>
                  <div className="text-[11px] text-gray-500">Specify exact ports to scan</div>
                </div>
              </button>
              {useCustomPorts && (
                <div className="pl-7 animate-fade-in">
                  <Input
                    type="text"
                    placeholder="22,80,443,8080,8443,3306,5432"
                    value={customPorts}
                    onChange={(e) => setCustomPorts(e.target.value)}
                    className="w-full bg-white/[0.04] border-white/[0.08] text-gray-300 rounded-lg font-mono text-xs"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Advanced Settings (collapsed) */}
          <details className="group">
            <summary className="text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-400 transition-colors flex items-center gap-1">
              <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
              Advanced Settings
            </summary>
            <div className="mt-3 space-y-3 pl-4 border-l border-white/[0.06]">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">Scan Type</label>
                  <select
                    value={scanType}
                    onChange={(e) => setScanType(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                  >
                    <option value="s">SYN Scan (fast)</option>
                    <option value="c">Connect Scan (reliable)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">Rate Limit (pps)</label>
                  <Input
                    type="number"
                    value={rateLimit}
                    onChange={(e) => setRateLimit(parseInt(e.target.value) || 1000)}
                    min="1"
                    max="10000"
                    className="w-full bg-white/[0.04] border-white/[0.08] text-gray-300 rounded-lg text-xs"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <button type="button"
                  onClick={() => setVersionScan(v => !v)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${versionScan ? 'border-cyan-500/30 bg-cyan-500/[0.06]' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'}`}>
                  <div>
                    <div className="text-sm font-medium text-gray-300">Version Detection <span className="text-[10px] font-mono text-gray-500 ml-1">-sV</span></div>
                    <div className="text-[11px] text-gray-500">Identify service versions on open ports (slower)</div>
                  </div>
                  <div className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 ${versionScan ? 'bg-cyan-500' : 'bg-white/[0.08]'}`}>
                    <div className={`w-4 h-4 mt-0.5 rounded-full bg-white shadow transition-transform ${versionScan ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </button>
                <button type="button"
                  onClick={() => setDefaultScripts(v => !v)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${defaultScripts ? 'border-purple-500/30 bg-purple-500/[0.06]' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'}`}>
                  <div>
                    <div className="text-sm font-medium text-gray-300">Default Scripts <span className="text-[10px] font-mono text-gray-500 ml-1">-sC</span></div>
                    <div className="text-[11px] text-gray-500">NSE default scripts — banners, auth checks, etc. (significantly slower)</div>
                  </div>
                  <div className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 ${defaultScripts ? 'bg-purple-500' : 'bg-white/[0.08]'}`}>
                    <div className={`w-4 h-4 mt-0.5 rounded-full bg-white shadow transition-transform ${defaultScripts ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </button>
              </div>
            </div>
          </details>

          {/* What happens next */}
          <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
            <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Shield className="h-3 w-3 text-gray-500" />
              What happens
            </h4>
            <ul className="text-[11px] text-gray-500 space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">1.</span>
                <span>The port scan task discovers active hosts and open ports</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">2.</span>
                <span>Discovered hosts are automatically added to your asset table</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">3.</span>
                <span>Select the discovered hosts to run service discovery or vuln scanning</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex justify-end gap-3">
          <Button onClick={onClose} variant="secondary">Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="primary"
            loading={isSubmitting}
            disabled={!target.trim() || isSubmitting}
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            Start Port Scan
          </Button>
        </div>
      </div>
    </div>
  );
}
