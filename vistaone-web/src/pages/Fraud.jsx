import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { ticketService } from "../services/ticketService";
import { vendorService } from "../services/vendorService";
import { invoiceService } from "../services/invoiceService";
import { workOrderService } from "../services/workOrderService";
import { msaService } from "../services/msaService";
import { fraudSignals } from "../services/analyticsHelpers";
import "../styles/fraud.css";

const SEVERITY_OPTIONS = [
  { value: "ALL", label: "All severities" },
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

export default function Fraud() {
  const [data, setData] = useState({
    tickets: [],
    vendors: [],
    invoices: [],
    workOrders: [],
    msas: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [acknowledged, setAcknowledged] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [tickets, vendors, invoices, workOrders, msas] = await Promise.all([
          ticketService.getAll().catch(() => []),
          vendorService.getAll().catch(() => []),
          invoiceService.getAll().catch(() => []),
          workOrderService.getAll().catch(() => []),
          msaService.getAll().catch(() => []),
        ]);
        if (cancelled) return;
        setData({
          tickets: Array.isArray(tickets) ? tickets : [],
          vendors: Array.isArray(vendors) ? vendors : [],
          invoices: Array.isArray(invoices) ? invoices : [],
          workOrders: Array.isArray(workOrders) ? workOrders : [],
          msas: Array.isArray(msas) ? msas : [],
        });
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load fraud signals");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const allSignals = useMemo(() => fraudSignals(data), [data]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allSignals.filter((s) => {
      if (severityFilter !== "ALL" && s.severity !== severityFilter) return false;
      if (!term) return true;
      return (
        s.target.toLowerCase().includes(term) ||
        s.category.toLowerCase().includes(term) ||
        s.description.toLowerCase().includes(term)
      );
    });
  }, [allSignals, severityFilter, search]);

  const counts = useMemo(() => {
    const c = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    allSignals.forEach((s) => {
      c[s.severity] = (c[s.severity] || 0) + 1;
    });
    return c;
  }, [allSignals]);

  const signalKey = (s) => `${s.severity}|${s.category}|${s.target}|${s.description}`;

  const toggleAck = (s) => {
    setAcknowledged((prev) => {
      const next = new Set(prev);
      const k = signalKey(s);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  return (
    <AppShell
      title="Fraud & Anomalies"
      subtitle="Derived signals from tickets, invoices, MSAs, and vendor compliance"
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

      <section className="fraud-controls">
        <input
          type="search"
          className="fraud-search"
          placeholder="Search by vendor, category, description..."
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
      </section>

      {!loading && allSignals.length === 0 && (
        <div className="fraud-empty">
          No fraud signals detected. Either things are clean, or there's not enough
          data yet.
        </div>
      )}

      {!loading && allSignals.length > 0 && filtered.length === 0 && (
        <div className="fraud-empty">No signals match your filters.</div>
      )}

      <ul className="fraud-list">
        {filtered.map((s) => {
          const k = signalKey(s);
          const isAck = acknowledged.has(k);
          return (
            <li
              key={k}
              className={`fraud-item severity-${s.severity} ${
                isAck ? "acknowledged" : ""
              }`}
            >
              <div className={`fraud-severity-badge severity-${s.severity}`}>
                {s.severity}
              </div>
              <div className="fraud-body">
                <div className="fraud-category">{s.category}</div>
                <div className="fraud-target">{s.target}</div>
                <div className="fraud-description">{s.description}</div>
              </div>
              <button
                type="button"
                className="fraud-ack-btn"
                onClick={() => toggleAck(s)}
              >
                {isAck ? "Unacknowledge" : "Acknowledge"}
              </button>
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
}
