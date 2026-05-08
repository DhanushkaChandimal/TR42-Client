import { authFetch } from "./apiClient";

const INVOICE_ENDPOINT = "/invoices";

async function parseError(res, fallback) {
  const data = await res.json().catch(() => ({}));
  throw new Error(data?.message || fallback);
}

export const invoiceService = {
  summary: async ({ q = '' } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    const qs = params.toString();
    const url = qs ? `${INVOICE_ENDPOINT}/summary?${qs}` : `${INVOICE_ENDPOINT}/summary`;
    const response = await authFetch(url, { method: 'GET' });
    if (!response.ok) await parseError(response, 'Failed to fetch invoice summary');
    return await response.json();
  },

  search: async ({ q = '', status = '', work_order_id = '', page = 1, per_page = 10, sort_by = 'created_at', order = 'desc' } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (work_order_id) params.set('work_order_id', work_order_id);
    params.set('page', String(page));
    params.set('per_page', String(per_page));
    params.set('sort_by', sort_by);
    params.set('order', order);
    const response = await authFetch(`${INVOICE_ENDPOINT}/search?${params.toString()}`, { method: 'GET' });
    if (!response.ok) await parseError(response, 'Failed to search invoices');
    return await response.json();
  },

  getAll: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.vendor_id) query.append("vendor_id", params.vendor_id);
    if (params.client_id) query.append("client_id", params.client_id);
    if (params.status) query.append("status", params.status);
    if (params.work_order_id) query.append("work_order_id", params.work_order_id);
    const qs = query.toString();
    const url = qs ? `${INVOICE_ENDPOINT}?${qs}` : INVOICE_ENDPOINT;
    const response = await authFetch(url, { method: "GET" });
    if (!response.ok) await parseError(response, "Failed to fetch invoices");
    return await response.json();
  },

  getById: async (invoiceId) => {
    const response = await authFetch(`${INVOICE_ENDPOINT}/${invoiceId}`, { method: "GET" });
    if (!response.ok) await parseError(response, "Failed to fetch invoice");
    return await response.json();
  },

  create: async (data) => {
    const response = await authFetch(INVOICE_ENDPOINT, {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!response.ok) await parseError(response, "Failed to create invoice");
    return await response.json();
  },

  update: async (invoiceId, data) => {
    const response = await authFetch(`${INVOICE_ENDPOINT}/${invoiceId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    if (!response.ok) await parseError(response, "Failed to update invoice");
    return await response.json();
  },

  approve: async (invoiceId) => {
    const response = await authFetch(`${INVOICE_ENDPOINT}/${invoiceId}/approve`, { method: "PUT" });
    if (!response.ok) await parseError(response, "Failed to approve invoice");
    return await response.json();
  },

  reject: async (invoiceId, note, recipientIds) => {
    const payload = {};
    if (note != null) payload.note = note;
    if (Array.isArray(recipientIds) && recipientIds.length) {
      payload.recipient_ids = recipientIds;
    }
    const hasBody = Object.keys(payload).length > 0;
    const response = await authFetch(`${INVOICE_ENDPOINT}/${invoiceId}/reject`, {
      method: "PUT",
      headers: hasBody ? { "Content-Type": "application/json" } : undefined,
      body: hasBody ? JSON.stringify(payload) : undefined,
    });
    if (!response.ok) await parseError(response, "Failed to reject invoice");
    return await response.json();
  },

  getNotificationRecipients: async (invoiceId) => {
    const response = await authFetch(
      `${INVOICE_ENDPOINT}/${invoiceId}/notification-recipients`,
      { method: "GET" }
    );
    if (!response.ok)
      await parseError(response, "Failed to load recipients");
    const data = await response.json();
    return data.recipients || [];
  },

  setPending: async (invoiceId) => {
    const response = await authFetch(`${INVOICE_ENDPOINT}/${invoiceId}/set-pending`, { method: "PUT" });
    if (!response.ok) await parseError(response, "Failed to set invoice to pending");
    return await response.json();
  },

  review: async (invoiceId) => {
    const response = await authFetch(`${INVOICE_ENDPOINT}/${invoiceId}/review`, {
      method: "POST",
    });
    if (!response.ok) await parseError(response, "Failed to review invoice");
    return await response.json();
  },
};
