import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import ExportButton from "../components/ExportButton";
import InvoiceDetailModal from "../components/InvoiceDetailModal";
import { exportService } from "../services/exportService";
import { useInvoice } from "../hooks/useInvoice";
import "../styles/invoices.css";

const statusOptions = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

const STATUS_RANK = { PENDING: 0, APPROVED: 1, REJECTED: 2 };

const HEADER_SORT_DEFAULTS = {
  vendor: "asc",
  amount: "desc",
  invoice_date: "desc",
  due_date: "asc",
  status: "asc",
};

function dateValue(value) {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function vendorLabel(inv) {
  return (inv.vendor?.company_name || inv.vendor?.name || "").toLowerCase();
}

function parseSort(sortBy) {
  const m = sortBy?.match(/^(.*)_(asc|desc)$/);
  if (!m) return { column: null, direction: null };
  return { column: m[1], direction: m[2] };
}

function nextSortFor(column, sortBy) {
  const current = parseSort(sortBy);
  const def = HEADER_SORT_DEFAULTS[column] || "asc";
  if (current.column !== column) return `${column}_${def}`;
  return current.direction === "asc" ? `${column}_desc` : `${column}_asc`;
}

function sortInvoices(list, sortBy) {
  const sorted = [...list];
  switch (sortBy) {
    case "vendor_asc":
      sorted.sort((a, b) => vendorLabel(a).localeCompare(vendorLabel(b)));
      break;
    case "vendor_desc":
      sorted.sort((a, b) => vendorLabel(b).localeCompare(vendorLabel(a)));
      break;
    case "amount_asc":
      sorted.sort(
        (a, b) => Number(a.total_amount || 0) - Number(b.total_amount || 0),
      );
      break;
    case "amount_desc":
      sorted.sort(
        (a, b) => Number(b.total_amount || 0) - Number(a.total_amount || 0),
      );
      break;
    case "invoice_date_asc":
      sorted.sort((a, b) => dateValue(a.invoice_date) - dateValue(b.invoice_date));
      break;
    case "invoice_date_desc":
      sorted.sort((a, b) => dateValue(b.invoice_date) - dateValue(a.invoice_date));
      break;
    case "due_date_asc":
      sorted.sort((a, b) => dateValue(a.due_date) - dateValue(b.due_date));
      break;
    case "due_date_desc":
      sorted.sort((a, b) => dateValue(b.due_date) - dateValue(a.due_date));
      break;
    case "status_asc":
      sorted.sort(
        (a, b) =>
          (STATUS_RANK[a.invoice_status] ?? 99) -
          (STATUS_RANK[b.invoice_status] ?? 99),
      );
      break;
    case "status_desc":
      sorted.sort(
        (a, b) =>
          (STATUS_RANK[b.invoice_status] ?? 99) -
          (STATUS_RANK[a.invoice_status] ?? 99),
      );
      break;
    default:
      break;
  }
  return sorted;
}

export default function Invoices() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("invoice_date_desc");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const {
    invoices,
    loading,
    fetchInvoices,
    approveInvoice,
    rejectInvoice,
    setInvoicePending,
  } = useInvoice();

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const filteredInvoices = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const matched = invoices.filter((inv) => {
      const matchesStatus =
        statusFilter === "ALL" || inv.invoice_status === statusFilter;
      const matchesSearch =
        (inv.id || "").toLowerCase().includes(search) ||
        (inv.vendor?.company_name || inv.vendor?.name || "").toLowerCase().includes(search) ||
        (inv.client_id || "").toLowerCase().includes(search);
      return matchesStatus && matchesSearch;
    });
    return sortInvoices(matched, sortBy);
  }, [invoices, searchTerm, statusFilter, sortBy]);

  const activeSort = parseSort(sortBy);
  const handleHeaderSort = (column) => setSortBy(nextSortFor(column, sortBy));
  const sortIndicator = (column) => {
    if (activeSort.column !== column) return null;
    return (
      <span className="inv-sort-arrow" aria-hidden="true">
        {activeSort.direction === "asc" ? "▲" : "▼"}
      </span>
    );
  };
  const headerProps = (column, label) => ({
    onClick: () => handleHeaderSort(column),
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleHeaderSort(column);
      }
    },
    tabIndex: 0,
    role: "button",
    className: `inv-th-sortable ${
      activeSort.column === column ? "is-active" : ""
    }`,
    "aria-sort":
      activeSort.column === column
        ? activeSort.direction === "asc"
          ? "ascending"
          : "descending"
        : "none",
    "aria-label": `Sort by ${label}`,
  });

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
    const updated = await approveInvoice(invoiceId);
    setSelectedInvoice(updated);
    return updated;
  };

  const handleReject = async (invoiceId) => {
    const updated = await rejectInvoice(invoiceId);
    setSelectedInvoice(updated);
    return updated;
  };

  const handleUndo = async (invoiceId) => {
    const updated = await setInvoicePending(invoiceId);
    setSelectedInvoice(updated);
    return updated;
  };

  const statusCounts = useMemo(() => {
    const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
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
      controls={<ExportButton withDateRange onExport={exportService.invoices} />}
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

      <section className="inv-table-wrap">
          {!loading && filteredInvoices.length === 0 ? (
            <div className="inv-empty">No invoices found</div>
          ) : (
            <table className="inv-table inv-table-flat">
              <thead>
                <tr>
                  <th {...headerProps("vendor", "vendor")}>
                    Vendor {sortIndicator("vendor")}
                  </th>
                  <th {...headerProps("amount", "amount")}>
                    Amount {sortIndicator("amount")}
                  </th>
                  <th {...headerProps("invoice_date", "invoice date")}>
                    Invoice Date {sortIndicator("invoice_date")}
                  </th>
                  <th {...headerProps("due_date", "due date")}>
                    Due Date {sortIndicator("due_date")}
                  </th>
                  <th {...headerProps("status", "status")}>
                    Status {sortIndicator("status")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className={`inv-row inv-row-clickable ${
                      selectedInvoice?.id === inv.id ? "inv-row-selected" : ""
                    }`}
                    onClick={() => {
                      setSelectedInvoice(inv);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedInvoice(inv);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Review invoice ${inv.id?.slice(0, 8)}`}
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {selectedInvoice && (
          <InvoiceDetailModal
            invoice={selectedInvoice}
            onClose={() => setSelectedInvoice(null)}
            onApprove={handleApprove}
            onReject={handleReject}
            onUndo={handleUndo}
          />
        )}
    </AppShell>
  );
}
