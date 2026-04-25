import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import CreateWorkOrderModal from "../components/CreateWorkOrderModal";
import { vendorService } from "../services/vendorService";
import { workOrderService } from "../services/workOrderService";
import { invoiceService } from "../services/invoiceService";
import { msaService } from "../services/msaService";
import "../styles/vendors.css";

const HISTORY_LIMIT = 5;

function dateValue(v) {
  if (!v) return 0;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function formatDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
}

function formatCurrency(v) {
  const n = Number(v) || 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function VendorDetail() {
  const { vendorId } = useParams();
  const navigate = useNavigate();
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateWO, setShowCreateWO] = useState(false);
  const [workOrders, setWorkOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [msas, setMsas] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    const loadVendor = async () => {
      try {
        const data = await vendorService.getById(vendorId);
        setVendor(data);
      } catch (err) {
        setError("Failed to load vendor details");
      } finally {
        setLoading(false);
      }
    };
    loadVendor();
  }, [vendorId]);

  useEffect(() => {
    let cancelled = false;
    const loadHistory = async () => {
      try {
        const [wo, inv, msa] = await Promise.all([
          workOrderService.getAll().catch(() => []),
          invoiceService.getAll({ vendor_id: vendorId }).catch(() => []),
          msaService.getAll({ vendor_id: vendorId }).catch(() => []),
        ]);
        if (cancelled) return;
        setWorkOrders(Array.isArray(wo) ? wo : []);
        setInvoices(Array.isArray(inv) ? inv : []);
        setMsas(Array.isArray(msa) ? msa : []);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    };
    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  const recentWorkOrders = useMemo(() => {
    const filtered = workOrders.filter((w) => w.vendor_id === vendorId);
    filtered.sort((a, b) => dateValue(b.created_at) - dateValue(a.created_at));
    return filtered.slice(0, HISTORY_LIMIT);
  }, [workOrders, vendorId]);

  const recentInvoices = useMemo(() => {
    const sorted = [...invoices];
    sorted.sort(
      (a, b) =>
        dateValue(b.invoice_date || b.created_at) -
        dateValue(a.invoice_date || a.created_at),
    );
    return sorted.slice(0, HISTORY_LIMIT);
  }, [invoices]);

  const recentMsas = useMemo(() => {
    const sorted = [...msas];
    sorted.sort(
      (a, b) =>
        dateValue(b.effective_date || b.created_at) -
        dateValue(a.effective_date || a.created_at),
    );
    return sorted.slice(0, HISTORY_LIMIT);
  }, [msas]);

  if (error) {
    return (
      <AppShell title="Vendor Detail" subtitle="">
        <div className="vendors-error">{error}</div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={vendor?.company_name || vendor?.name || "Vendor Detail"}
      subtitle={vendor?.company_code || ""}
      loading={loading}
      loadingText="Loading vendor..."
    >
      {vendor && (
        <div className="vendor-detail">
          <div className="vendor-detail-actions">
            <button
              className="vendor-detail-back"
              onClick={() => navigate(-1)}
            >
              Back
            </button>
            {vendor.status === "active" &&
              vendor.compliance_status === "complete" && (
                <button
                  className="vendor-detail-create-wo"
                  onClick={() => setShowCreateWO(true)}
                >
                  + Create Work Order
                </button>
              )}
          </div>

          <div className="vendor-detail-grid">
            <div className="vendor-detail-card">
              <h3>Contact Information</h3>
              <p><strong>Contact:</strong> {vendor.primary_contact_name || "-"}</p>
              <p><strong>Email:</strong> {vendor.company_email || "-"}</p>
              <p><strong>Phone:</strong> {vendor.company_phone || "-"}</p>
            </div>

            <div className="vendor-detail-card">
              <h3>Status</h3>
              <p>
                <strong>Status:</strong>{" "}
                <span className={`status-badge status-${vendor.status}`}>
                  {vendor.status}
                </span>
              </p>
              <p>
                <strong>Compliance:</strong>{" "}
                <span className={`status-badge compliance-${vendor.compliance_status}`}>
                  {vendor.compliance_status}
                </span>
              </p>
              <p><strong>Onboarding:</strong> {vendor.onboarding ? "Yes" : "No"}</p>
            </div>

            <div className="vendor-detail-card vendor-detail-card-full">
              <h3>Description</h3>
              <p>{vendor.description || "No description provided"}</p>
            </div>
          </div>

          <div className="vendor-history">
            <h2 className="vendor-history-title">Recent Activity</h2>

            <section className="vendor-history-section">
              <h3>Recent Work Orders</h3>
              {historyLoading ? (
                <p className="vendor-history-empty">Loading...</p>
              ) : recentWorkOrders.length === 0 ? (
                <p className="vendor-history-empty">
                  No work orders for this vendor yet.
                </p>
              ) : (
                <table className="vendor-history-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Service</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentWorkOrders.map((wo) => (
                      <tr key={wo.id}>
                        <td>{wo.work_order_id ?? wo.id?.slice(0, 8)}</td>
                        <td>
                          {wo.service_type?.service ||
                            wo.service_type ||
                            "-"}
                        </td>
                        <td>
                          <span
                            className={`status-badge status-${(wo.status || "").toLowerCase()}`}
                          >
                            {wo.status || "-"}
                          </span>
                        </td>
                        <td>{formatDate(wo.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="vendor-history-section">
              <h3>Recent Invoices</h3>
              {historyLoading ? (
                <p className="vendor-history-empty">Loading...</p>
              ) : recentInvoices.length === 0 ? (
                <p className="vendor-history-empty">
                  No invoices for this vendor yet.
                </p>
              ) : (
                <table className="vendor-history-table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentInvoices.map((inv) => (
                      <tr key={inv.id}>
                        <td>{inv.id?.slice(0, 8)}</td>
                        <td>{formatCurrency(inv.total_amount)}</td>
                        <td>
                          <span
                            className={`status-badge status-${(inv.invoice_status || inv.status || "").toLowerCase()}`}
                          >
                            {inv.invoice_status || inv.status || "-"}
                          </span>
                        </td>
                        <td>{formatDate(inv.invoice_date || inv.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="vendor-history-section">
              <h3>Recent MSAs</h3>
              {historyLoading ? (
                <p className="vendor-history-empty">Loading...</p>
              ) : recentMsas.length === 0 ? (
                <p className="vendor-history-empty">
                  No MSAs for this vendor yet.
                </p>
              ) : (
                <table className="vendor-history-table">
                  <thead>
                    <tr>
                      <th>Version</th>
                      <th>Effective</th>
                      <th>Expires</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentMsas.map((m) => (
                      <tr key={m.id}>
                        <td>v{m.version || "—"}</td>
                        <td>{formatDate(m.effective_date)}</td>
                        <td>{formatDate(m.expiration_date)}</td>
                        <td>
                          <span
                            className={`status-badge status-${(m.status || "").toLowerCase()}`}
                          >
                            {m.status || "-"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        </div>
      )}

      {showCreateWO && (
        <CreateWorkOrderModal
          setShowModal={setShowCreateWO}
          prefilledVendorId={vendorId}
        />
      )}
    </AppShell>
  );
}
