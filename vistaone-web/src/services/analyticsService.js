import { authFetch } from "./apiClient";

const ENDPOINT = "/analytics";

async function parseError(res, fallback) {
  const data = await res.json().catch(() => ({}));
  throw new Error(data?.message || fallback);
}

export const analyticsService = {
  /**
   * Single roll-up the Analytics page consumes instead of pulling every
   * ticket / vendor / invoice / work order / MSA and aggregating in JS.
   */
  getSummary: async () => {
    const res = await authFetch(`${ENDPOINT}/summary`, { method: "GET" });
    if (!res.ok) await parseError(res, "Failed to load analytics summary");
    return await res.json();
  },
};
