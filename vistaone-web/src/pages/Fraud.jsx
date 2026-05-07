import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { fraudService } from "../services/fraudService";
import "../styles/fraud.css";

const SEVERITY_OPTIONS = [
  { value: "ALL", label: "All severities" },
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

// Work order status groupings the user wants to filter by.
const STATUS_GROUP_OPTIONS = [
  { value: "ALL", label: "All work orders" },
  { value: "OPEN", label: "Open" },
  { value: "PENDING", label: "Pending" },
  { value: "COMPLETED", label: "Completed" },
];

const STATUS_GROUP_MEMBERS = {
  OPEN: new Set(["UNASSIGNED", "ASSIGNED", "IN_PROGRESS"]),
  PENDING: new Set(["PENDING", "PENDING_APPROVAL"]),
  COMPLETED: new Set(["COMPLETED", "CLOSED"]),
};

const SEVERITY_RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const EMPTY = {
  kpis: {
    total_alerts: 0,
    flagged_work_orders: 0,
    by_severity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
    by_source: { contractor: 0, vendor: 0, system: 0 },
  },
  work_order_groups: [],
};

function formatDate(s) {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Fraud() {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(() => new Set());
  const [acknowledged, setAcknowledged] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    fraudService
      .getAlerts()
      .then((d) => {
        if (cancelled) return;
        setData({ ...EMPTY, ...d });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || "Failed to load fraud alerts");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Apply filters per WO group: a group is shown if its status matches
  // the selected status group AND at least one alert matches severity +
  // search. Within a shown group, we still render every alert under it
  // so the WO context isn't broken.
  const visibleGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const statusSet = STATUS_GROUP_MEMBERS[statusFilter];
    const groups = data.work_order_groups || [];
    return groups
      .filter((g) => {
        if (statusSet && !statusSet.has(g.current_status)) return false;
        const haystack = [
          g.vendor_name || "",
          g.description || "",
          g.work_order_code != null ? `#${g.work_order_code}` : "",
        ].join(" ").toLowerCase();
        const groupMatchesSearch = !term || haystack.includes(term);
        const matchingAlerts = g.alerts.filter((a) => {
          if (severityFilter !== "ALL" && a.severity !== severityFilter) return false;
          if (!term) return true;
          if (groupMatchesSearch) return true;
          const alertHaystack = [
            a.category || "",
            a.description || "",
            a.contractor || "",
          ].join(" ").toLowerCase();
          return alertHaystack.includes(term);
        });
        return matchingAlerts.length > 0;
      })
      .sort(
        (a, b) =>
          (SEVERITY_RANK[a.max_severity] ?? 9) -
          (SEVERITY_RANK[b.max_severity] ?? 9) ||
          b.alert_count - a.alert_count,
      );
  }, [data.work_order_groups, severityFilter, statusFilter, search]);

  // Split into Active (any unacknowledged alert under the WO) vs.
  // Fully acknowledged. New alerts default to unacknowledged so they
  // land in the Active section at the top.
  const { activeGroups, ackedGroups } = useMemo(() => {
    const active = [];
    const acked = [];
    visibleGroups.forEach((g) => {
      const allAcked = g.alerts.every((a) => acknowledged.has(a.id));
      if (allAcked) acked.push(g);
      else active.push(g);
    });
    return { activeGroups: active, ackedGroups: acked };
  }, [visibleGroups, acknowledged]);

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpanded(new Set(visibleGroups.map((g) => g.work_order_id)));
  };
  const collapseAll = () => setExpanded(new Set());

  const renderGroup = (g) => {
    const isOpen = expanded.has(g.work_order_id);
    const visibleAlerts = g.alerts.filter((a) => {
      if (severityFilter !== "ALL" && a.severity !== severityFilter) return false;
      return true;
    });
    return (
      <li
        key={g.work_order_id}
        className={`fraud-wo-card max-${g.max_severity}`}
      >
        <button
          type="button"
          className="fraud-wo-header"
          onClick={() => toggleExpand(g.work_order_id)}
          aria-expanded={isOpen}
        >
          <span className={`fraud-severity-badge severity-${g.max_severity}`}>
            {g.max_severity}
          </span>
          <span className="fraud-wo-code">
            WO #{g.work_order_code ?? g.work_order_id.slice(0, 8)}
          </span>
          <span className="fraud-wo-vendor">{g.vendor_name || "—"}</span>
          <span className="fraud-wo-status">{g.current_status || "—"}</span>
          <span className="fraud-wo-count">
            {visibleAlerts.length} alert{visibleAlerts.length === 1 ? "" : "s"}
          </span>
          <span className="fraud-wo-chevron" aria-hidden="true">
            {isOpen ? "▾" : "▸"}
          </span>
        </button>
        {g.description && (
          <div className="fraud-wo-description">{g.description}</div>
        )}
        {isOpen && (
          <ul className="fraud-alert-list">
            {visibleAlerts.map((a) => {
              const isAck = acknowledged.has(a.id);
              return (
                <li
                  key={a.id}
                  className={`fraud-alert severity-${a.severity} source-${a.source} ${
                    isAck ? "acknowledged" : ""
                  }`}
                >
                  <div className={`fraud-severity-badge severity-${a.severity}`}>
                    {a.severity}
                  </div>
                  <div className="fraud-alert-body">
                    <div className="fraud-alert-meta">
                      <span className={`fraud-source-tag source-${a.source}`}>
                        {a.source}
                      </span>
                      <span className="fraud-alert-category">{a.category}</span>
                      {a.contractor && (
                        <span className="fraud-alert-contractor">
                          Contractor: {a.contractor}
                        </span>
                      )}
                      {a.created_at && (
                        <span className="fraud-alert-time">
                          {formatDate(a.created_at)}
                        </span>
                      )}
                    </div>
                    <div className="fraud-alert-description">
                      {a.description}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="fraud-ack-btn"
                    onClick={() => toggleAck(a.id)}
                  >
                    {isAck ? "Unacknowledge" : "Acknowledge"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  };

  const toggleAck = (alertId) => {
    setAcknowledged((prev) => {
      const next = new Set(prev);
      if (next.has(alertId)) next.delete(alertId);
      else next.add(alertId);
      return next;
    });
  };

  const counts = data.kpis.by_severity;
  const sources = data.kpis.by_source;

  return (
    <AppShell
      title="Fraud & Anomalies"
      subtitle="Per work order, broken out by contractor, vendor, and system-derived alerts"
      loading={loading}
      loadingText="Scanning for anomalies..."
    >
      {error && <div className="fraud-error">{error}</div>}

      <section className="fraud-summary">
        <div className="fraud-summary-card severity-CRITICAL">
          <div className="fraud-summary-label">Critical</div>
          <div className="fraud-summary-value">{counts.CRITICAL}</div>
        </div>
        <div className="fraud-summary-card severity-HIGH">
          <div className="fraud-summary-label">High</div>
          <div className="fraud-summary-value">{counts.HIGH}</div>
        </div>
        <div className="fraud-summary-card severity-MEDIUM">
          <div className="fraud-summary-label">Medium</div>
          <div className="fraud-summary-value">{counts.MEDIUM}</div>
        </div>
        <div className="fraud-summary-card severity-LOW">
          <div className="fraud-summary-label">Low</div>
          <div className="fraud-summary-value">{counts.LOW}</div>
        </div>
      </section>

      <section className="fraud-source-row">
        <div className="fraud-source-card">
          <div className="fraud-source-label">Contractor app</div>
          <div className="fraud-source-value">{sources.contractor}</div>
        </div>
        <div className="fraud-source-card">
          <div className="fraud-source-label">Vendor</div>
          <div className="fraud-source-value">{sources.vendor}</div>
        </div>
        <div className="fraud-source-card">
          <div className="fraud-source-label">System derived</div>
          <div className="fraud-source-value">{sources.system}</div>
        </div>
        <div className="fraud-source-card fraud-source-total">
          <div className="fraud-source-label">Flagged work orders</div>
          <div className="fraud-source-value">
            {data.kpis.flagged_work_orders}
          </div>
        </div>
      </section>

      <section className="fraud-controls">
        <input
          type="search"
          className="fraud-search"
          placeholder="Search by vendor, WO #, contractor, category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="fraud-filter"
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
        >
          {SEVERITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          className="fraud-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by work order status"
        >
          {STATUS_GROUP_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button type="button" className="fraud-toolbar-btn" onClick={expandAll}>
          Expand all
        </button>
        <button type="button" className="fraud-toolbar-btn" onClick={collapseAll}>
          Collapse all
        </button>
      </section>

      {!loading && data.kpis.total_alerts === 0 && (
        <div className="fraud-empty">
          No fraud signals detected for your client. Either things are clean,
          or there's not enough data yet.
        </div>
      )}

      {!loading && data.kpis.total_alerts > 0 && visibleGroups.length === 0 && (
        <div className="fraud-empty">No work orders match your filters.</div>
      )}

      {(activeGroups.length > 0 || ackedGroups.length === 0) && (
        <section className="fraud-section">
          <header className="fraud-section-header">
            <span className="fraud-section-title">Active alerts</span>
            <span className="fraud-section-count">
              {activeGroups.length} work order{activeGroups.length === 1 ? "" : "s"}
            </span>
          </header>
          {activeGroups.length === 0 ? (
            <div className="fraud-section-empty">
              No active alerts in this view.
            </div>
          ) : (
            <ul className="fraud-wo-list">{activeGroups.map(renderGroup)}</ul>
          )}
        </section>
      )}

      {ackedGroups.length > 0 && (
        <section className="fraud-section fraud-section-acked">
          <header className="fraud-section-header">
            <span className="fraud-section-title">Acknowledged</span>
            <span className="fraud-section-count">
              {ackedGroups.length} work order{ackedGroups.length === 1 ? "" : "s"}
            </span>
          </header>
          <ul className="fraud-wo-list">{ackedGroups.map(renderGroup)}</ul>
        </section>
      )}
    </AppShell>
  );
}
