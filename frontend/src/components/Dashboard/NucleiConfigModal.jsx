import React from 'react';
import { Bug, X } from 'lucide-react';

const inputClass = "w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500/30 focus:border-primary-500/40 placeholder-gray-600";
const checkboxClass = "h-4 w-4 rounded bg-white/[0.04] border-white/[0.15] text-primary-500 focus:ring-primary-500/30 focus:ring-offset-0";
const sectionTitle = "text-xs font-medium text-gray-400 mb-4 flex items-center gap-2";
const fieldLabel = "block text-xs font-medium text-gray-400 mb-1.5";
const fieldHint = "text-[11px] text-gray-600 mt-1";

/**
 * Nuclei vulnerability scan configuration modal.
 * Full-screen with template selection, presets, severity, performance, and advanced options.
 */
export default function NucleiConfigModal({
  show, onClose, config, setConfig,
  templateCategories, validateConfig
}) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col z-50">
      <div className="flex-1 flex flex-col max-w-7xl w-full mx-auto my-4 bg-[#111827]/95 backdrop-blur-md border border-white/[0.06] rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-primary-500/10 border border-primary-500/20">
                  <Bug className="h-5 w-5 text-primary-400" />
                </div>
                Nuclei Scan Configuration
              </h2>
              <p className="text-sm text-gray-500 mt-1">Configure vulnerability scanner for optimal detection</p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 p-1 rounded-lg hover:bg-white/[0.06] transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-3 flex items-start gap-3 p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
            <Bug className="h-4 w-4 text-primary-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-xs font-medium text-gray-300 mb-1">Configuration Tips</h4>
              <div className="text-[11px] text-gray-500 space-y-0.5">
                <p>• <span className="text-gray-400">Quick Presets</span> — Use preset configurations for common scan types</p>
                <p>• <span className="text-gray-400">Custom Mode</span> — Specify exact templates or tags for precise control</p>
                <p>• <span className="text-gray-400">Performance</span> — Higher rate limits = faster scans but more aggressive</p>
                <p>• <span className="text-gray-400">Severity</span> — Focus on critical/high for production, include all for comprehensive audits</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Template Selection */}
            <div className="space-y-6">
              {/* Scan Profile */}
              <div>
                <h4 className={sectionTitle}>
                  <Bug className="h-3.5 w-3.5 text-primary-400" />Scan Profile
                </h4>
                <div className="space-y-2">
                  {Object.entries(templateCategories.template_categories || {}).map(([key, category]) => (
                    <label key={key} className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all ${
                      config.category === key && !config.isCustom
                        ? 'border-primary-500/30 bg-primary-500/[0.06]'
                        : 'border-white/[0.06] hover:border-white/[0.1] hover:bg-white/[0.02]'
                    }`}>
                      <input type="radio" name="nucleiCategory" value={key} checked={config.category === key}
                        onChange={(e) => setConfig(prev => ({ ...prev, category: e.target.value, isCustom: false }))}
                        className={`mt-1 mr-3 ${checkboxClass}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-300">{category.name}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">{category.description}</div>
                        <div className="text-[11px] text-gray-600 mt-1">{category.template_count} templates · {category.estimated_time}</div>
                      </div>
                    </label>
                  ))}
                  <label className={`flex items-start p-3 border-2 rounded-lg cursor-pointer transition-all ${
                    config.isCustom
                      ? 'border-primary-500/40 bg-primary-500/[0.08]'
                      : 'border-white/[0.08] hover:border-primary-500/20 hover:bg-white/[0.02]'
                  }`}>
                    <input type="radio" name="nucleiCategory" value="custom" checked={config.isCustom}
                      onChange={() => setConfig(prev => ({ ...prev, isCustom: true, category: 'custom' }))}
                      className={`mt-1 mr-3 ${checkboxClass}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-300">Custom Configuration</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">Manually specify templates, tags, and advanced options</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <h4 className={sectionTitle}>Quick Presets</h4>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { label: 'Fast Security Check', desc: 'Quick scan for critical vulnerabilities only', preset: { category: 'quick_scan', customSeverity: ['high', 'critical'], rateLimit: 150, timeout: 10, threads: 25, isCustom: false } },
                    { label: 'Web Application Focus', desc: 'Comprehensive web app security testing', preset: { category: 'web_app', customSeverity: ['medium', 'high', 'critical'], rateLimit: 100, timeout: 15, threads: 20, isCustom: false } },
                    { label: 'CVE Vulnerability Scan', desc: 'Focus on known CVE vulnerabilities', preset: { category: 'cve_only', customSeverity: ['medium', 'high', 'critical'], rateLimit: 200, timeout: 8, threads: 30, isCustom: false } },
                    { label: 'Deep Security Audit', desc: 'Comprehensive scan with all templates (slow)', preset: { category: 'comprehensive', customSeverity: ['info', 'low', 'medium', 'high', 'critical'], rateLimit: 50, timeout: 20, threads: 15, isCustom: false } },
                  ].map(({ label, desc, preset }) => (
                    <button key={label} onClick={() => setConfig(prev => ({ ...prev, ...preset }))}
                      className="p-3 text-left border border-white/[0.06] rounded-lg hover:border-white/[0.1] hover:bg-white/[0.02] transition-all">
                      <div className="text-sm font-medium text-gray-300">{label}</div>
                      <div className="text-[11px] text-gray-500">{desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Template Selection (custom mode) */}
              {config.isCustom && (
                <div className="animate-fade-in">
                  <h4 className={sectionTitle}>Template Selection</h4>
                  <div className="space-y-4">
                    <div>
                      <label className={fieldLabel}>Custom Templates (comma-separated paths)</label>
                      <input type="text" value={config.customTemplates.join(', ')}
                        onChange={(e) => setConfig(prev => ({ ...prev, customTemplates: e.target.value.split(',').map(t => t.trim()).filter(t => t) }))}
                        placeholder="e.g., /path/to/template.yaml, cves/2023"
                        className={inputClass} />
                      <p className={fieldHint}>Leave empty to use tags instead</p>
                    </div>
                    <div>
                      <label className={fieldLabel}>Include Tags (comma-separated)</label>
                      <input type="text" value={config.customTags.join(', ')}
                        onChange={(e) => setConfig(prev => ({ ...prev, customTags: e.target.value.split(',').map(t => t.trim()).filter(t => t) }))}
                        placeholder="e.g., cve, xss, sqli, lfi"
                        className={inputClass} />
                    </div>
                    <div>
                      <label className={fieldLabel}>Exclude Tags (comma-separated)</label>
                      <input type="text" value={config.excludeTags.join(', ')}
                        onChange={(e) => setConfig(prev => ({ ...prev, excludeTags: e.target.value.split(',').map(t => t.trim()).filter(t => t) }))}
                        placeholder="e.g., dos, intrusive"
                        className={inputClass} />
                    </div>
                  </div>
                </div>
              )}

              {/* Severity Configuration */}
              <div>
                <h4 className={sectionTitle}>Severity Configuration</h4>
                <div className="space-y-4">
                  <div>
                    <label className={fieldLabel}>Include Severity Levels</label>
                    <div className="flex flex-wrap gap-2">
                      {['critical', 'high', 'medium', 'low', 'info'].map(sev => (
                        <label key={sev} className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg cursor-pointer transition-all ${
                          config.customSeverity.includes(sev)
                            ? 'border-primary-500/30 bg-primary-500/[0.06]'
                            : 'border-white/[0.06] hover:border-white/[0.1] hover:bg-white/[0.02]'
                        }`}>
                          <input type="checkbox" checked={config.customSeverity.includes(sev)}
                            onChange={(e) => {
                              setConfig(prev => ({
                                ...prev,
                                customSeverity: e.target.checked
                                  ? [...prev.customSeverity, sev]
                                  : prev.customSeverity.filter(s => s !== sev)
                              }));
                            }}
                            className={checkboxClass} />
                          <span className="text-xs text-gray-300 capitalize">{sev}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={fieldLabel}>Exclude Severity Levels</label>
                    <div className="flex flex-wrap gap-2">
                      {['critical', 'high', 'medium', 'low', 'info'].map(sev => (
                        <label key={sev} className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg cursor-pointer transition-all ${
                          config.excludeSeverity.includes(sev)
                            ? 'border-red-500/30 bg-red-500/[0.06]'
                            : 'border-white/[0.06] hover:border-white/[0.1] hover:bg-white/[0.02]'
                        }`}>
                          <input type="checkbox" checked={config.excludeSeverity.includes(sev)}
                            onChange={(e) => {
                              setConfig(prev => ({
                                ...prev,
                                excludeSeverity: e.target.checked
                                  ? [...prev.excludeSeverity, sev]
                                  : prev.excludeSeverity.filter(s => s !== sev)
                              }));
                            }}
                            className={checkboxClass} />
                          <span className="text-xs text-gray-300 capitalize">{sev}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Performance & Advanced */}
            <div className="space-y-6">
              {/* Performance Settings */}
              <div>
                <h4 className={sectionTitle}>Performance Settings</h4>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className={fieldLabel}>Rate Limit (requests/second)</label>
                    <input type="number" value={config.rateLimit}
                      onChange={(e) => setConfig(prev => ({ ...prev, rateLimit: parseInt(e.target.value) || 150 }))}
                      className={inputClass} min="1" max="1000" />
                    <p className={fieldHint}>Higher values = faster scans but more aggressive</p>
                  </div>
                  <div>
                    <label className={fieldLabel}>Timeout (seconds)</label>
                    <input type="number" value={config.timeout}
                      onChange={(e) => setConfig(prev => ({ ...prev, timeout: parseInt(e.target.value) || 10 }))}
                      className={inputClass} min="1" max="300" />
                  </div>
                  <div>
                    <label className={fieldLabel}>Threads</label>
                    <input type="number" value={config.threads}
                      onChange={(e) => setConfig(prev => ({ ...prev, threads: parseInt(e.target.value) || 25 }))}
                      className={inputClass} min="1" max="100" />
                  </div>
                </div>
              </div>

              {/* Target Settings */}
              <div>
                <h4 className={sectionTitle}>Target Settings</h4>
                <div>
                  <label className={fieldLabel}>Custom Ports (comma-separated)</label>
                  <input type="text" value={config.customPorts}
                    onChange={(e) => setConfig(prev => ({ ...prev, customPorts: e.target.value, ports: e.target.value.split(',').map(p => p.trim()).filter(p => p) }))}
                    placeholder="e.g., 80,443,8080,8443"
                    className={inputClass} />
                  <p className={fieldHint}>Leave empty to scan all common ports</p>
                </div>
              </div>

              {/* Advanced Options */}
              <div>
                <h4 className={sectionTitle}>Advanced Options</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                    <div>
                      <label className="text-sm text-gray-300">Follow Redirects</label>
                      <p className={fieldHint}>Automatically follow HTTP redirects</p>
                    </div>
                    <input type="checkbox" checked={config.followRedirects}
                      onChange={(e) => setConfig(prev => ({ ...prev, followRedirects: e.target.checked }))}
                      className={checkboxClass} />
                  </div>
                  <div>
                    <label className={fieldLabel}>Max Redirects</label>
                    <input type="number" value={config.maxRedirects}
                      onChange={(e) => setConfig(prev => ({ ...prev, maxRedirects: parseInt(e.target.value) || 10 }))}
                      className={inputClass} min="0" max="50" />
                  </div>
                  <div>
                    <label className={fieldLabel}>Retries</label>
                    <input type="number" value={config.retries}
                      onChange={(e) => setConfig(prev => ({ ...prev, retries: parseInt(e.target.value) || 1 }))}
                      className={inputClass} min="0" max="5" />
                  </div>
                  <div>
                    <label className={fieldLabel}>Custom User Agent</label>
                    <input type="text" value={config.userAgent}
                      onChange={(e) => setConfig(prev => ({ ...prev, userAgent: e.target.value }))}
                      placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                      className={inputClass} />
                  </div>
                </div>
              </div>

              {/* Output Options */}
              <div>
                <h4 className={sectionTitle}>Output Options</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                    <div>
                      <label className="text-sm text-gray-300">Verbose Output</label>
                      <p className={fieldHint}>Show detailed scan information</p>
                    </div>
                    <input type="checkbox" checked={config.verbose}
                      onChange={(e) => setConfig(prev => ({ ...prev, verbose: e.target.checked }))}
                      className={checkboxClass} />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                    <div>
                      <label className="text-sm text-gray-300">Silent Mode</label>
                      <p className={fieldHint}>Minimize output verbosity</p>
                    </div>
                    <input type="checkbox" checked={config.silent}
                      onChange={(e) => setConfig(prev => ({ ...prev, silent: e.target.checked }))}
                      className={checkboxClass} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Validation Section */}
        {(() => {
          const validation = validateConfig();
          if (validation.errors.length > 0 || validation.warnings.length > 0) {
            return (
              <div className="px-6 py-4 border-t border-white/[0.06] bg-white/[0.02] flex-shrink-0">
                {validation.errors.length > 0 && (
                  <div className="mb-3">
                    <h5 className="text-xs font-medium text-red-400 mb-2">Configuration Errors</h5>
                    <ul className="text-xs text-red-300/80 space-y-1">
                      {validation.errors.map((error, i) => (
                        <li key={i} className="flex items-start"><span className="mr-2 text-red-500">•</span><span>{error}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
                {validation.warnings.length > 0 && (
                  <div>
                    <h5 className="text-xs font-medium text-amber-400 mb-2">Warnings</h5>
                    <ul className="text-xs text-amber-300/80 space-y-1">
                      {validation.warnings.map((warning, i) => (
                        <li key={i} className="flex items-start"><span className="mr-2 text-amber-500">•</span><span>{warning}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          }
          return null;
        })()}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06] flex-shrink-0">
          <div className="text-xs text-gray-500">
            <span className="text-gray-400 font-medium">Config:</span> {config.isCustom ? 'Custom' : templateCategories.template_categories?.[config.category]?.name} · 
            Severity: {config.customSeverity.join(', ')} · 
            Rate: {config.rateLimit} req/s
          </div>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="px-4 py-2 border border-white/[0.08] text-gray-400 hover:text-gray-200 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-sm transition-colors">Cancel</button>
            <button onClick={() => {
              const validation = validateConfig();
              if (validation.errors.length === 0) onClose();
            }}
              className="px-5 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-primary-500/20">Apply Configuration</button>
          </div>
        </div>
      </div>
    </div>
  );
}
