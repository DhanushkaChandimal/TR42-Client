import { authFetch } from "./apiClient";

const ENDPOINT = "/dashboard";

async function parseError(res, fallback) {
  const data = await res.json().catch(() => ({}));
  throw new Error(data?.message || fallback);
}

export const dashboardService = {
  /**
   * Single roll-up the dashboard widgets consume instead of each one
   * fetching every row and grouping in JS.
   */
  getSummary: async () => {
    const res = await authFetch(`${ENDPOINT}/summary`, { method: "GET" });
    if (!res.ok) await parseError(res, "Failed to load dashboard summary");
    return await res.json();
  },
};
