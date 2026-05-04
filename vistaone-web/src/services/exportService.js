import { API_BASE } from "../config/api";

function authHeaders() {
  const token = localStorage.getItem("authToken");
  if (!token) throw new Error("Missing auth token");
  return { Authorization: `Bearer ${token}` };
}

function buildQuery({ from, to } = {}) {
  const parts = [];
  if (from) parts.push(`from=${encodeURIComponent(from)}`);
  if (to) parts.push(`to=${encodeURIComponent(to)}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

async function downloadBinary(url, fallbackName) {
  const res = await fetch(url, { method: "GET", headers: authHeaders() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || `Download failed (${res.status})`);
  }
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match ? match[1] : fallbackName;
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

export const exportService = {
  analytics: (range) =>
    downloadBinary(
      `${API_BASE}/exports/analytics.xlsx${buildQuery(range)}`,
      "analytics.xlsx"
    ),
  invoices: (range) =>
    downloadBinary(
      `${API_BASE}/exports/invoices.xlsx${buildQuery(range)}`,
      "invoices.xlsx"
    ),
  tickets: (range) =>
    downloadBinary(
      `${API_BASE}/exports/tickets.xlsx${buildQuery(range)}`,
      "tickets.xlsx"
    ),
  workorders: (range) =>
    downloadBinary(
      `${API_BASE}/exports/workorders.xlsx${buildQuery(range)}`,
      "workorders.xlsx"
    ),
  vendors: () =>
    downloadBinary(`${API_BASE}/exports/vendors.xlsx`, "vendors.xlsx"),
};
