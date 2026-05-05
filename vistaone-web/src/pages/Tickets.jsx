import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import ExportButton from "../components/ExportButton";
import TicketDetailModal from "../components/TicketDetailModal";
import { exportService } from "../services/exportService";
import { ticketService } from "../services/ticketService";
import { workOrderService } from "../services/workOrderService";
import "../styles/tickets.css";

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

const SORT_OPTIONS = [
  { value: "due_asc", label: "Due date (soonest first)" },
  { value: "due_desc", label: "Due date (latest first)" },
  { value: "created_desc", label: "Created (newest first)" },
  { value: "created_asc", label: "Created (oldest first)" },
  { value: "wo_asc", label: "Work order (low to high)" },
  { value: "wo_desc", label: "Work order (high to low)" },
  { value: "description_asc", label: "Description (A → Z)" },
  { value: "description_desc", label: "Description (Z → A)" },
  { value: "vendor_asc", label: "Vendor (A → Z)" },
  { value: "vendor_desc", label: "Vendor (Z → A)" },
  { value: "contractor_asc", label: "Contractor (A → Z)" },
  { value: "contractor_desc", label: "Contractor (Z → A)" },
  { value: "priority_asc", label: "Priority (high first)" },
  { value: "priority_desc", label: "Priority (low first)" },
  { value: "status_asc", label: "Status" },
  { value: "cost_desc", label: "Cost (high to low)" },
  { value: "cost_asc", label: "Cost (low to high)" },
];

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

const PRIORITY_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const STATUS_RANK = {
  PENDING_APPROVAL: 0,
  IN_PROGRESS: 1,
  ASSIGNED: 2,
  UNASSIGNED: 3,
  APPROVED: 4,
  REJECTED: 5,
  COMPLETED: 6,
};

