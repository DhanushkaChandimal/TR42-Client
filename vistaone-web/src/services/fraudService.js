import { authFetch } from "./apiClient";

const ENDPOINT = "/fraud";

async function parseError(res, fallback) {
  const data = await res.json().catch(() => ({}));
  throw new Error(data?.message || fallback);
}

export const fraudService = {
  /**
   * Returns fraud / anomaly alerts grouped by work order, scoped to the
   * caller's client. Each WO group includes its alerts from the
   * contractor app, vendor side, and system-derived signals.
   */
  getAlerts: async () => {
    const res = await authFetch(`${ENDPOINT}/alerts`, { method: "GET" });
    if (!res.ok) await parseError(res, "Failed to load fraud alerts");
    return await res.json();
  },
};
