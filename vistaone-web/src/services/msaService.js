const API_BASE = "/api";
const MSA_ENDPOINT = "/msa";

/** Helper to get auth headers - omits Content-Type for multipart uploads */
function getAuthHeaders(includeContentType = true) {
  const token = localStorage.getItem("authToken");
  if (!token) throw new Error("Missing auth token");
  const headers = { Authorization: `Bearer ${token}` };
  if (includeContentType) headers["Content-Type"] = "application/json";
  return headers;
}

export const msaService = {
  /** Fetch all MSA records, optionally filtered by vendor_id or status */
  getAll: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.vendor_id) query.append("vendor_id", params.vendor_id);
    if (params.status) query.append("status", params.status);
    const qs = query.toString();
    const url = qs
      ? `${API_BASE}${MSA_ENDPOINT}?${qs}`
      : `${API_BASE}${MSA_ENDPOINT}`;
    const response = await fetch(url, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to fetch MSAs");
    return await response.json();
  },

  /** Upload a new MSA document as FormData (PDF or Word doc) */
  upload: async (formData) => {
    const response = await fetch(`${API_BASE}${MSA_ENDPOINT}`, {
      method: "POST",
      headers: getAuthHeaders(false),
      body: formData,
    });
    if (!response.ok) throw new Error("Failed to upload MSA");
    return await response.json();
  },

  /** Update MSA metadata (status, version, dates) */
  update: async (msaId, data) => {
    const response = await fetch(`${API_BASE}${MSA_ENDPOINT}/${msaId}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to update MSA");
    return await response.json();
  },

  /** Returns the download URL for an MSA document */
  getDownloadUrl: (msaId) => {
    return `${API_BASE}${MSA_ENDPOINT}/${msaId}/download`;
  },
};
