import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import ExportButton from "../components/ExportButton";
import Pagination from "../components/Pagination";
import StatusSummaryCards from "../components/StatusSummaryCards";
import TicketDetailModal from "../components/TicketDetailModal";
import { exportService } from "../services/exportService";
import { ticketService } from "../services/ticketService";
import { workOrderService } from "../services/workOrderService";
import { usePaginatedList } from "../hooks/usePaginatedList";
import "../styles/tickets.css";
import "../styles/dataTable.css";

const SUMMARY_STATUSES = [
  { value: "UNASSIGNED", label: "Unassigned" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "PENDING_APPROVAL", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "COMPLETED", label: "Completed" },
];

const STATUS_OPTIONS = [
  { value: "ALL", label: "All Statuses" },
  { value: "UNASSIGNED", label: "Unassigned" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "PENDING_APPROVAL", label: "Pending Approval" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "COMPLETED", label: "Completed" },
];

const PRIORITY_OPTIONS = [
  { value: "ALL", label: "All Priorities" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

// UI sort key -> backend sort_by token. The backend whitelists these and
// joins where needed so sort applies across the entire dataset, not just
// the visible page.
const SORT_COLUMN_MAP = {
  wo: "work_order",
  description: "description",
  vendor: "vendor",
  contractor: "assigned_contractor",
  priority: "priority",
  due: "due_date",
  status: "status",
  cost: "cost",
};

const HEADER_SORT_DEFAULTS = {
  wo: "asc",
  description: "asc",
  vendor: "asc",
  contractor: "asc",
  priority: "asc",
  due: "asc",
  status: "asc",
  cost: "desc",
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

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function formatCurrency(n) {
  if (n == null) return "—";
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function ticketCost(t) {
  const total = t.invoice?.total_amount;
  if (total == null) return null;
  const n = Number(total);
  return Number.isFinite(n) ? n : null;
}

export default function Tickets() {
  const [workOrders, setWorkOrders] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("due_asc");
  const [selectedTicketId, setSelectedTicketId] = useState(null);

  const fetcher = useCallback(
    (page, perPage) => {
      const { column, direction } = parseSort(sortBy);
      return ticketService.search({
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
    items: tickets,
    total,
    pages,
    page,
    perPage,
    loading,
    setPage,
    setPerPage,
    refresh,
  } = usePaginatedList(fetcher);

  useEffect(() => {
    let cancelled = false;
    workOrderService
      .getAll()
      .then((data) => {
        if (!cancelled) setWorkOrders(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const workOrderLookup = useMemo(() => {
    const map = new Map();
    workOrders.forEach((wo) => map.set(wo.id, wo));
    return map;
  }, [workOrders]);

  // Priority is the only client-only filter (status + search go through the
  // backend). Don't re-sort here — the backend already returned the right slice.
  const filtered = useMemo(() => {
    if (priorityFilter === "ALL") return tickets;
    return tickets.filter((t) => t.priority === priorityFilter);
  }, [tickets, priorityFilter]);

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

  return (
    <AppShell
      title="Tickets"
      subtitle="Track ticket execution across work orders"
      loading={loading}
      loadingText="Loading tickets..."
      controls={<ExportButton withDateRange onExport={exportService.tickets} />}
    >
      <StatusSummaryCards
        fetchSummary={ticketService.summary}
        q={searchTerm.trim()}
        statuses={SUMMARY_STATUSES}
        activeStatus={statusFilter === "ALL" ? "" : statusFilter}
        onSelect={(value) => setStatusFilter(value || "ALL")}
        refreshKey={tickets.map((t) => `${t.id}:${t.status}`).join(",")}
      />

      <section className="tickets-controls">
        <input
          type="search"
          className="tickets-search"
          placeholder="Search by description, vendor, contractor, or WO #..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="tickets-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          className="tickets-filter"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
        >
          {PRIORITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </section>

      <section className="data-table-wrap">
        {!loading && filtered.length === 0 ? (
          <div className="data-table-state">No tickets match your filters.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th {...headerProps("wo", "work order")}>
                  Work Order {sortIndicator("wo")}
                </th>
                <th {...headerProps("description", "description")}>
                  Description {sortIndicator("description")}
                </th>
                <th {...headerProps("vendor", "vendor")}>
                  Vendor {sortIndicator("vendor")}
                </th>
                <th {...headerProps("contractor", "contractor")}>
                  Contractor {sortIndicator("contractor")}
                </th>
                <th {...headerProps("priority", "priority")}>
                  Priority {sortIndicator("priority")}
                </th>
                <th {...headerProps("due", "due date")}>
                  Due {sortIndicator("due")}
                </th>
                <th {...headerProps("status", "status")}>
                  Status {sortIndicator("status")}
                </th>
                <th {...headerProps("cost", "cost")}>
                  Cost {sortIndicator("cost")}
                </th>
                <th>Anomaly</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const wo = workOrderLookup.get(t.work_order_id);
                const woLabel = wo
                  ? `#${wo.work_order_code ?? wo.id?.slice(0, 8)}`
                  : `#${t.work_order_id?.slice(0, 8) || "—"}`;
                const cost = ticketCost(t);
                return (
                  <tr
                    key={t.id}
                    className={`data-table-row-clickable ${
                      selectedTicketId === t.id ? "data-table-row-selected" : ""
                    }`}
                    onClick={() => setSelectedTicketId(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedTicketId(t.id);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open ticket ${t.id.slice(0, 8)}`}
                  >
                    <td className="tickets-cell-wo">{woLabel}</td>
                    <td>
                      <div
                        className="tickets-description"
                        title={t.description || ""}
                      >
                        {t.description}
                      </div>
                    </td>
                    <td>{t.vendor?.company_name || t.vendor?.name || "—"}</td>
                    <td>{t.assigned_contractor || "—"}</td>
                    <td>
                      <span
                        className={`tickets-priority priority-${t.priority}`}
                      >
                        {t.priority || "—"}
                      </span>
                    </td>
                    <td>{formatDate(t.due_date)}</td>
                    <td>
                      <span className={`tickets-status status-${t.status}`}>
                        {t.status?.replace(/_/g, " ") || "—"}
                      </span>
                    </td>
                    <td className="data-table-cell-numeric tickets-cell-cost">
                      {formatCurrency(cost)}
                    </td>
                    <td>
                      {t.anomaly_flag ? (
                        <span
                          className="tickets-anomaly"
                          title={t.anomaly_reason || ""}
                        >
                          ⚠ Flagged
                        </span>
                      ) : (
                        <span className="tickets-no-action">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
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

      {selectedTicketId && (
        <TicketDetailModal
          ticketId={selectedTicketId}
          onClose={() => setSelectedTicketId(null)}
          onStatusChange={refresh}
        />
      )}
    </AppShell>
  );
}
