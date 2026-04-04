import { useSearchParams } from "react-router-dom";
import { useCallback, useMemo } from "react";

const ARRAY_KEYS = ["severities", "triage_statuses", "tags"];
const SCALAR_KEYS = ["search", "hostname", "template_id", "sort_by", "sort_order", "group_by", "page", "page_size"];

/**
 * Reads/writes all vulnerability filter state from URL search params.
 * Array filters are stored as comma-separated values.
 */
export default function useVulnFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => {
    const result = {};
    for (const key of SCALAR_KEYS) {
      result[key] = searchParams.get(key) || "";
    }
    for (const key of ARRAY_KEYS) {
      const raw = searchParams.get(key) || "";
      result[key] = raw ? raw.split(",").filter(Boolean) : [];
    }
    // Defaults
    result.page = parseInt(result.page, 10) || 1;
    result.page_size = parseInt(result.page_size, 10) || 50;
    result.sort_by = result.sort_by || "severity";
    result.sort_order = result.sort_order || "desc";
    result.group_by = result.group_by || "none";
    return result;
  }, [searchParams]);

  const setFilter = useCallback(
    (key, value) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (Array.isArray(value)) {
          if (value.length === 0) next.delete(key);
          else next.set(key, value.join(","));
        } else if (!value || value === "") {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
        // Reset to page 1 when filters change (unless changing page itself)
        if (key !== "page") next.set("page", "1");
        return next;
      });
    },
    [setSearchParams]
  );

  const toggleArrayFilter = useCallback(
    (key, value) => {
      const current = filters[key] || [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      setFilter(key, next);
    },
    [filters, setFilter]
  );

  const clearFilter = useCallback(
    (key) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete(key);
        if (key !== "page") next.set("page", "1");
        return next;
      });
    },
    [setSearchParams]
  );

  const clearAll = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

  const hasActiveFilters = useMemo(
    () =>
      !!filters.search ||
      filters.severities.length > 0 ||
      filters.triage_statuses.length > 0 ||
      !!filters.hostname ||
      !!filters.template_id ||
      filters.tags.length > 0,
    [filters]
  );

  return {
    filters,
    setFilter,
    toggleArrayFilter,
    clearFilter,
    clearAll,
    hasActiveFilters,
  };
}
