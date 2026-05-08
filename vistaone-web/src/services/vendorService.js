import { authFetch } from "./apiClient";

const VENDOR_ENDPOINT = "/vendors";

async function parseError(res, fallback) {
  const data = await res.json().catch(() => ({}));
  throw new Error(data?.message || fallback);
}

export const vendorService = {
  getAll: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.append("status", params.status);
    if (params.compliance) query.append("compliance", params.compliance);
    const qs = query.toString();
    const url = qs ? `${VENDOR_ENDPOINT}?${qs}` : VENDOR_ENDPOINT;
    const response = await authFetch(url, { method: "GET" });
    if (!response.ok) await parseError(response, "Failed to fetch vendors");
    return await response.json();
  },

  search: async ({
    q = "",
    service_id = "",
    status = "",
    compliance = "",
    scope = "",
    sort_by = "company_name",
    order = "asc",
    page = 1,
    per_page = 30,
  } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (service_id) params.set("service_id", service_id);
    if (status) params.set("status", status);
    if (compliance) params.set("compliance", compliance);
    if (scope) params.set("scope", scope);
    params.set("sort_by", sort_by);
    params.set("order", order);
    params.set("page", String(page));
    params.set("per_page", String(per_page));
    const response = await authFetch(
      `${VENDOR_ENDPOINT}/search?${params.toString()}`,
      { method: "GET" }
    );
    if (!response.ok) await parseError(response, "Failed to search vendors");
    return await response.json();
  },

  listServices: async () => {
    const response = await authFetch(`${VENDOR_ENDPOINT}/services`, {
      method: "GET",
    });
    if (!response.ok)
      await parseError(response, "Failed to load service types");
    return await response.json();
  },

  getById: async (vendorId) => {
    const response = await authFetch(`${VENDOR_ENDPOINT}/${vendorId}`, { method: "GET" });
    if (!response.ok) await parseError(response, "Failed to fetch vendor");
    return await response.json();
  },

  create: async (data) => {
    const response = await authFetch(VENDOR_ENDPOINT, {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!response.ok) await parseError(response, "Failed to create vendor");
    return await response.json();
  },

  update: async (vendorId, data) => {
    const response = await authFetch(`${VENDOR_ENDPOINT}/${vendorId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    if (!response.ok) await parseError(response, "Failed to update vendor");
    return await response.json();
  },

  getFavorites: async (clientId) => {
    const response = await authFetch(`${VENDOR_ENDPOINT}/favorites/${clientId}`, { method: "GET" });
    if (!response.ok) await parseError(response, "Failed to fetch favorites");
    return await response.json();
  },

  addFavorite: async (clientId, vendorId) => {
    const response = await authFetch(`${VENDOR_ENDPOINT}/favorites`, {
      method: "POST",
      body: JSON.stringify({ client_id: clientId, vendor_id: vendorId }),
    });
    if (!response.ok) await parseError(response, "Failed to add favorite");
    return await response.json();
  },

  removeFavorite: async (clientId, vendorId) => {
    const response = await authFetch(
      `${VENDOR_ENDPOINT}/favorites/${clientId}/${vendorId}`,
      { method: "DELETE" }
    );
    if (!response.ok) await parseError(response, "Failed to remove favorite");
    return await response.json();
  },
};
