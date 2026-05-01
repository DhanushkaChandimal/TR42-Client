import { API_BASE } from "../config/api";

const AI_ENDPOINT = "/ai";

function getAuthHeaders(includeContentType = true) {
  const token = localStorage.getItem("authToken");
  if (!token) throw new Error("Missing auth token");
  const headers = { Authorization: `Bearer ${token}` };
  if (includeContentType) headers["Content-Type"] = "application/json";
  return headers;
}

async function parseError(res, fallback) {
  const data = await res.json().catch(() => ({}));
  throw new Error(data?.message || fallback);
}

export const aiService = {
  analyze: async (msaId) => {
    const res = await fetch(`${API_BASE}${AI_ENDPOINT}/msa/${msaId}/analyze`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (!res.ok) await parseError(res, "Failed to analyze MSA");
    return await res.json();
  },

  getAnalysis: async (msaId) => {
    const res = await fetch(`${API_BASE}${AI_ENDPOINT}/msa/${msaId}/analysis`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!res.ok) await parseError(res, "Failed to load analysis");
    return await res.json();
  },

  getPricing: async (msaId) => {
    const res = await fetch(`${API_BASE}${AI_ENDPOINT}/msa/${msaId}/pricing`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!res.ok) await parseError(res, "Failed to load pricing");
    return await res.json();
  },

  getText: async (msaId) => {
    const res = await fetch(`${API_BASE}${AI_ENDPOINT}/msa/${msaId}/text`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!res.ok) await parseError(res, "Failed to load document text");
    return await res.json();
  },
};
