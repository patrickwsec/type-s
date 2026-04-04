import React from 'react';
import { Badge, Button } from '../ui';
import { Bug, X } from 'lucide-react';
import { getSeverityColor } from '../../utils/severity';

/**
 * Modal showing detailed vulnerability information.
 */
export default function VulnDetailModal({ show, vulnerability, onClose }) {
  if (!show || !vulnerability) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111827]/95 backdrop-blur-md border border-white/[0.06] rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
              <Bug className="h-5 w-5 text-red-400" />
              Vulnerability Details
            </h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 p-1 rounded-lg hover:bg-white/[0.06] transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        <div className="px-6 py-5 overflow-y-auto max-h-[70vh]">
          <div className="space-y-5">
            {/* Header */}
            <div>
              <h4 className="text-base font-semibold text-gray-200 mb-2">
                {vulnerability.name || 'Unknown Vulnerability'}
              </h4>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={getSeverityColor(vulnerability.severity)}>
                  {vulnerability.severity?.toUpperCase() || 'UNKNOWN'}
                </Badge>
                {vulnerability.cve && (
                  <Badge className="bg-blue-500/10 border-blue-500/20 text-blue-300">{vulnerability.cve}</Badge>
                )}
                {vulnerability.cvss && (
                  <Badge className="bg-amber-500/10 border-amber-500/20 text-amber-300">CVSS: {vulnerability.cvss}</Badge>
                )}
              </div>
            </div>

            {/* Description */}
            {vulnerability.description && (
              <div>
                <h5 className="text-xs font-medium text-gray-400 mb-2">Description</h5>
                <p className="text-sm text-gray-400 bg-white/[0.03] border border-white/[0.06] p-3 rounded-lg">
                  {vulnerability.description}
                </p>
              </div>
            )}

            {/* Technical Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-4">
                {vulnerability.template_id && (
                  <div>
                    <h5 className="text-xs font-medium text-gray-400 mb-1.5">Template ID</h5>
                    <p className="text-sm text-gray-400 font-mono bg-white/[0.03] border border-white/[0.06] p-2 rounded-lg">
                      {vulnerability.template_id}
                    </p>
                  </div>
                )}
                {vulnerability.tags && vulnerability.tags.length > 0 && (
                  <div>
                    <h5 className="text-xs font-medium text-gray-400 mb-2">Tags</h5>
                    <div className="flex flex-wrap gap-1.5">
                      {vulnerability.tags.map((tag, idx) => (
                        <Badge key={idx} className="bg-white/[0.04] border-white/[0.06] text-gray-400">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {vulnerability.author && (
                  <div>
                    <h5 className="text-xs font-medium text-gray-400 mb-1">Author</h5>
                    <p className="text-sm text-gray-400">{vulnerability.author}</p>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                {vulnerability.reference && (
                  <div>
                    <h5 className="text-xs font-medium text-gray-400 mb-1.5">References</h5>
                    <div className="space-y-1">
                      {Array.isArray(vulnerability.reference) ? (
                        vulnerability.reference.map((ref, idx) => (
                          <a key={idx} href={ref} target="_blank" rel="noopener noreferrer"
                            className="text-sm text-primary-400 hover:text-primary-300 block truncate">{ref}</a>
                        ))
                      ) : (
                        <a href={vulnerability.reference} target="_blank" rel="noopener noreferrer"
                          className="text-sm text-primary-400 hover:text-primary-300 block truncate">{vulnerability.reference}</a>
                      )}
                    </div>
                  </div>
                )}
                {vulnerability.classification && (
                  <div>
                    <h5 className="text-xs font-medium text-gray-400 mb-1">Classification</h5>
                    <p className="text-sm text-gray-400">{vulnerability.classification}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Matched At */}
            {vulnerability.matched_at && (
              <div>
                <h5 className="text-xs font-medium text-gray-400 mb-1.5">Matched At</h5>
                <p className="text-sm text-gray-400 font-mono bg-white/[0.03] border border-white/[0.06] p-2 rounded-lg">
                  {vulnerability.matched_at}
                </p>
              </div>
            )}

            {/* Extracted Results */}
            {vulnerability.extracted_results && vulnerability.extracted_results.length > 0 && (
              <div>
                <h5 className="text-xs font-medium text-gray-400 mb-2">Extracted Results</h5>
                <div className="space-y-1.5">
                  {vulnerability.extracted_results.map((result, idx) => (
                    <div key={idx} className="text-sm text-gray-400 bg-white/[0.03] border border-white/[0.06] p-2 rounded-lg font-mono">
                      {result}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Raw Response */}
            {vulnerability.response && (
              <div>
                <h5 className="text-xs font-medium text-gray-400 mb-2">Response</h5>
                <pre className="text-xs text-gray-500 bg-white/[0.03] border border-white/[0.06] p-3 rounded-lg overflow-x-auto max-h-64">
                  {typeof vulnerability.response === 'string' ? vulnerability.response : JSON.stringify(vulnerability.response, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
        
        <div className="px-6 py-4 border-t border-white/[0.06] flex justify-end">
          <Button onClick={onClose} variant="secondary">Close</Button>
        </div>
      </div>
    </div>
  );
}
