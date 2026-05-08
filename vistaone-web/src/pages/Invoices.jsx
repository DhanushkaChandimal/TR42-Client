import { useCallback, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import ExportButton from "../components/ExportButton";
import InvoiceDetailModal from "../components/InvoiceDetailModal";
import Pagination from "../components/Pagination";
import StatusSummaryCards from "../components/StatusSummaryCards";
import { exportService } from "../services/exportService";
import { invoiceService } from "../services/invoiceService";
import { usePaginatedList } from "../hooks/usePaginatedList";
import "../styles/invoices.css";
import "../styles/dataTable.css";

const statusOptions = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "PAID", label: "Paid" },
];

const SUMMARY_STATUSES = statusOptions.slice(1);

const SORT_COLUMN_MAP = {
  vendor: "vendor",
  amount: "total_amount",
  invoice_date: "invoice_date",
  due_date: "due_date",
  status: "invoice_status",
};

const HEADER_SORT_DEFAULTS = {
  vendor: "asc",
  amount: "desc",
  invoice_date: "desc",
  due_date: "asc",
  status: "asc",
};

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

export default function Invoices() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("invoice_date_desc");
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const fetcher = useCallback(
    (page, perPage) => {
      const { column, direction } = parseSort(sortBy);
      return invoiceService.search({
        q: searchTerm.trim(),
        status: statusFilter === "ALL" ? "" : statusFilter,
        page,
        per_page: perPage,
        sort_by: SORT_COLUMN_MAP[column] || "created_at",
        order: direction || "desc",
      });
    },
    [searchTerm, statusFilter, sortBy],
  );

  const {
    items: invoices,
    total,
    pages,
    page,
    perPage,
    loading,
    setPage,
    setPerPage,
    refresh,
  } = usePaginatedList(fetcher);

  const approveInvoice = async (id) => { const u = await invoiceService.approve(id); refresh(); return u; };
  const rejectInvoice = async (id, note, recipientIds) => {
    const u = await invoiceService.reject(id, note, recipientIds);
    refresh();
    return u;
  };
  const setInvoicePending = async (id) => { const u = await invoiceService.setPending(id); refresh(); return u; };

  const activeSort = parseSort(sortBy);
  const handleHeaderSort = (column) => setSortBy(nextSortFor(column, sortBy));
  const sortIndicator = (column) => {
    if (activeSort.column !== column) return null;
    return (
      <span className="data-table-sort-arrow" aria-hidden="true">
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
    className: `data-table-th-sortable ${
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

  const handleReject = async (invoiceId, note, recipientIds) => {
    const updated = await rejectInvoice(invoiceId, note, recipientIds);
    setSelectedInvoice(updated);
    return updated;
  };

  const handleUndo = async (invoiceId) => {
    const updated = await setInvoicePending(invoiceId);
    setSelectedInvoice(updated);
    return updated;
  };

  // Bumping this counter forces the StatusSummaryCards to refetch when an
  // invoice changes status (approve/reject/undo).
  const summaryRefreshKey = useMemo(
    () => invoices.map((i) => `${i.id}:${i.invoice_status}`).join(","),
    [invoices],
  );

  return (
    <AppShell
      title="Invoices"
      subtitle="Review, approve, and manage invoices"
      loading={loading}
      loadingText="Loading invoices..."
      controls={<ExportButton withDateRange onExport={exportService.invoices} />}
    >
      <StatusSummaryCards
        fetchSummary={invoiceService.summary}
        q={searchTerm.trim()}
        statuses={SUMMARY_STATUSES}
        activeStatus={statusFilter === "ALL" ? "" : statusFilter}
        onSelect={(value) => setStatusFilter(value || "ALL")}
        refreshKey={summaryRefreshKey}
      />

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

      <section className="data-table-wrap">
        {!loading && invoices.length === 0 ? (
          <div className="data-table-state">No invoices found</div>
        ) : (
          <table className="data-table">
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
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className={`data-table-row-clickable ${
                    selectedInvoice?.id === inv.id ? "data-table-row-selected" : ""
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
                  <td className="data-table-cell-numeric inv-amount">
                    {formatCurrency(inv.total_amount)}
                  </td>
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
        <Pagination
          page={page}
          pages={pages}
          total={total}
          perPage={perPage}
          onPageChange={setPage}
          onPerPageChange={(n) => {
            setPerPage(n);
            setPage(1);
          }}
          disabled={loading}
        />
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
