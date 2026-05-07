import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AppShell from "../components/AppShell";
import ExportButton from "../components/ExportButton";
import { exportService } from "../services/exportService";
import { analyticsService } from "../services/analyticsService";
import "../styles/analytics.css";

const STATUS_COLORS = {
  UNASSIGNED: "#9ca3af",
  ASSIGNED: "#8b5cf6",
  IN_PROGRESS: "#3b82f6",
  APPROVED: "#10b981",
  COMPLETED: "#10b981",
  CANCELLED: "#ef4444",
  CLOSED: "#6b7280",
  HALTED: "#f59e0b",
  REJECTED: "#ef4444",
};

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

const EMPTY_SUMMARY = {
  kpis: {
    total_tickets: 0,
    approved: 0,
    rejected: 0,
    approval_rate: 0,
    vendor_count: 0,
    active_wo: 0,
  },
  invoice_pipeline: {
    pending: { count: 0, amount: 0 },
    approved: { count: 0, amount: 0 },
    rejected: { count: 0, amount: 0 },
    paid: { count: 0, amount: 0 },
    draft: { count: 0, amount: 0 },
    submitted: { count: 0, amount: 0 },
  },
  vendor_ticket_stats: [],
  invoice_by_vendor: [],
  invoice_outstanding: [],
  cost_by_service: [],
  wo_by_status: [],
  msas_expiring: [],
  vendors_by_shared_service: [],
};

