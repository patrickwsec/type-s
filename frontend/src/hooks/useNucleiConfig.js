import { useState, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

/**
 * Hook for Nuclei template/severity/performance configuration.
 * @param {Function} showNotification
 * @returns nuclei config state + validation + loader
 */
export function useNucleiConfig(showNotification) {
  const [showNucleiConfig, setShowNucleiConfig] = useState(false);
  const [nucleiConfig, setNucleiConfig] = useState({
    category: 'quick_scan',
    customTags: [],
    customTemplates: [],
    excludeTags: [],
    excludeSeverity: [],
    customSeverity: ['medium', 'high', 'critical'],
    rateLimit: 150,
    timeout: 10,
    threads: 25,
    ports: [],
    customPorts: '',
    followRedirects: true,
    maxRedirects: 10,
    retries: 1,
    userAgent: '',
    customHeaders: [],
    verbose: false,
    silent: false,
    noColor: false,
    isCustom: false
  });
  const [templateCategories, setTemplateCategories] = useState({});

  const validateNucleiConfig = useCallback(() => {
    const errors = [];
    const warnings = [];

    if (nucleiConfig.isCustom) {
      if (nucleiConfig.customTags.length === 0 && nucleiConfig.customTemplates.length === 0) {
        errors.push("Custom configuration requires either tags or templates to be specified");
      }
    }
    if (nucleiConfig.customSeverity.length === 0) {
      errors.push("At least one severity level must be selected");
    }
    const hasExcludedSeverity = nucleiConfig.excludeSeverity.some(s => nucleiConfig.customSeverity.includes(s));
    if (hasExcludedSeverity) {
      warnings.push("Some severity levels are both included and excluded");
    }
    if (nucleiConfig.rateLimit > 500) {
      warnings.push("High rate limit may cause aggressive scanning");
    }
    if (nucleiConfig.threads > 50) {
      warnings.push("High thread count may impact system performance");
    }
    if (nucleiConfig.timeout > 60) {
      warnings.push("Long timeout may significantly slow down the scan");
    }
    return { errors, warnings };
  }, [nucleiConfig]);

  const loadNucleiTemplates = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/nuclei/templates`, { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setTemplateCategories(data);
      }
    } catch (error) {
      console.error("Error loading nuclei templates:", error);
    }
  }, []);

  return {
    showNucleiConfig, setShowNucleiConfig,
    nucleiConfig, setNucleiConfig,
    templateCategories,
    validateNucleiConfig,
    loadNucleiTemplates,
  };
}
