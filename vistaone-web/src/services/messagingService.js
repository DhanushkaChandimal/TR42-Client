import { API_BASE } from "../config/api";

function authHeaders(includeContentType = true) {
  const token = localStorage.getItem("authToken");
  if (!token) throw new Error("Missing auth token");
  const headers = { Authorization: `Bearer ${token}` };
  if (includeContentType) headers["Content-Type"] = "application/json";
  return headers;
}

async function fail(res, fallback) {
  const data = await res.json().catch(() => ({}));
  throw new Error(data?.message || fallback);
}

export const messagingService = {
  listInbox: async () => {
    const res = await fetch(`${API_BASE}/chats`, {
      method: "GET",
      headers: authHeaders(),
    });
    if (!res.ok) await fail(res, "Failed to load inbox");
    const data = await res.json();
    return data.chats || [];
  },

  getWorkOrderContext: async (workOrderId) => {
    const res = await fetch(
      `${API_BASE}/workorders/${workOrderId}/messaging-context`,
      { method: "GET", headers: authHeaders() }
    );
    if (!res.ok) await fail(res, "Failed to load work order details");
    return await res.json();
  },

  listTree: async () => {
    const res = await fetch(`${API_BASE}/messages/tree`, {
      method: "GET",
      headers: authHeaders(),
    });
    if (!res.ok) await fail(res, "Failed to load work orders");
    const data = await res.json();
    return data.workorders || [];
  },

  listRecipients: async (workOrderId) => {
    const res = await fetch(
      `${API_BASE}/workorders/${workOrderId}/recipients`,
      { method: "GET", headers: authHeaders() }
    );
    if (!res.ok) await fail(res, "Failed to load recipients");
    const data = await res.json();
    return data.recipients || [];
  },

  listChats: async (workOrderId) => {
    const res = await fetch(`${API_BASE}/workorders/${workOrderId}/chats`, {
      method: "GET",
      headers: authHeaders(),
    });
    if (!res.ok) await fail(res, "Failed to load chats");
    const data = await res.json();
    return data.chats || [];
  },

  openChat: async (workOrderId, recipientId) => {
    const res = await fetch(`${API_BASE}/workorders/${workOrderId}/chats`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ recipient_id: recipientId }),
    });
    if (!res.ok) await fail(res, "Failed to open chat");
    return await res.json();
  },

  getContext: async (chatId, workOrderId) => {
    const qs = workOrderId
      ? `?work_order_id=${encodeURIComponent(workOrderId)}`
      : "";
    const res = await fetch(`${API_BASE}/chats/${chatId}/context${qs}`, {
      method: "GET",
      headers: authHeaders(),
    });
    if (!res.ok) await fail(res, "Failed to load context");
    return await res.json();
  },

  listMessages: async (chatId, after) => {
    const qs = after ? `?after=${encodeURIComponent(after)}` : "";
    const res = await fetch(`${API_BASE}/chats/${chatId}/messages${qs}`, {
      method: "GET",
      headers: authHeaders(),
    });
    if (!res.ok) await fail(res, "Failed to load messages");
    const data = await res.json();
    return data.messages || [];
  },

  postMessage: async (chatId, body, file) => {
    const opts = { method: "POST" };
    if (file) {
      const form = new FormData();
      if (body) form.append("body", body);
      form.append("attachment", file);
      opts.headers = authHeaders(false);
      opts.body = form;
    } else {
      opts.headers = authHeaders();
      opts.body = JSON.stringify({ body });
    }
    const res = await fetch(`${API_BASE}/chats/${chatId}/messages`, opts);
    if (!res.ok) await fail(res, "Failed to send message");
    return await res.json();
  },

  attachmentUrl: (messageId, attachmentId) =>
    `${API_BASE}/messages/${messageId}/attachments/${attachmentId}`,
};