function dateValue(value) {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function vendorLabel(t) {
  return (t.vendor?.company_name || t.vendor?.name || "").toLowerCase();
}

function descriptionLabel(t) {
  return (t.description || "").toLowerCase();
}

function contractorLabel(t) {
  return (t.assigned_contractor || "").toLowerCase();
}

function woNumberValue(t, lookup) {
  const wo = lookup.get(t.work_order_id);
  const n = Number(wo?.work_order_code);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

function ticketCost(t) {
  const total = t.invoice?.total_amount;
  if (total == null) return null;
  const n = Number(total);
  return Number.isFinite(n) ? n : null;
}

function sortTickets(list, sortBy, lookup) {
  const sorted = [...list];
  switch (sortBy) {
    case "due_asc":
      sorted.sort((a, b) => dateValue(a.due_date) - dateValue(b.due_date));
      break;
    case "due_desc":
      sorted.sort((a, b) => dateValue(b.due_date) - dateValue(a.due_date));
      break;
    case "created_asc":
      sorted.sort((a, b) => dateValue(a.created_at) - dateValue(b.created_at));
      break;
    case "wo_asc":
      sorted.sort(
        (a, b) => woNumberValue(a, lookup) - woNumberValue(b, lookup),
      );
      break;
    case "wo_desc":
      sorted.sort(
        (a, b) => woNumberValue(b, lookup) - woNumberValue(a, lookup),
      );
      break;
    case "description_asc":
      sorted.sort((a, b) =>
        descriptionLabel(a).localeCompare(descriptionLabel(b)),
      );
      break;
    case "description_desc":
      sorted.sort((a, b) =>
        descriptionLabel(b).localeCompare(descriptionLabel(a)),
      );
      break;
    case "vendor_asc":
      sorted.sort((a, b) => vendorLabel(a).localeCompare(vendorLabel(b)));
      break;
    case "vendor_desc":
      sorted.sort((a, b) => vendorLabel(b).localeCompare(vendorLabel(a)));
      break;
    case "contractor_asc":
      sorted.sort((a, b) =>
        contractorLabel(a).localeCompare(contractorLabel(b)),
      );
      break;
    case "contractor_desc":
      sorted.sort((a, b) =>
        contractorLabel(b).localeCompare(contractorLabel(a)),
      );
      break;
    case "priority_asc":
      sorted.sort(
        (a, b) =>
          (PRIORITY_RANK[a.priority] ?? 99) -
          (PRIORITY_RANK[b.priority] ?? 99),
      );
      break;
    case "priority_desc":
      sorted.sort(
        (a, b) =>
          (PRIORITY_RANK[b.priority] ?? 99) -
          (PRIORITY_RANK[a.priority] ?? 99),
      );
      break;
    case "status_asc":
    case "status":
      sorted.sort(
        (a, b) =>
          (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99),
      );
      break;
    case "status_desc":
      sorted.sort(
        (a, b) =>
          (STATUS_RANK[b.status] ?? 99) - (STATUS_RANK[a.status] ?? 99),
      );
      break;
    case "cost_desc":
      sorted.sort((a, b) => (ticketCost(b) ?? -1) - (ticketCost(a) ?? -1));
      break;
    case "cost_asc":
      sorted.sort(
        (a, b) =>
          (ticketCost(a) ?? Number.POSITIVE_INFINITY) -
          (ticketCost(b) ?? Number.POSITIVE_INFINITY),
      );
      break;
    case "created_desc":
    default:
      sorted.sort((a, b) => dateValue(b.created_at) - dateValue(a.created_at));
      break;
  }
  return sorted;
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

export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("due_asc");
  const [selectedTicketId, setSelectedTicketId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [ticketData, woData] = await Promise.all([
          ticketService.getAll(),
          workOrderService.getAll().catch(() => []),
        ]);
        if (cancelled) return;
        setTickets(ticketData);
        setWorkOrders(Array.isArray(woData) ? woData : []);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load tickets");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const workOrderLookup = useMemo(() => {
    const map = new Map();
    workOrders.forEach((wo) => map.set(wo.id, wo));
    return map;
  }, [workOrders]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const matched = tickets.filter((t) => {
      const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
      if (!matchesStatus) return false;
      const matchesPriority =
        priorityFilter === "ALL" || t.priority === priorityFilter;
      if (!matchesPriority) return false;
      if (!term) return true;
      const wo = workOrderLookup.get(t.work_order_id);
      const woNumber = wo?.work_order_code != null ? `#${wo.work_order_code}` : "";
      const haystack = [
        t.description,
        t.assigned_contractor,
        t.vendor?.company_name,
        t.vendor?.name,
        woNumber,
        t.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
    return sortTickets(matched, sortBy, workOrderLookup);
  }, [tickets, workOrderLookup, searchTerm, statusFilter, priorityFilter, sortBy]);

  const activeSort = parseSort(sortBy);
  const handleHeaderSort = (column) => setSortBy(nextSortFor(column, sortBy));
  const sortIndicator = (column) => {
    if (activeSort.column !== column) return null;
    return (
      <span className="tickets-sort-arrow" aria-hidden="true">
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
    className: `tickets-th-sortable ${
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
      {error && <div className="tickets-error">{error}</div>}

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
        <select
          className="tickets-filter"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          aria-label="Sort tickets"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </section>

      <section className="tickets-table-wrap">
        {!loading && filtered.length === 0 ? (
          <div className="tickets-empty">No tickets match your filters.</div>
        ) : (
          <table className="tickets-table tickets-table-flat">
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
                    className={`tickets-row tickets-row-clickable ${
                      selectedTicketId === t.id ? "tickets-row-selected" : ""
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
                    <td className="tickets-cell-cost">{formatCurrency(cost)}</td>
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
      </section>

      {selectedTicketId && (
        <TicketDetailModal
          ticketId={selectedTicketId}
          onClose={() => setSelectedTicketId(null)}
          onStatusChange={(updated) => {
            setTickets((prev) =>
              prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)),
            );
          }}
        />
      )}
    </AppShell>
  );
}
