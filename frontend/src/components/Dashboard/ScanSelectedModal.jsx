import React, { useEffect, useMemo } from 'react';
import { Button } from '../ui';
import {
  Radar, X, Server, Bug, Wifi, Search, Zap, ChevronRight, Camera, Sparkles
} from 'lucide-react';

/**
 * Modal for scanning selected table targets.
 * Supports port scanning, service discovery, and vulnerability scanning workflows.
 */
export default function ScanSelectedModal({
  show, onClose,
  selectedItems, filteredResults,
  scanType, setScanType,
  nucleiConfig, templateCategories,
  onOpenNucleiConfig,
  portScanConfig, setPortScanConfig,
  onStartScan,
}) {
  useEffect(() => {
    if (show && !scanType) {
      setScanType('run_findings_scan');
    }
  }, [show, scanType, setScanType]);

  // Compute detected services across selected assets for Smart Scan indicator
  const smartScanInfo = useMemo(() => {
    if (!filteredResults || !selectedItems) return null;
    const selected = filteredResults.filter(r => selectedItems.has(r.id));
    const serviceCounts = {};
    let portedAssetCount = 0;
    for (const result of selected) {
      const details = result.port_details || [];
      const ports = result.ports || [];
      if (details.length > 0 || ports.length > 0) portedAssetCount++;
      for (const pd of details) {
        const svc = (pd.service || '').toLowerCase().trim();
        if (svc) serviceCounts[svc] = (serviceCounts[svc] || 0) + 1;
      }
      // Fallback: infer from plain port numbers
      if (details.length === 0) {
        for (const port of ports) {
          const svc = [80, 8080, 8000, 8888, 3000, 5000].includes(port) ? 'http'
            : [443, 8443].includes(port) ? 'https' : null;
          if (svc) serviceCounts[svc] = (serviceCounts[svc] || 0) + 1;
        }
      }
    }
    const services = Object.keys(serviceCounts).sort();
    return { services, portedAssetCount, totalAssets: selected.length };
  }, [filteredResults, selectedItems]);

  if (!show) return null;

  const scanTypes = [
    {
      key: 'port_scan',
      icon: Wifi,
      label: 'Port Scan',
      desc: 'Discover open ports on the selected targets with nmap',
      gradient: 'from-blue-500/20 to-cyan-500/10',
      activeGlow: 'shadow-[0_0_15px_rgba(59,130,246,0.15)]',
      activeBorder: 'border-blue-500/40',
      iconColor: 'text-blue-400',
      step: 1,
    },
    {
      key: 'service_discovery',
      icon: Search,
      label: 'Service Discovery',
      desc: 'Identify web services, technologies, and metadata with httpx',
      gradient: 'from-emerald-500/20 to-green-500/10',
      activeGlow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]',
      activeBorder: 'border-emerald-500/40',
      iconColor: 'text-emerald-400',
      step: 2,
    },
    {
      key: 'run_findings_scan',
      icon: Bug,
      label: 'Vulnerability Scan',
      desc: 'Run nuclei vulnerability scanner against selected assets',
      gradient: 'from-red-500/20 to-orange-500/10',
      activeGlow: 'shadow-[0_0_15px_rgba(239,68,68,0.15)]',
      activeBorder: 'border-red-500/40',
      iconColor: 'text-red-400',
      step: 3,
    },
    {
      key: 'capture_screenshots',
      icon: Camera,
      label: 'Capture Screenshots',
      desc: 'Take screenshots of live web services on selected assets',
      gradient: 'from-amber-500/20 to-yellow-500/10',
      activeGlow: 'shadow-[0_0_15px_rgba(245,158,11,0.15)]',
      activeBorder: 'border-amber-500/40',
      iconColor: 'text-amber-400',
      step: 4,
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111827]/95 backdrop-blur-md border border-white/[0.06] rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-white/[0.06] sticky top-0 bg-[#111827]/95 backdrop-blur-md z-10">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary-500/10 border border-primary-500/20">
                <Radar className="h-5 w-5 text-primary-400" />
              </div>
              Scan Selected Assets
            </h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 p-1 rounded-lg hover:bg-white/[0.06] transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">{selectedItems.size} targets selected</p>
        </div>
        
        <div className="p-6 space-y-5">
          {/* Selected Targets Preview */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-4">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Selected Targets</h4>
            <div className="space-y-1.5 max-h-28 overflow-y-auto">
              {filteredResults.filter(r => selectedItems.has(r.id)).slice(0, 8).map((result, idx) => (
                <div key={idx} className="text-sm text-gray-400 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0" />
                  <span className="truncate font-mono text-xs">{result.domain || result.url || 'N/A'}</span>
                  {result.ports && result.ports.length > 0 && (
                    <span className="text-[10px] text-gray-600 ml-auto flex-shrink-0">{result.ports.length} ports</span>
                  )}
                </div>
              ))}
              {selectedItems.size > 8 && (
                <div className="text-[11px] text-gray-600 italic pl-3.5">...and {selectedItems.size - 8} more</div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 px-1">
            {[
              { label: 'Discover', icon: Wifi, color: 'text-blue-400' },
              { label: 'Enumerate', icon: Search, color: 'text-emerald-400' },
              { label: 'Scan', icon: Bug, color: 'text-red-400' },
            ].map(({ label, icon: StepIcon, color }, idx) => (
              <React.Fragment key={label}>
                {idx > 0 && <ChevronRight className="h-3 w-3 text-gray-700 flex-shrink-0" />}
                <div className="flex items-center gap-1.5">
                  <StepIcon className={`h-3 w-3 ${color}`} />
                  <span className="text-[11px] text-gray-500 font-medium">{label}</span>
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Scan Type Selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Select Task Type</label>
            <div className="space-y-2">
              {scanTypes.map(({ key, icon: Icon, label, desc, gradient, activeGlow, activeBorder, iconColor, step }) => (
                <button
                  key={key}
                  onClick={() => setScanType(key)}
                  className={`w-full p-4 rounded-xl border transition-all duration-200 text-left group ${
                    scanType === key
                      ? `bg-gradient-to-r ${gradient} ${activeBorder} ${activeGlow}`
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {step && (
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                        scanType === key
                          ? `${iconColor} bg-white/[0.1]`
                          : 'text-gray-600 bg-white/[0.04]'
                      }`}>
                        {step}
                      </div>
                    )}
                    <div className={`p-2 rounded-lg ${
                      scanType === key ? 'bg-white/[0.1]' : 'bg-white/[0.04]'
                    }`}>
                      <Icon className={`h-4.5 w-4.5 ${scanType === key ? iconColor : 'text-gray-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold ${scanType === key ? 'text-gray-200' : 'text-gray-300'}`}>{label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
                    </div>
                    {scanType === key && (
                      <Zap className={`h-4 w-4 ${iconColor} flex-shrink-0`} />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Port Scan Config */}
          {scanType === 'port_scan' && portScanConfig && setPortScanConfig && (
            <div className="border-t border-white/[0.04] pt-4 animate-fade-in space-y-3">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Wifi className="h-3.5 w-3.5 text-blue-400" />Port Scan Settings
              </h4>

              {/* Port selection */}
              <div className="space-y-2">
                <label className="block text-[11px] text-gray-500 uppercase tracking-wider">Ports</label>
                {[{v:100,l:'Top 100',d:'Common services (fast)'},{v:1000,l:'Top 1000',d:'Extended scan (moderate)'}].map(({v,l,d}) => (
                  <button key={v} type="button"
                    onClick={() => setPortScanConfig(c => ({...c, topPorts: v, useCustomPorts: false}))}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                      !portScanConfig.useCustomPorts && portScanConfig.topPorts === v
                        ? 'border-blue-500/30 bg-blue-500/[0.06]'
                        : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
                    }`}>
                    <Server className={`h-4 w-4 flex-shrink-0 ${!portScanConfig.useCustomPorts && portScanConfig.topPorts === v ? 'text-blue-400' : 'text-gray-500'}`} />
                    <div>
                      <div className="text-sm font-medium text-gray-300">{l}</div>
                      <div className="text-[11px] text-gray-500">{d}</div>
                    </div>
                  </button>
                ))}
                <button type="button"
                  onClick={() => setPortScanConfig(c => ({...c, useCustomPorts: true}))}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                    portScanConfig.useCustomPorts
                      ? 'border-blue-500/30 bg-blue-500/[0.06]'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
                  }`}>
                  <Zap className={`h-4 w-4 flex-shrink-0 ${portScanConfig.useCustomPorts ? 'text-blue-400' : 'text-gray-500'}`} />
                  <div>
                    <div className="text-sm font-medium text-gray-300">Custom Ports</div>
                    <div className="text-[11px] text-gray-500">Specify exact ports or ranges</div>
                  </div>
                </button>
                {portScanConfig.useCustomPorts && (
                  <div className="pl-4">
                    <input
                      type="text"
                      placeholder="22,80,443,8080-8090"
                      value={portScanConfig.customPorts}
                      onChange={e => setPortScanConfig(c => ({...c, customPorts: e.target.value}))}
                      className="w-full px-3 py-2 text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg text-gray-300 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                    />
                  </div>
                )}
              </div>

              {/* Scan type + timing + version options */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">Scan Type</label>
                  <select
                    value={portScanConfig.scanType}
                    onChange={e => setPortScanConfig(c => ({...c, scanType: e.target.value}))}
                    className="w-full px-3 py-2 text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                  >
                    <option value="sT">TCP Connect (no root)</option>
                    <option value="sS">SYN Scan (requires root)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">Timing</label>
                  <select
                    value={portScanConfig.timing}
                    onChange={e => setPortScanConfig(c => ({...c, timing: Number(e.target.value)}))}
                    className="w-full px-3 py-2 text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                  >
                    <option value={2}>T2 — Polite</option>
                    <option value={3}>T3 — Normal</option>
                    <option value={4}>T4 — Aggressive</option>
                    <option value={5}>T5 — Insane</option>
                  </select>
                </div>
              </div>

              {/* Version scan toggles */}
              <div className="space-y-2">
                <button type="button"
                  onClick={() => setPortScanConfig(c => ({...c, versionScan: !c.versionScan}))}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${
                    portScanConfig.versionScan
                      ? 'border-cyan-500/30 bg-cyan-500/[0.06]'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
                  }`}>
                  <div>
                    <div className="text-sm font-medium text-gray-300">Version Detection <span className="text-[10px] font-mono text-gray-500 ml-1">-sV</span></div>
                    <div className="text-[11px] text-gray-500">Probe open ports to identify service versions (slower)</div>
                  </div>
                  <div className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 ${portScanConfig.versionScan ? 'bg-cyan-500' : 'bg-white/[0.08]'}`}>
                    <div className={`w-4 h-4 mt-0.5 rounded-full bg-white shadow transition-transform ${portScanConfig.versionScan ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </button>
                <button type="button"
                  onClick={() => setPortScanConfig(c => ({...c, defaultScripts: !c.defaultScripts}))}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${
                    portScanConfig.defaultScripts
                      ? 'border-purple-500/30 bg-purple-500/[0.06]'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
                  }`}>
                  <div>
                    <div className="text-sm font-medium text-gray-300">Default Scripts <span className="text-[10px] font-mono text-gray-500 ml-1">-sC</span></div>
                    <div className="text-[11px] text-gray-500">Run NSE default scripts — banners, auth checks, etc. (significantly slower)</div>
                  </div>
                  <div className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 ${portScanConfig.defaultScripts ? 'bg-purple-500' : 'bg-white/[0.08]'}`}>
                    <div className={`w-4 h-4 mt-0.5 rounded-full bg-white shadow transition-transform ${portScanConfig.defaultScripts ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Service Discovery Config */}
          {scanType === 'service_discovery' && (
            <div className="border-t border-white/[0.04] pt-4 animate-fade-in space-y-3">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-emerald-400" />Service Discovery Settings
              </h4>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500 text-xs">Tool:</span>
                    <div className="text-gray-300 mt-0.5 font-medium">httpx</div>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">Detection:</span>
                    <div className="text-gray-300 mt-0.5 font-medium">Tech + Status + Title</div>
                  </div>
                </div>
                <p className="text-[11px] text-gray-600">
                  Runs httpx against the selected assets to identify web services, technologies, status codes, and titles. Updates existing asset records.
                </p>
              </div>
            </div>
          )}
          {/* Nuclei Config Summary */}
          {scanType === 'run_findings_scan' && (
            <div className="border-t border-white/[0.04] pt-4 animate-fade-in">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <Bug className="h-3.5 w-3.5 text-red-400" />Nuclei Configuration
                </h4>
                <button onClick={onOpenNucleiConfig}
                  className="text-xs text-primary-400 hover:text-primary-300 font-medium transition-colors">
                  Configure →
                </button>
              </div>

              {/* Smart Scan indicator */}
              {smartScanInfo && smartScanInfo.portedAssetCount > 0 && !nucleiConfig?.customTags?.length && (
                <div className="mb-3 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04]">
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-emerald-300 mb-1">
                        Smart Scan — templates auto-selected
                      </p>
                      {smartScanInfo.services.length > 0 ? (
                        <>
                          <p className="text-[11px] text-gray-500 mb-2">
                            Services detected on {smartScanInfo.portedAssetCount} of {smartScanInfo.totalAssets} selected asset{smartScanInfo.totalAssets !== 1 ? 's' : ''}:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {smartScanInfo.services.map(svc => (
                              <span key={svc} className="px-1.5 py-0.5 text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded">
                                {svc}
                              </span>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-[11px] text-gray-500">
                          {smartScanInfo.portedAssetCount} asset{smartScanInfo.portedAssetCount !== 1 ? 's have' : ' has'} open ports — templates will be inferred from port numbers.
                        </p>
                      )}
                      <p className="text-[11px] text-gray-600 mt-2">
                        Nuclei templates matching these services + CVEs/exposures will run automatically. Use "Configure →" to override.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500 text-xs">Profile:</span>
                    <div className="text-gray-300 mt-0.5 font-medium">{templateCategories?.template_categories?.[nucleiConfig?.category]?.name || nucleiConfig?.category || 'Default'}</div>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">Severity:</span>
                    <div className="text-gray-300 mt-0.5 font-medium">{nucleiConfig?.customSeverity?.join(', ') || 'medium, high, critical'}</div>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">Rate:</span>
                    <div className="text-gray-300 mt-0.5 font-medium">{nucleiConfig?.rateLimit || 150} req/s</div>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">Timeout:</span>
                    <div className="text-gray-300 mt-0.5 font-medium">{nucleiConfig?.timeout || 10}s</div>
                  </div>
                </div>
                {nucleiConfig?.customTags?.length > 0 && (
                  <div className="mt-3 text-sm">
                    <span className="text-gray-500 text-xs">Tags:</span>
                    <div className="text-gray-300 mt-0.5 font-medium">{nucleiConfig.customTags.join(', ')}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Summary + Buttons */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-gray-500">
              {scanType && (
                <span>
                  <span className="text-gray-400 font-medium">{scanTypes.find(s => s.key === scanType)?.label}</span> on{' '}
                  <span className="text-gray-400 font-medium">{selectedItems.size}</span> target{selectedItems.size !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <Button onClick={onClose} variant="secondary">Cancel</Button>
              <Button onClick={onStartScan} disabled={!scanType} variant="primary" className="flex items-center gap-2">
                <Radar className="h-4 w-4" />Queue Task
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
