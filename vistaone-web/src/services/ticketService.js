import { authFetch } from "./apiClient";

const TICKET_ENDPOINT = "/tickets";

async function parseError(res, fallback) {
  const data = await res.json().catch(() => ({}));
  throw new Error(data?.message || fallback);
}

export const ticketService = {
  summary: async ({ q = '' } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    const qs = params.toString();
    const url = qs ? `${TICKET_ENDPOINT}/summary?${qs}` : `${TICKET_ENDPOINT}/summary`;
    const response = await authFetch(url, { method: 'GET' });
    if (!response.ok) await parseError(response, 'Failed to fetch ticket summary');
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
    const response = await authFetch(`${TICKET_ENDPOINT}/search?${params.toString()}`, { method: 'GET' });
    if (!response.ok) await parseError(response, 'Failed to search tickets');
    return await response.json();
  },

  getAll: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.work_order_id) query.append("work_order_id", params.work_order_id);
    if (params.vendor_id) query.append("vendor_id", params.vendor_id);
    if (params.status) query.append("status", params.status);
    const qs = query.toString();
    const url = qs ? `${TICKET_ENDPOINT}?${qs}` : TICKET_ENDPOINT;
    const response = await authFetch(url, { method: "GET" });
    if (!response.ok) await parseError(response, "Failed to fetch tickets");
    return await response.json();
  },

  getById: async (ticketId) => {
    const response = await authFetch(`${TICKET_ENDPOINT}/${ticketId}`, { method: "GET" });
    if (!response.ok) await parseError(response, "Failed to fetch ticket");
    return await response.json();
  },

  approve: async (ticketId) => {
    const response = await authFetch(`${TICKET_ENDPOINT}/${ticketId}/approve`, { method: "PUT" });
    if (!response.ok) await parseError(response, "Failed to approve ticket");
    return await response.json();
  },

  reject: async (ticketId, note) => {
    const body = note != null ? JSON.stringify({ note }) : undefined;
    const response = await authFetch(`${TICKET_ENDPOINT}/${ticketId}/reject`, {
      method: "PUT",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body,
    });
    if (!response.ok) await parseError(response, "Failed to reject ticket");
    return await response.json();
  },

  setPending: async (ticketId) => {
    const response = await authFetch(`${TICKET_ENDPOINT}/${ticketId}/set-pending`, { method: "PUT" });
    if (!response.ok) await parseError(response, "Failed to set ticket to pending approval");
    return await response.json();
  },
};
