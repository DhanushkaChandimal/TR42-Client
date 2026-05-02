import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ticketService } from "../services/ticketService";
import { invoiceService } from "../services/invoiceService";
import WorkOrderRecipients from "./WorkOrderRecipients";
import "../styles/workOrderRecipients.css";

const formatDate = (s) =>
  s
    ? new Date(s).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const formatStatusLabel = (status) => {
  if (!status) return "";
  if (status === "INVOICE_REJECTED") return "Invoice Rejected";
  if (status === "PENDING_REVIEW") return "Pending Review";
  return status.replace(/_/g, " ");
};

export default function WorkOrderDetailModal({ workOrder, onClose }) {
  const [tickets, setTickets] = useState(null);
  const [invoices, setInvoices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [t, i] = await Promise.all([
          ticketService.getAll({ work_order_id: workOrder.id }),
          invoiceService.getAll({ work_order_id: workOrder.id }),
        ]);
        if (cancelled) return;
        setTickets(t);
        setInvoices(i);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load related records");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [workOrder.id]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="workorders-modal-overlay" onClick={onClose}>
      <div
        className="workorders-modal workorder-detail-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="workorders-modal-header workorder-modal-header">
          <h2 className="workorder-modal-title">
            Work Order #{workOrder.work_order_id}
          </h2>
          <button
            className="workorders-close-btn workorder-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="workorder-detail-body">
          <section className="workorder-detail-section">
            <h3>Information</h3>
            <dl className="workorder-detail-grid">
              <dt>Vendor</dt><dd>{workOrder.vendor?.name || "—"}</dd>
              <dt>Job Type</dt><dd>{workOrder.service_type?.service || "—"}</dd>
              <dt>Description</dt><dd>{workOrder.description || "—"}</dd>
              <dt>Location Type</dt><dd>{workOrder.location_type || "—"}</dd>
              <dt>Location</dt>
              <dd>
                {workOrder.location_type === "ADDRESS" && workOrder.address
                  ? `${workOrder.address.street || ""}, ${workOrder.address.city || ""}`.trim()
                  : workOrder.latitude != null && workOrder.longitude != null
                  ? `${workOrder.latitude}, ${workOrder.longitude}`
                  : "—"}
              </dd>
              <dt>Priority</dt><dd>{workOrder.priority || "—"}</dd>
              <dt>Status</dt>
              <dd>
                {(() => {
                  const effective = workOrder.display_status || workOrder.status;
                  return (
                    <span className={`status-badge status-${effective?.toLowerCase()}`}>
                      {formatStatusLabel(effective)}
                    </span>
                  );
                })()}
              </dd>
              <dt>Created</dt><dd>{formatDate(workOrder.created_at)}</dd>
            </dl>
          </section>

          <section className="workorder-detail-section">
            <h3>Tickets {tickets ? `(${tickets.length})` : ""}</h3>
            {loading ? (
              <div className="workorders-tickets-state">Loading…</div>
            ) : error ? (
              <div className="workorders-tickets-state workorders-tickets-error">{error}</div>
            ) : !tickets || tickets.length === 0 ? (
              <div className="workorders-tickets-state">No tickets.</div>
            ) : (
              <table className="workorders-tickets-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Description</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id}>
                      <td>{t.id.slice(0, 8)}</td>
                      <td>{t.description}</td>
                      <td>{t.priority}</td>
                      <td>{t.status}</td>
                      <td>{formatDate(t.due_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="workorder-detail-section">
            <h3>Invoices {invoices ? `(${invoices.length})` : ""}</h3>
            {loading ? (
              <div className="workorders-tickets-state">Loading…</div>
            ) : error ? (
              <div className="workorders-tickets-state workorders-tickets-error">{error}</div>
            ) : !invoices || invoices.length === 0 ? (
              <div className="workorders-tickets-state">No invoices.</div>
            ) : (
              <table className="workorders-tickets-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Invoice Date</th>
                    <th>Due</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>{inv.id.slice(0, 8)}</td>
                      <td>{formatDate(inv.invoice_date)}</td>
                      <td>{formatDate(inv.due_date)}</td>
                      <td>{inv.total_amount != null ? `$${Number(inv.total_amount).toFixed(2)}` : "—"}</td>
                      <td>{inv.invoice_status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="workorder-detail-section">
            <h3>Message a recipient</h3>
            <WorkOrderRecipients workOrderId={workOrder.id} />
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}
