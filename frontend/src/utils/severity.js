/**
 * Severity-related utility functions for vulnerability display.
 */

/**
 * Returns Tailwind class string for a severity badge.
 * @param {string} severity - Severity level (critical, high, medium, low, info)
 * @returns {string} Tailwind class string
 */
export const getSeverityColor = (severity) => {
  switch (severity?.toLowerCase()) {
    case 'critical': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
    case 'high': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200';
    case 'medium': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
    case 'low': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200';
    case 'info': return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
    default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
  }
};

/**
 * Summarize vulnerabilities by severity, returning sorted counts.
 * @param {Array} vulnerabilities - Array of vulnerability objects
 * @returns {Array<{severity: string, count: number}>} Sorted severity summary
 */
export const summarizeVulnerabilities = (vulnerabilities) => {
  if (!vulnerabilities || vulnerabilities.length === 0) return [];

  const severityCounts = {};
  vulnerabilities.forEach(vuln => {
    const severity = vuln.severity?.toLowerCase() || 'unknown';
    severityCounts[severity] = (severityCounts[severity] || 0) + 1;
  });

  const severityOrder = ['critical', 'high', 'medium', 'low', 'info', 'unknown'];
  return severityOrder
    .filter(severity => severityCounts[severity] > 0)
    .map(severity => ({ severity, count: severityCounts[severity] }));
};
