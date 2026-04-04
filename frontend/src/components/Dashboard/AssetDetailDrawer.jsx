import React, { useState } from 'react';
import { X, Globe, Server, Shield, Tag, ChevronDown, ChevronRight, Wifi, Code } from 'lucide-react';

function StatusBadge({ code }) {
  if (!code) return <span className="text-xs text-gray-600">—</span>;
  const cls =
    code >= 200 && code < 300 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
    code >= 300 && code < 400 ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
    code >= 400 && code < 500 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
    code >= 500                ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                  'bg-white/[0.04] text-gray-500 border-white/[0.06]';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-medium font-mono border ${cls}`}>
      {code}
    </span>
  );
}

function ScriptBlock({ id, output }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/[0.06] rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-left"
      >
        {open
          ? <ChevronDown className="h-3 w-3 text-gray-500 flex-shrink-0" />
          : <ChevronRight className="h-3 w-3 text-gray-500 flex-shrink-0" />}
        <Code className="h-3 w-3 text-purple-400 flex-shrink-0" />
        <span className="text-xs font-mono text-purple-300">{id}</span>
      </button>
      {open && (
        <pre className="px-3 pb-3 pt-1 text-[11px] text-gray-400 font-mono whitespace-pre-wrap break-all overflow-auto max-h-60 bg-black/20">
          {output || '(no output)'}
        </pre>
      )}
    </div>
  );
}

export default function AssetDetailDrawer({ asset, onClose }) {
  if (!asset) return null;

  const portDetails = asset.port_details || [];
  const plainPorts = asset.ports || [];

  // If we have no rich port details but have plain ports, synthesise basic rows
  const rows = portDetails.length > 0
    ? portDetails
    : plainPorts.map(p => ({ port: p, protocol: 'tcp', service: null, product: null, version: null, extrainfo: null, scripts: [] }));

  const allScripts = rows.flatMap(r => (r.scripts || []).map(s => ({ ...s, port: r.port })));

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-[#0f1623] border-l border-white/[0.06] shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/20 flex-shrink-0">
              <Globe className="h-4 w-4 text-blue-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-100 font-mono truncate">{asset.domain || asset.hostname}</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">Asset details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 space-y-1">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium flex items-center gap-1.5">
                <Server className="h-3 w-3" /> IP Address
              </p>
              <div className="space-y-0.5">
                {asset.ip_addresses && asset.ip_addresses.length > 0
                  ? asset.ip_addresses.map(ip => (
                      <p key={ip} className="text-sm font-mono text-gray-300">{ip}</p>
                    ))
                  : <p className="text-sm text-gray-600">—</p>}
              </div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 space-y-1">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">HTTP Status</p>
              <div className="flex items-center gap-2">
                <StatusBadge code={asset.status_code} />
                {asset.webserver && (
                  <span className="text-xs text-gray-500 truncate">{asset.webserver}</span>
                )}
              </div>
              {asset.title && (
                <p className="text-[11px] text-gray-400 truncate" title={asset.title}>{asset.title}</p>
              )}
            </div>
            {asset.primary_url && (
              <div className="col-span-2 bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 space-y-1">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">URL</p>
                <a
                  href={asset.primary_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 font-mono truncate block transition-colors"
                >
                  {asset.primary_url}
                </a>
              </div>
            )}
            {asset.technologies && asset.technologies.length > 0 && (
              <div className="col-span-2 bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 space-y-1.5">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium flex items-center gap-1.5">
                  <Shield className="h-3 w-3" /> Technologies
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {asset.technologies.map(tech => (
                    <span key={tech} className="px-2 py-0.5 text-[11px] bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-md">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {asset.tags && asset.tags.length > 0 && (
              <div className="col-span-2 bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 space-y-1.5">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium flex items-center gap-1.5">
                  <Tag className="h-3 w-3" /> Tags
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {asset.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 text-[11px] bg-white/[0.04] border border-white/[0.06] text-gray-400 rounded-md">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Port details table */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-3">
              <Wifi className="h-3.5 w-3.5 text-blue-400" />
              Open Ports
              <span className="ml-auto text-gray-600 normal-case font-normal">{rows.length} port{rows.length !== 1 ? 's' : ''}</span>
            </h3>
            {rows.length === 0 ? (
              <div className="text-center py-8 text-gray-600 text-sm border border-white/[0.04] rounded-xl">
                No open ports found
              </div>
            ) : (
              <div className="border border-white/[0.06] rounded-xl overflow-hidden">
                <table className="min-w-full text-xs">
                  <thead className="bg-white/[0.03] border-b border-white/[0.06]">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider w-16">Port</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider w-14">Proto</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider w-24">Service</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Product / Version</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {rows.map((row, idx) => {
                      const productVersion = [row.product, row.version, row.extrainfo]
                        .filter(Boolean)
                        .join(' ');
                      return (
                        <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-3 py-2 font-mono font-bold text-blue-400">{row.port}</td>
                          <td className="px-3 py-2 font-mono text-gray-500">{row.protocol}</td>
                          <td className="px-3 py-2 font-mono text-emerald-400">{row.service || '—'}</td>
                          <td className="px-3 py-2 text-gray-300">
                            {productVersion || <span className="text-gray-600">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* NSE script output */}
          {allScripts.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-3">
                <Code className="h-3.5 w-3.5 text-purple-400" />
                NSE Script Results
                <span className="ml-auto text-gray-600 normal-case font-normal">{allScripts.length} script{allScripts.length !== 1 ? 's' : ''}</span>
              </h3>
              <div className="space-y-2">
                {allScripts.map((s, idx) => (
                  <div key={idx} className="space-y-1">
                    <p className="text-[10px] text-gray-600 font-mono">port {s.port}</p>
                    <ScriptBlock id={s.id} output={s.output} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
