/**
 * Centralised API client — every fetch goes through here so we get
 * consistent credentials, error handling, and a single place to add
 * interceptors later (auth refresh, request IDs, etc.).
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL;

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function request(path, options = {}) {
  const { body, method = body ? "POST" : "GET", headers: extraHeaders, ...rest } = options;

  const headers = { ...extraHeaders };
  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "include",
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    ...rest,
  });

  // For blob downloads, return raw response
  if (options.responseType === "blob") {
    if (!res.ok) throw new ApiError("Download failed", res.status);
    return res.blob();
  }

  // No-content responses (204, etc.)
  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(data?.detail || res.statusText, res.status, data);
  }

  return data;
}

// Convenience helpers
export const api = {
  get: (path, opts) => request(path, { method: "GET", ...opts }),
  post: (path, body, opts) => request(path, { method: "POST", body, ...opts }),
  put: (path, body, opts) => request(path, { method: "PUT", body, ...opts }),
  patch: (path, body, opts) => request(path, { method: "PATCH", body, ...opts }),
  del: (path, opts) => request(path, { method: "DELETE", ...opts }),
};

export { ApiError };
export default api;
