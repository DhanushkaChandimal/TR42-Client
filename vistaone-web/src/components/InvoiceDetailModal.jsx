import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuthContext } from "../context/AuthContext";

const formatDate = (s) => {
  if (!s) return "-";
  const d = new Date(s);
  return Number.isNaN(d.getTime())
    ? "-"
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      });
};

const formatCurrency = (amount) => {
  if (amount == null) return "$0.00";
  return `$${Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export default function InvoiceDetailModal({
  invoice,
  onClose,
  onApprove,
  onReject,
  onUndo,
}) {
  const { isAdmin } = useAuthContext();
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const runAction = async (fn, successMessage) => {
    setActionLoading(true);
    setActionMessage("");
    try {
      await fn(invoice.id);
      setActionMessage(successMessage);
    } catch (err) {
      setActionMessage(err.message || "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = () =>
    runAction(onApprove, "Invoice approved successfully");
  const handleReject = () => runAction(onReject, "Invoice rejected");
  const handleUndo = () => runAction(onUndo, "Invoice reset to pending");

  const stop = (e) => e.stopPropagation();

  return createPortal(
    <div className="workorders-modal-overlay" onClick={onClose}>
      <div
        className="workorders-modal workorder-detail-modal"
        onClick={stop}
        role="dialog"
        aria-modal="true"
      >
        <div className="workorders-modal-header workorder-modal-header">
          <h2 className="workorder-modal-title">
            Invoice {invoice.id?.slice(0, 8)}
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
              <dt>Invoice ID</dt>
              <dd>{invoice.id}</dd>
              <dt>Vendor</dt>
              <dd>
                {invoice.vendor?.company_name || invoice.vendor?.name || "-"}
              </dd>
              <dt>Amount</dt>
              <dd>{formatCurrency(invoice.total_amount)}</dd>
              <dt>Status</dt>
              <dd>
                <span
                  className={`inv-badge inv-badge-${invoice.invoice_status?.toLowerCase()}`}
                >
                  {invoice.invoice_status}
                </span>
              </dd>
              <dt>Invoice Date</dt>
              <dd>{formatDate(invoice.invoice_date)}</dd>
              <dt>Due Date</dt>
              <dd>{formatDate(invoice.due_date)}</dd>
              {invoice.period_start && (
                <>
                  <dt>Period</dt>
                  <dd>
                    {formatDate(invoice.period_start)} to{" "}
                    {formatDate(invoice.period_end)}
                  </dd>
                </>
              )}
              {invoice.approved_at && (
                <>
                  <dt>Approved At</dt>
                  <dd>{formatDate(invoice.approved_at)}</dd>
                </>
              )}
              {invoice.rejected_at && (
                <>
                  <dt>Rejected At</dt>
                  <dd>{formatDate(invoice.rejected_at)}</dd>
                </>
              )}
            </dl>
          </section>

          {invoice.line_items && invoice.line_items.length > 0 && (
            <section className="workorder-detail-section">
              <h3>Line Items</h3>
              <table className="workorders-tickets-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Rate</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.line_items.map((item, i) => (
                    <tr key={item.id || i}>
                      <td>{item.description || "-"}</td>
                      <td>{item.quantity}</td>
                      <td>{formatCurrency(item.rate)}</td>
                      <td>{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {actionMessage && (
            <div className="ticket-detail-action-message">{actionMessage}</div>
          )}

          {invoice.invoice_status === "SUBMITTED" && (
            <div className="ticket-detail-actions">
              <button
                className="ticket-btn-approve"
                onClick={handleApprove}
                disabled={actionLoading}
              >
                {actionLoading ? "Processing..." : "Approve Invoice"}
              </button>
              <button
                className="ticket-btn-reject"
                onClick={handleReject}
                disabled={actionLoading}
              >
                {actionLoading ? "Processing..." : "Reject Invoice"}
              </button>
            </div>
          )}

          {invoice.invoice_status === "APPROVED" && (
            <>
              <p className="ticket-detail-note ticket-detail-note-success">
                This invoice has been approved.
              </p>
              {isAdmin && (
                <div className="ticket-detail-actions">
                  <button
                    className="ticket-btn-undo"
                    onClick={handleUndo}
                    disabled={actionLoading}
                  >
                    {actionLoading
                      ? "Processing..."
                      : "Undo Approval (set Pending)"}
                  </button>
                </div>
              )}
            </>
          )}

          {invoice.invoice_status === "REJECTED" && (
            <>
              <p className="ticket-detail-note ticket-detail-note-error">
                This invoice was rejected. The vendor will need to resubmit.
              </p>
              {isAdmin && (
                <div className="ticket-detail-actions">
                  <button
                    className="ticket-btn-undo"
                    onClick={handleUndo}
                    disabled={actionLoading}
                  >
                    {actionLoading
                      ? "Processing..."
                      : "Undo Rejection (set Pending)"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
