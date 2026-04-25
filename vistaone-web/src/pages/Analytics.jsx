import { useEffect, useMemo, useState } from "react";
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
import { ticketService } from "../services/ticketService";
import { vendorService } from "../services/vendorService";
import { invoiceService } from "../services/invoiceService";
import { workOrderService } from "../services/workOrderService";
import { msaService } from "../services/msaService";
import {
  vendorTicketStats,
  vendorsBySharedService,
  invoicesOutstandingByVendor,
  workOrdersByStatus,
  msasExpiringSoon,
} from "../services/analyticsHelpers";
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

export default function Analytics() {
  const [data, setData] = useState({
    tickets: [],
    vendors: [],
    invoices: [],
    workOrders: [],
    msas: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        if (!cancelled) setError(err.message || "Failed to load analytics");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(
    () => vendorTicketStats(data.tickets, data.vendors),
    [data.tickets, data.vendors],
  );

  const sharedServices = useMemo(
    () => vendorsBySharedService(data.vendors),
    [data.vendors],
  );

  const outstanding = useMemo(
    () => invoicesOutstandingByVendor(data.invoices, data.vendors),
    [data.invoices, data.vendors],
  );

  const woStatus = useMemo(
    () => workOrdersByStatus(data.workOrders),
    [data.workOrders],
  );

  const expiring = useMemo(
    () => msasExpiringSoon(data.msas, 90),
    [data.msas],
  );

  const totals = useMemo(() => {
    const totalTickets = data.tickets.length;
    const approved = data.tickets.filter((t) => t.status === "APPROVED").length;
    const rejected = data.tickets.filter((t) => t.status === "REJECTED").length;
    const reviewed = approved + rejected;
    return {
      totalTickets,
      approved,
      rejected,
      approvalRate: reviewed > 0 ? approved / reviewed : 0,
      vendors: data.vendors.length,
      activeWO: data.workOrders.filter(
        (w) => w.status !== "CANCELLED" && w.status !== "CLOSED",
      ).length,
    };
  }, [data]);

  return (
    <AppShell
      title="Analytics"
      subtitle="Performance insights from tickets, vendors, and invoices"
      loading={loading}
      loadingText="Crunching numbers..."
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
                  dataKey="vendorName"
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
                  <tr key={s.vendorId}>
                    <td>{s.vendorName}</td>
                    <td>{s.approved}</td>
                    <td>{s.rejected}</td>
                    <td>{s.pending}</td>
                    <td>
                      <span
                        className={`analytics-rate ${
                          s.rejectionRate >= 0.5
                            ? "rate-high"
                            : s.rejectionRate >= 0.3
                            ? "rate-mid"
                            : "rate-low"
                        }`}
                      >
                        {s.approved + s.rejected > 0
                          ? `${(s.rejectionRate * 100).toFixed(0)}%`
                          : "—"}
                      </span>
                    </td>
                    <td>
                      {s.avgApprovalHours != null
                        ? `${s.avgApprovalHours.toFixed(1)} h`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                  <tr key={o.vendorId}>
                    <td>{o.vendorName}</td>
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
                    <td>
                      {m.vendor_name ||
                        data.vendors.find((v) => v.id === m.vendor_id)
                          ?.company_name ||
                        m.vendor_id?.slice(0, 8)}
                    </td>
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
