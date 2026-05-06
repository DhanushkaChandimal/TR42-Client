import { authFetch } from "./apiClient";

const TICKET_ENDPOINT = "/tickets";

async function parseError(res, fallback) {
  const data = await res.json().catch(() => ({}));
  throw new Error(data?.message || fallback);
}

export const ticketService = {
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
