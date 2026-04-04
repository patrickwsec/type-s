import React from 'react';
import { Globe, Check, Server, Bug, Wifi } from 'lucide-react';

/**
 * Modern horizontal stats bar with gradient glow cards and severity breakdown.
 */
export default function StatsBar({ stats }) {
  const statItems = [
    {
      icon: Globe,
      value: stats.totalSubdomains,
      label: stats.assetLabel || 'Assets',
      gradient: 'from-violet-500/20 to-purple-600/10',
      glow: 'shadow-[0_0_20px_rgba(139,92,246,0.08)]',
      iconBg: 'bg-violet-500/15 border border-violet-500/20',
      iconColor: 'text-violet-400',
      valueColor: 'text-violet-300',
    },
    {
      icon: Wifi,
      value: stats.liveHosts,
      label: 'Live',
      gradient: 'from-emerald-500/20 to-green-600/10',
      glow: 'shadow-[0_0_20px_rgba(16,185,129,0.08)]',
      iconBg: 'bg-emerald-500/15 border border-emerald-500/20',
      iconColor: 'text-emerald-400',
      valueColor: 'text-emerald-300',
    },
    {
      icon: Server,
      value: stats.totalPorts,
      label: 'Ports',
      gradient: 'from-blue-500/20 to-cyan-600/10',
      glow: 'shadow-[0_0_20px_rgba(59,130,246,0.08)]',
      iconBg: 'bg-blue-500/15 border border-blue-500/20',
      iconColor: 'text-blue-400',
      valueColor: 'text-blue-300',
    },
  ];

  const severityBadges = [
    { key: 'criticalVulns', label: 'C', fullLabel: 'Critical', value: stats.criticalVulns, bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/25', dot: 'bg-red-400' },
    { key: 'highVulns', label: 'H', fullLabel: 'High', value: stats.highVulns, bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/25', dot: 'bg-orange-400' },
    { key: 'mediumVulns', label: 'M', fullLabel: 'Medium', value: stats.mediumVulns, bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/25', dot: 'bg-yellow-400' },
    { key: 'lowVulns', label: 'L', fullLabel: 'Low', value: stats.lowVulns, bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/25', dot: 'bg-sky-400' },
    { key: 'infoVulns', label: 'I', fullLabel: 'Info', value: stats.infoVulns, bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/25', dot: 'bg-gray-400' },
  ];

  const hasVulns = stats.totalVulnerabilities > 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {/* Core stat cards */}
      {statItems.map(({ icon: Icon, value, label, gradient, glow, iconBg, iconColor, valueColor }) => (
        <div
          key={label}
          className={`group relative overflow-hidden rounded-xl bg-gradient-to-br ${gradient} border border-white/[0.06] ${glow} hover:border-white/[0.12] transition-all duration-300`}
        >
          {/* Subtle background pattern */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.03),transparent_60%)]" />
          <div className="relative flex items-center gap-3 px-4 py-4">
            <div className={`p-2.5 rounded-xl ${iconBg}`}>
              <Icon className={`h-4.5 w-4.5 ${iconColor}`} />
            </div>
            <div>
              <div className={`text-2xl font-bold ${valueColor} font-mono tabular-nums tracking-tight`}>
                {typeof value === 'number' ? value.toLocaleString() : value}
              </div>
              <div className="text-[11px] text-gray-500 font-medium tracking-wide uppercase">{label}</div>
            </div>
          </div>
        </div>
      ))}

      {/* Vulnerability card — richer layout */}
      <div
        className={`group relative overflow-hidden rounded-xl border transition-all duration-300 ${
          hasVulns
            ? 'bg-gradient-to-br from-red-500/15 to-orange-600/10 border-red-500/15 shadow-[0_0_20px_rgba(239,68,68,0.06)] hover:border-red-500/25'
            : 'bg-gradient-to-br from-gray-500/10 to-gray-600/5 border-white/[0.06] hover:border-white/[0.12]'
        }`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.03),transparent_60%)]" />
        <div className="relative px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl border ${hasVulns ? 'bg-red-500/15 border-red-500/20' : 'bg-white/[0.04] border-white/[0.06]'}`}>
                <Bug className={`h-4.5 w-4.5 ${hasVulns ? 'text-red-400' : 'text-gray-500'}`} />
              </div>
              <div>
                <div className={`text-2xl font-bold font-mono tabular-nums tracking-tight ${hasVulns ? 'text-red-400' : 'text-gray-500'}`}>
                  {stats.totalVulnerabilities.toLocaleString()}
                </div>
                <div className="text-[11px] text-gray-500 font-medium tracking-wide uppercase">Vulns</div>
              </div>
            </div>
          </div>

          {/* Severity breakdown bar */}
          {hasVulns && (
            <div className="flex gap-1 mt-1">
              {severityBadges.filter(b => b.value > 0).map(b => (
                <div
                  key={b.key}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md ${b.bg} border ${b.border}`}
                  title={`${b.value} ${b.fullLabel}`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${b.dot}`} />
                  <span className={`text-[10px] font-bold font-mono ${b.text}`}>{b.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
