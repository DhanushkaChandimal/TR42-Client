import { authFetch } from "./apiClient";
const VENDOR_ENDPOINT = "/vendors";

export const vendorService = {
  getAll: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.append("status", params.status);
    if (params.compliance) query.append("compliance", params.compliance);
    const qs = query.toString();
    const url = qs ? `${VENDOR_ENDPOINT}?${qs}` : VENDOR_ENDPOINT;
    const response = await authFetch(url, { method: "GET" });
    if (!response.ok) {
      throw new Error("Failed to fetch vendors");
    }
    return await response.json();
  },

  getById: async (vendorId) => {
    const response = await authFetch(`${VENDOR_ENDPOINT}/${vendorId}`, {
      method: "GET",
    });
    if (!response.ok) {
      throw new Error("Failed to fetch vendor");
    }
    return await response.json();
  },

  create: async (data) => {
    const response = await authFetch(VENDOR_ENDPOINT, {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error("Failed to create vendor");
    }
    return await response.json();
  },

  update: async (vendorId, data) => {
    const response = await authFetch(`${VENDOR_ENDPOINT}/${vendorId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error("Failed to update vendor");
    }
    return await response.json();
  },

  getFavorites: async (clientId) => {
    const response = await authFetch(`${VENDOR_ENDPOINT}/favorites/${clientId}`, {
      method: "GET",
    });
    if (!response.ok) throw new Error("Failed to fetch favorites");
    return await response.json();
  },

  addFavorite: async (clientId, vendorId) => {
    const response = await authFetch(`${VENDOR_ENDPOINT}/favorites`, {
      method: "POST",
      body: JSON.stringify({ client_id: clientId, vendor_id: vendorId }),
    });
    if (!response.ok) throw new Error("Failed to add favorite");
    return await response.json();
  },

  removeFavorite: async (clientId, vendorId) => {
    const response = await authFetch(
      `${VENDOR_ENDPOINT}/favorites/${clientId}/${vendorId}`,
      { method: "DELETE" }
    );
    if (!response.ok) throw new Error("Failed to remove favorite");
    return await response.json();
  },
};
