import { authFetch } from "./apiClient";
const INVOICE_ENDPOINT = "/invoices";

export const invoiceService = {
  getAll: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.vendor_id) query.append("vendor_id", params.vendor_id);
    if (params.client_id) query.append("client_id", params.client_id);
    if (params.status) query.append("status", params.status);
    const qs = query.toString();
    const url = qs ? `${INVOICE_ENDPOINT}?${qs}` : INVOICE_ENDPOINT;
    const response = await authFetch(url, { method: "GET" });
    if (!response.ok) throw new Error("Failed to fetch invoices");
    return await response.json();
  },

  getById: async (invoiceId) => {
    const response = await authFetch(`${INVOICE_ENDPOINT}/${invoiceId}`, {
      method: "GET",
    });
    if (!response.ok) throw new Error("Failed to fetch invoice");
    return await response.json();
  },

  create: async (data) => {
    const response = await authFetch(INVOICE_ENDPOINT, {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to create invoice");
    return await response.json();
  },

  update: async (invoiceId, data) => {
    const response = await authFetch(`${INVOICE_ENDPOINT}/${invoiceId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to update invoice");
    return await response.json();
  },

  approve: async (invoiceId) => {
    const response = await authFetch(
      `${INVOICE_ENDPOINT}/${invoiceId}/approve`,
      { method: "PUT" }
    );
    if (!response.ok) throw new Error("Failed to approve invoice");
    return await response.json();
  },

  reject: async (invoiceId) => {
    const response = await authFetch(
      `${INVOICE_ENDPOINT}/${invoiceId}/reject`,
      { method: "PUT" }
    );
    if (!response.ok) throw new Error("Failed to reject invoice");
    return await response.json();
  },
};
