import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuthContext } from "../context/AuthContext";
import { invoiceService } from "../services/invoiceService";
import RejectionForm from "./RejectionForm";

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
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [review, setReview] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState("");

  const handleAiReview = async () => {
    if (!invoice?.id) return;
    setReviewError("");
    setReviewing(true);
    try {
      const result = await invoiceService.review(invoice.id);
      setReview(result);
    } catch (err) {
      setReviewError(err.message || "Review failed");
    } finally {
      setReviewing(false);
    }
  };

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
  const handleUndo = () => runAction(onUndo, "Invoice reset to pending");

  const handleRejectConfirm = async (note, recipientIds) => {
    setActionLoading(true);
    setActionMessage("");
    try {
      await onReject(invoice.id, note, recipientIds);
      setActionMessage(
        recipientIds.length
          ? `Invoice rejected. Notified ${recipientIds.length} recipient(s).`
          : "Invoice rejected."
      );
      setShowRejectForm(false);
    } catch (err) {
      setActionMessage(err.message || "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

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

          <section className="workorder-detail-section">
            <h3>AI Invoice Review</h3>
            <p className="invoice-review-hint">
              Compares the submitted total against the work performed
              (ticket hours) and the vendor's MSA pricing schedule.
            </p>
            <div className="invoice-review-actions">
              <button
                type="button"
                className="invoice-review-btn"
                onClick={handleAiReview}
                disabled={reviewing}
              >
                {reviewing
                  ? "Analyzing..."
                  : review
                  ? "Re-run AI review"
                  : "Run AI review"}
              </button>
              {reviewError && (
                <span className="invoice-review-error">{reviewError}</span>
              )}
            </div>

            {review && (
              <div className={`invoice-review-result verdict-${review.verdict}`}>
                <header className="invoice-review-header">
                  <span className={`invoice-review-badge verdict-${review.verdict}`}>
                    {review.verdict_label}
                  </span>
                  {review.pricing_source === "demo_estimate" && (
                    <span className="invoice-review-source-tag">
                      demo market rates (no MSA pricing extracted)
                    </span>
                  )}
                  {review.pricing_source === "ai" && (
                    <span className="invoice-review-source-tag invoice-review-source-ai">
                      MSA pricing
                    </span>
                  )}
                </header>
                <dl className="invoice-review-grid">
                  <dt>Submitted</dt>
                  <dd>{formatCurrency(review.invoice_total)}</dd>
                  <dt>Expected range</dt>
                  <dd>
                    {review.expected_low != null
                      ? `${formatCurrency(review.expected_low)} - ${formatCurrency(review.expected_high)}`
                      : "Could not be computed"}
                  </dd>
                  <dt>Service</dt>
                  <dd>{review.service_name || "—"}</dd>
                  <dt>Ticket hours</dt>
                  <dd>
                    {review.total_hours != null ? `${review.total_hours}h` : "—"}
                    {review.ticket_count != null
                      ? ` across ${review.ticket_count} ticket(s)`
                      : ""}
                  </dd>
                  {review.rate_basis && (
                    <>
                      <dt>Basis</dt>
                      <dd>{review.rate_basis}</dd>
                    </>
                  )}
                </dl>
                <p className="invoice-review-summary">{review.summary}</p>
                {review.concerns?.length > 0 && (
                  <ul className="invoice-review-concerns">
                    {review.concerns.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          {actionMessage && (
            <div className="ticket-detail-action-message">{actionMessage}</div>
          )}

          {invoice.invoice_status === "SUBMITTED" && !showRejectForm && (
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
                onClick={() => {
                  setShowRejectForm(true);
                  setActionMessage("");
                }}
                disabled={actionLoading}
              >
                Reject Invoice
              </button>
            </div>
          )}

          {invoice.invoice_status === "SUBMITTED" && showRejectForm && (
            <RejectionForm
              loadRecipients={() =>
                invoiceService.getNotificationRecipients(invoice.id)
              }
              onSubmit={handleRejectConfirm}
              onCancel={() => setShowRejectForm(false)}
              submitting={actionLoading}
              submitLabel="Confirm Rejection"
            />
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
