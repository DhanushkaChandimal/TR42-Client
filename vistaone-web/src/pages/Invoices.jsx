import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { useInvoice } from "../hooks/useInvoice";
import "../styles/invoices.css";

const statusOptions = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "PAID", label: "Paid" },
];

export default function Invoices() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const {
    invoices,
    loading,
    fetchInvoices,
    approveInvoice,
    rejectInvoice,
  } = useInvoice();

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const filteredInvoices = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return invoices.filter((inv) => {
      const matchesStatus =
        statusFilter === "ALL" || inv.invoice_status === statusFilter;
      const matchesSearch =
        (inv.id || "").toLowerCase().includes(search) ||
        (inv.vendor?.company_name || inv.vendor?.name || "").toLowerCase().includes(search) ||
        (inv.client_id || "").toLowerCase().includes(search);
      return matchesStatus && matchesSearch;
    });
  }, [invoices, searchTerm, statusFilter]);

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-US", {
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

  const handleApprove = async (invoiceId) => {
    setActionLoading(true);
    setActionMessage("");
    try {
      const updated = await approveInvoice(invoiceId);
      setSelectedInvoice(updated);
      setActionMessage("Invoice approved successfully");
    } catch (err) {
      setActionMessage(err.message || "Failed to approve");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (invoiceId) => {
    setActionLoading(true);
    setActionMessage("");
    try {
      const updated = await rejectInvoice(invoiceId);
      setSelectedInvoice(updated);
      setActionMessage("Invoice rejected");
    } catch (err) {
      setActionMessage(err.message || "Failed to reject");
    } finally {
      setActionLoading(false);
    }
  };

  const statusCounts = useMemo(() => {
    const counts = { DRAFT: 0, SUBMITTED: 0, APPROVED: 0, REJECTED: 0, PAID: 0 };
    invoices.forEach((inv) => {
      if (counts[inv.invoice_status] !== undefined) {
        counts[inv.invoice_status]++;
      }
    });
    return counts;
  }, [invoices]);

  return (
    <AppShell
      title="Invoices"
      subtitle="Review, approve, and manage invoices"
      loading={loading}
      loadingText="Loading invoices..."
    >
      {/* Status summary cards */}
      <section className="inv-summary">
        {statusOptions.slice(1).map((opt) => (
          <div
            key={opt.value}
            className={`inv-summary-card inv-summary-${opt.value.toLowerCase()} ${
              statusFilter === opt.value ? "inv-summary-active" : ""
            }`}
            onClick={() =>
              setStatusFilter(statusFilter === opt.value ? "ALL" : opt.value)
            }
          >
            <p className="inv-summary-count">{statusCounts[opt.value] || 0}</p>
            <p className="inv-summary-label">{opt.label}</p>
          </div>
        ))}
      </section>

      <section className="inv-controls">
        <input
          type="search"
          className="inv-search"
          placeholder="Search by ID, vendor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="inv-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </section>

      <div className="inv-layout">
        {/* Invoice list */}
        <section className="inv-table-wrap">
          {!loading && filteredInvoices.length === 0 ? (
            <div className="inv-empty">No invoices found</div>
          ) : (
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Amount</th>
                  <th>Invoice Date</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className={`inv-row ${
                      selectedInvoice?.id === inv.id ? "inv-row-selected" : ""
                    }`}
                  >
                    <td>{inv.vendor?.company_name || inv.vendor?.name || "-"}</td>
                    <td className="inv-amount">{formatCurrency(inv.total_amount)}</td>
                    <td>{formatDate(inv.invoice_date)}</td>
                    <td>{formatDate(inv.due_date)}</td>
                    <td>
                      <span className={`inv-badge inv-badge-${inv.invoice_status?.toLowerCase()}`}>
                        {inv.invoice_status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="inv-review-btn"
                        onClick={() => {
                          setSelectedInvoice(inv);
                          setActionMessage("");
                        }}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Invoice detail panel */}
        {selectedInvoice && (
          <section className="inv-detail-panel">
            <div className="inv-detail-header">
              <h3>Invoice Review</h3>
              <button
                className="inv-detail-close"
                onClick={() => {
                  setSelectedInvoice(null);
                  setActionMessage("");
                }}
              >
                Close
              </button>
            </div>

            <div className="inv-detail-body">
              <div className="inv-detail-row">
                <span className="inv-detail-label">Invoice ID</span>
                <span className="inv-detail-value">{selectedInvoice.id}</span>
              </div>
              <div className="inv-detail-row">
                <span className="inv-detail-label">Vendor</span>
                <span className="inv-detail-value">
                  {selectedInvoice.vendor?.company_name || selectedInvoice.vendor?.name || "-"}
                </span>
              </div>
              <div className="inv-detail-row">
                <span className="inv-detail-label">Amount</span>
                <span className="inv-detail-value inv-detail-amount">
                  {formatCurrency(selectedInvoice.total_amount)}
                </span>
              </div>
              <div className="inv-detail-row">
                <span className="inv-detail-label">Status</span>
                <span className={`inv-badge inv-badge-${selectedInvoice.invoice_status?.toLowerCase()}`}>
                  {selectedInvoice.invoice_status}
                </span>
              </div>
              <div className="inv-detail-row">
                <span className="inv-detail-label">Invoice Date</span>
                <span className="inv-detail-value">{formatDate(selectedInvoice.invoice_date)}</span>
              </div>
              <div className="inv-detail-row">
                <span className="inv-detail-label">Due Date</span>
                <span className="inv-detail-value">{formatDate(selectedInvoice.due_date)}</span>
              </div>
              {selectedInvoice.period_start && (
                <div className="inv-detail-row">
                  <span className="inv-detail-label">Period</span>
                  <span className="inv-detail-value">
                    {formatDate(selectedInvoice.period_start)} - {formatDate(selectedInvoice.period_end)}
                  </span>
                </div>
              )}
              {selectedInvoice.approved_at && (
                <div className="inv-detail-row">
                  <span className="inv-detail-label">Approved At</span>
                  <span className="inv-detail-value">{formatDate(selectedInvoice.approved_at)}</span>
                </div>
              )}
              {selectedInvoice.rejected_at && (
                <div className="inv-detail-row">
                  <span className="inv-detail-label">Rejected At</span>
                  <span className="inv-detail-value">{formatDate(selectedInvoice.rejected_at)}</span>
                </div>
              )}

              {/* Line items */}
              {selectedInvoice.line_items && selectedInvoice.line_items.length > 0 && (
                <div className="inv-line-items">
                  <h4>Line Items</h4>
                  <table className="inv-line-table">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Qty</th>
                        <th>Rate</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.line_items.map((item, i) => (
                        <tr key={item.id || i}>
                          <td>{item.description || "-"}</td>
                          <td>{item.quantity}</td>
                          <td>{formatCurrency(item.rate)}</td>
                          <td>{formatCurrency(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {actionMessage && (
                <div className="inv-action-message">{actionMessage}</div>
              )}

              {/* Approve / Reject buttons - only show for SUBMITTED invoices */}
              {selectedInvoice.invoice_status === "SUBMITTED" && (
                <div className="inv-detail-actions">
                  <button
                    className="inv-btn-approve"
                    onClick={() => handleApprove(selectedInvoice.id)}
                    disabled={actionLoading}
                  >
                    {actionLoading ? "Processing..." : "Approve Invoice"}
                  </button>
                  <button
                    className="inv-btn-reject"
                    onClick={() => handleReject(selectedInvoice.id)}
                    disabled={actionLoading}
                  >
                    {actionLoading ? "Processing..." : "Reject Invoice"}
                  </button>
                </div>
              )}

              {selectedInvoice.invoice_status === "DRAFT" && (
                <p className="inv-detail-note">
                  This invoice is in draft. It must be submitted before it can be reviewed.
                </p>
              )}

              {selectedInvoice.invoice_status === "APPROVED" && (
                <p className="inv-detail-note inv-detail-note-success">
                  This invoice has been approved and is awaiting payment.
                </p>
              )}

              {selectedInvoice.invoice_status === "REJECTED" && (
                <p className="inv-detail-note inv-detail-note-error">
                  This invoice was rejected. The vendor will need to resubmit.
                </p>
              )}

              {selectedInvoice.invoice_status === "PAID" && (
                <p className="inv-detail-note inv-detail-note-success">
                  This invoice has been paid.
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
