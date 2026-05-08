import { useEffect, useState } from "react";

/**
 * Whole-dataset status counts shown as a card row above the list table.
 * Counts are independent of pagination so users see real totals.
 *
 * Props:
 *   fetchSummary  - async ({ q }) => ({ counts: { ENUM: number, ... } })
 *   q             - the current search term, refetches when it changes
 *   statuses      - [{ value, label }] in the order to render
 *   activeStatus  - currently selected status filter, '' = ALL
 *   onSelect      - (statusValue) => void; selecting the same value clears
 *   refreshKey    - bumping this number forces a refetch (e.g. after a
 *                   status transition that changes a row's bucket)
 */
export default function StatusSummaryCards({
  fetchSummary,
  q = "",
  statuses,
  activeStatus = "",
  onSelect,
  refreshKey = 0,
}) {
  const [counts, setCounts] = useState({});

  useEffect(() => {
    let cancelled = false;
    fetchSummary({ q })
      .then((res) => {
        if (!cancelled) setCounts(res?.counts || {});
      })
      .catch(() => {
        if (!cancelled) setCounts({});
      });
    return () => {
      cancelled = true;
    };
  }, [fetchSummary, q, refreshKey]);

  return (
    <section className="list-summary" role="group" aria-label="Status counts">
      {statuses.map((s) => {
        const isActive = activeStatus === s.value;
        return (
          <button
            key={s.value}
            type="button"
            className={`list-summary-card list-summary-${s.value
              .toLowerCase()
              .replace(/_/g, "-")} ${isActive ? "list-summary-active" : ""}`}
            onClick={() => onSelect?.(isActive ? "" : s.value)}
            aria-pressed={isActive}
          >
            <span className="list-summary-count">{counts[s.value] ?? 0}</span>
            <span className="list-summary-label">{s.label}</span>
          </button>
        );
      })}
    </section>
  );
}