export default function Analytics() {
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    analyticsService
      .getSummary()
      .then((data) => {
        if (cancelled) return;
        setSummary({ ...EMPTY_SUMMARY, ...data });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || "Failed to load analytics");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = summary.vendor_ticket_stats;
  const sharedServices = summary.vendors_by_shared_service;
  const outstanding = summary.invoice_outstanding;
  const invoicePipeline = summary.invoice_pipeline;
  const invoiceByVendor = summary.invoice_by_vendor;
  const serviceCosts = summary.cost_by_service;
  const woStatus = summary.wo_by_status;
  const expiring = summary.msas_expiring;
  const totals = {
    totalTickets: summary.kpis.total_tickets,
    approved: summary.kpis.approved,
    rejected: summary.kpis.rejected,
    approvalRate: summary.kpis.approval_rate,
    vendors: summary.kpis.vendor_count,
    activeWO: summary.kpis.active_wo,
  };

  return (
    <AppShell
      title="Analytics"
      subtitle="Performance insights from tickets, vendors, and invoices"
      loading={loading}
      loadingText="Crunching numbers..."
      controls={<ExportButton withDateRange onExport={exportService.analytics} />}
    >
      {error && <div className="analytics-error">{error}</div>}

      <section className="analytics-kpi-row">
        <div className="analytics-kpi">
          <div className="analytics-kpi-label">Total tickets</div>
          <div className="analytics-kpi-value">{totals.totalTickets}</div>
        </div>
        <div className="analytics-kpi">
          <div className="analytics-kpi-label">Approval rate</div>
          <div className="analytics-kpi-value">
            {(totals.approvalRate * 100).toFixed(0)}%
          </div>
        </div>
        <div className="analytics-kpi">
          <div className="analytics-kpi-label">Active vendors</div>
          <div className="analytics-kpi-value">{totals.vendors}</div>
        </div>
        <div className="analytics-kpi">
          <div className="analytics-kpi-label">Active work orders</div>
          <div className="analytics-kpi-value">{totals.activeWO}</div>
        </div>
      </section>

      <section className="analytics-kpi-row">
        <div className="analytics-kpi analytics-kpi-pending">
          <div className="analytics-kpi-label">Invoices pending</div>
          <div className="analytics-kpi-value">
            {invoicePipeline.pending.count}
          </div>
          <div className="analytics-kpi-sub">
            {formatCurrency(invoicePipeline.pending.amount)}
          </div>
        </div>
        <div className="analytics-kpi analytics-kpi-approved">
          <div className="analytics-kpi-label">Invoices approved</div>
          <div className="analytics-kpi-value">
            {invoicePipeline.approved.count}
          </div>
          <div className="analytics-kpi-sub">
            {formatCurrency(invoicePipeline.approved.amount)}
          </div>
        </div>
        <div className="analytics-kpi analytics-kpi-rejected">
          <div className="analytics-kpi-label">Invoices rejected</div>
          <div className="analytics-kpi-value">
            {invoicePipeline.rejected.count}
          </div>
          <div className="analytics-kpi-sub">
            {formatCurrency(invoicePipeline.rejected.amount)}
          </div>
        </div>
        <div className="analytics-kpi">
          <div className="analytics-kpi-label">Invoices paid</div>
          <div className="analytics-kpi-value">
            {invoicePipeline.paid.count}
          </div>
          <div className="analytics-kpi-sub">
            {formatCurrency(invoicePipeline.paid.amount)}
          </div>
        </div>
      </section>

      <section className="analytics-grid">
        <div className="analytics-card">
          <h3>Tickets by vendor</h3>
          {stats.length === 0 ? (
            <div className="analytics-empty">No ticket data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" />
                <XAxis
                  dataKey="vendor_name"
                  tick={{ fontSize: 11 }}
                  angle={-15}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="approved" stackId="a" fill="#10b981" name="Approved" />
                <Bar dataKey="rejected" stackId="a" fill="#ef4444" name="Rejected" />
                <Bar dataKey="pending" stackId="a" fill="#f59e0b" name="Pending" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="analytics-card">
          <h3>Work orders by status</h3>
          {woStatus.length === 0 ? (
            <div className="analytics-empty">No work orders.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={woStatus}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={(e) => `${e.status} (${e.count})`}
                >
                  {woStatus.map((entry) => (
                    <Cell
                      key={entry.status}
                      fill={STATUS_COLORS[entry.status] || "#94a3b8"}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="analytics-card analytics-wide">
          <h3>Vendor rejection rate</h3>
          {stats.length === 0 ? (
            <div className="analytics-empty">No reviewed tickets yet.</div>
          ) : (
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Approved</th>
                  <th>Rejected</th>
                  <th>Pending</th>
                  <th>Rejection rate</th>
                  <th>Avg approval time</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.vendor_id}>
                    <td>{s.vendor_name}</td>
                    <td>{s.approved}</td>
                    <td>{s.rejected}</td>
                    <td>{s.pending}</td>
                    <td>
                      <span
                        className={`analytics-rate ${
                          s.rejection_rate >= 0.5
                            ? "rate-high"
                            : s.rejection_rate >= 0.3
                            ? "rate-mid"
                            : "rate-low"
                        }`}
                      >
                        {s.approved + s.rejected > 0
                          ? `${(s.rejection_rate * 100).toFixed(0)}%`
                          : "—"}
                      </span>
                    </td>
                    <td>
                      {s.avg_approval_hours != null
                        ? `${s.avg_approval_hours.toFixed(1)} h`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="analytics-card analytics-wide">
          <h3>Cost by service</h3>
          {serviceCosts.length === 0 ? (
            <div className="analytics-empty">No invoiced services yet.</div>
          ) : (
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Invoices</th>
                  <th>Approved</th>
                  <th>Pending</th>
                  <th>Rejected</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {serviceCosts.map((s) => (
                  <tr key={s.service}>
                    <td>{s.service}</td>
                    <td>{s.invoice_count}</td>
                    <td>{formatCurrency(s.approved)}</td>
                    <td>{formatCurrency(s.pending)}</td>
                    <td>{formatCurrency(s.rejected)}</td>
                    <td>
                      <strong>{formatCurrency(s.total)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="analytics-card analytics-wide">
          <h3>Invoice approvals by vendor</h3>
          {invoiceByVendor.length === 0 ? (
            <div className="analytics-empty">No invoices yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={invoiceByVendor}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" />
                <XAxis
                  dataKey="vendor_name"
                  tick={{ fontSize: 11 }}
                  angle={-15}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="approved" stackId="i" fill="#10b981" name="Approved" />
                <Bar dataKey="rejected" stackId="i" fill="#ef4444" name="Rejected" />
                <Bar dataKey="pending" stackId="i" fill="#f59e0b" name="Pending" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="analytics-card">
          <h3>Outstanding invoices by vendor</h3>
          {outstanding.length === 0 ? (
            <div className="analytics-empty">No outstanding invoices.</div>
          ) : (
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Count</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {outstanding.map((o) => (
                  <tr key={o.vendor_id}>
                    <td>{o.vendor_name}</td>
                    <td>{o.count}</td>
                    <td>{formatCurrency(o.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="analytics-card">
          <h3>MSAs expiring in next 90 days</h3>
          {expiring.length === 0 ? (
            <div className="analytics-empty">No MSAs expiring soon.</div>
          ) : (
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Version</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                {expiring.map((m) => (
                  <tr key={m.id}>
                    <td>{m.vendor_name || m.vendor_id?.slice(0, 8) || "—"}</td>
                    <td>v{m.version || "—"}</td>
                    <td>
                      {new Date(m.expiration_date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="analytics-card analytics-wide">
          <h3>Same service offered by multiple vendors</h3>
          {sharedServices.length === 0 ? (
            <div className="analytics-empty">
              No overlapping services across vendors. (Backend may not be returning
              vendor_services on /vendors yet.)
            </div>
          ) : (
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Vendors</th>
                </tr>
              </thead>
              <tbody>
                {sharedServices.map((row) => (
                  <tr key={row.service}>
                    <td>{row.service}</td>
                    <td>{row.vendors.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </AppShell>
  );
}
