import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Bug,
  AlertTriangle,
  Info,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Tag,
  Globe,
  FileCode,
} from "lucide-react";
import { Badge, Select } from "../ui";

const severityVariant = { critical: "danger", high: "warning", medium: "warning", low: "info", info: "default" };
const severityColors = {
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
  high: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  low: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  info: "text-gray-400 bg-gray-500/10 border-gray-500/20",
};
const severityIcon = { critical: Bug, high: AlertTriangle, medium: AlertTriangle, low: Info, info: Info };
const triageVariant = { new: "default", acknowledged: "info", in_progress: "warning", resolved: "success", false_positive: "danger" };
const triageOptions = [
  { value: "new", label: "New" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "false_positive", label: "False Positive" },
];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] transition-colors"
      title="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function CollapsibleSection({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-gray-200 dark:border-white/[0.06]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors"
      >
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</h4>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-4">{children}</div>}
    </div>
  );
}

export default function VulnDetailPanel({ finding, onClose, onUpdateTriage, isUpdating }) {
  if (!finding) return null;

  const sev = finding.severity?.toLowerCase() || "info";
  const triage = finding.triage_status || "new";
  const Icon = severityIcon[sev] || Info;

  // Keyboard nav
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="h-full flex flex-col border-l border-gray-200 dark:border-white/[0.06] bg-white dark:bg-gray-900/95">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200 dark:border-white/[0.06] flex-shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <div className={`p-1.5 rounded-lg border ${severityColors[sev]}`}>
              <Icon className="h-4 w-4" />
            </div>
            <Badge variant={severityVariant[sev]}>{sev}</Badge>
            <Badge variant={triageVariant[triage]}>{triage.replace(/_/g, " ")}</Badge>
          </div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white leading-tight">
            {finding.title || "Untitled Finding"}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors flex-shrink-0"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Triage selector */}
        <div className="px-5 py-3 border-b border-gray-200 dark:border-white/[0.06]">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-14">Triage</span>
            <div className="flex-1 max-w-[200px]">
              <Select
                value={triage}
                onChange={(e) => onUpdateTriage(finding.id, e.target.value)}
                options={triageOptions}
                placeholder=""
                disabled={isUpdating}
              />
            </div>
          </div>
        </div>

        {/* Description */}
        {finding.description && (
          <div className="px-5 py-4 border-b border-gray-200 dark:border-white/[0.06]">
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Description</h4>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
              {finding.description}
            </p>
          </div>
        )}

        {/* Details grid */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-white/[0.06]">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Details</h4>
          <div className="space-y-2.5">
            {[
              { icon: Globe, label: "Host", value: finding.asset_hostname },
              { icon: ExternalLink, label: "Matched At", value: finding.matched_at },
              { icon: FileCode, label: "Template", value: finding.template_id },
              { label: "Matcher", value: finding.matcher_name },
              { icon: Clock, label: "First Seen", value: finding.first_seen_at ? new Date(finding.first_seen_at).toLocaleString() : null },
              { icon: Clock, label: "Last Seen", value: finding.last_seen_at ? new Date(finding.last_seen_at).toLocaleString() : null },
              { label: "Source", value: finding.source },
            ]
              .filter(({ value }) => value)
              .map(({ icon: FieldIcon, label, value }) => (
                <div key={label} className="flex items-start gap-2 text-sm">
                  <span className="text-gray-500 dark:text-gray-400 w-20 flex-shrink-0 text-xs pt-0.5">{label}</span>
                  <span className="text-gray-700 dark:text-gray-300 break-all font-mono text-xs">{value}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Tags */}
        {finding.tags?.length > 0 && (
          <div className="px-5 py-4 border-b border-gray-200 dark:border-white/[0.06]">
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Tags</h4>
            <div className="flex flex-wrap gap-1.5">
              {finding.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-white/[0.06]"
                >
                  <Tag className="h-3 w-3" />
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* References */}
        {finding.references?.length > 0 && (
          <div className="px-5 py-4 border-b border-gray-200 dark:border-white/[0.06]">
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">References</h4>
            <div className="space-y-1">
              {finding.references.map((ref, i) => (
                <a
                  key={i}
                  href={ref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-primary-400 hover:text-primary-300 truncate"
                >
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  {ref}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Extracted Results */}
        {finding.extracted_results?.length > 0 && (
          <CollapsibleSection title="Extracted Results" defaultOpen>
            <div className="space-y-1">
              {finding.extracted_results.map((r, i) => (
                <div key={i} className="flex items-start justify-between gap-2 text-xs font-mono text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-white/[0.03] p-2 rounded-lg border border-gray-200 dark:border-white/[0.06]">
                  <span className="break-all">{r}</span>
                  <CopyButton text={r} />
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* cURL Command */}
        {finding.curl_command && (
          <CollapsibleSection title="cURL Command" defaultOpen>
            <div className="relative">
              <pre className="text-xs font-mono text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-white/[0.03] p-3 rounded-lg border border-gray-200 dark:border-white/[0.06] overflow-x-auto whitespace-pre-wrap break-all pr-10">
                {finding.curl_command}
              </pre>
              <div className="absolute top-2 right-2">
                <CopyButton text={finding.curl_command} />
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* HTTP Request */}
        {finding.request && (
          <CollapsibleSection title="HTTP Request">
            <pre className="text-xs font-mono text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-white/[0.03] p-3 rounded-lg border border-gray-200 dark:border-white/[0.06] overflow-x-auto max-h-80 whitespace-pre-wrap break-all">
              {finding.request}
            </pre>
          </CollapsibleSection>
        )}

        {/* HTTP Response */}
        {finding.response && (
          <CollapsibleSection title="HTTP Response">
            <pre className="text-xs font-mono text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-white/[0.03] p-3 rounded-lg border border-gray-200 dark:border-white/[0.06] overflow-x-auto max-h-80 whitespace-pre-wrap break-all">
              {finding.response}
            </pre>
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}
