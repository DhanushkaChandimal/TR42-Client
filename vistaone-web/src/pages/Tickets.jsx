import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { ticketService } from "../services/ticketService";
import { workOrderService } from "../services/workOrderService";
import "../styles/tickets.css";

const STATUS_OPTIONS = [
  { value: "ALL", label: "All Statuses" },
  { value: "UNASSIGNED", label: "Unassigned" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "IN_PROGRESS", label: "In Progress" },
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
];

const WO_SECTIONS = [
  { key: "in_progress", label: "In Progress" },
  { key: "scheduled", label: "Scheduled — Not Started" },
  { key: "completed", label: "Completed" },
];

const NOT_STARTED_TICKETS = new Set(["UNASSIGNED", "ASSIGNED"]);

function dateValue(value) {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function sortTickets(list, sortBy) {
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
    case "created_desc":
    default:
      sorted.sort((a, b) => dateValue(b.created_at) - dateValue(a.created_at));
      break;
  }
  return sorted;
}

function bucketForGroup(tickets) {
  if (!tickets || tickets.length === 0) return "scheduled";
  const allCompleted = tickets.every((t) => t.status === "COMPLETED");
  if (allCompleted) return "completed";
  const noneStarted = tickets.every((t) => NOT_STARTED_TICKETS.has(t.status));
  if (noneStarted) return "scheduled";
  return "in_progress";
}

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString();
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
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const [collapsedSections, setCollapsedSections] = useState(() => new Set());

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
      const haystack = [
        t.description,
        t.assigned_contractor,
        t.vendor?.company_name,
        t.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
    return sortTickets(matched, sortBy);
  }, [tickets, searchTerm, statusFilter, priorityFilter, sortBy]);

  const grouped = useMemo(() => {
    const groups = new Map();
    filtered.forEach((t) => {
      const woId = t.work_order_id || "unassigned";
      if (!groups.has(woId)) groups.set(woId, []);
      groups.get(woId).push(t);
    });
    return Array.from(groups.entries());
  }, [filtered]);

  const sectionedGroups = useMemo(() => {
    const buckets = new Map(WO_SECTIONS.map((s) => [s.key, []]));
    grouped.forEach(([woId, group]) => {
      const woTicketsAll = tickets.filter((t) => t.work_order_id === woId);
      const bucket = bucketForGroup(woTicketsAll);
      buckets.get(bucket).push([woId, group]);
    });
    return buckets;
  }, [grouped, tickets]);

  const toggleGroup = (woId) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(woId)) next.delete(woId);
      else next.add(woId);
      return next;
    });
  };

  const toggleSection = (sectionKey) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionKey)) next.delete(sectionKey);
      else next.add(sectionKey);
      return next;
    });
  };

  return (
    <AppShell
      title="Tickets"
      subtitle="Track ticket execution across work orders"
      loading={loading}
      loadingText="Loading tickets..."
    >
      {error && <div className="tickets-error">{error}</div>}

      <section className="tickets-controls">
        <input
          type="search"
          className="tickets-search"
          placeholder="Search by description, vendor, or contractor..."
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

      {!loading && grouped.length === 0 && (
        <div className="tickets-empty">No tickets match your filters.</div>
      )}

      {WO_SECTIONS.map((section) => {
        const sectionGroups = sectionedGroups.get(section.key) || [];
        if (sectionGroups.length === 0) return null;
        const sectionCollapsed = collapsedSections.has(section.key);
        const totalTickets = sectionGroups.reduce(
          (sum, [, group]) => sum + group.length,
          0,
        );
        return (
          <div key={section.key} className="tickets-section">
            <button
              type="button"
              className={`tickets-section-header ${
                sectionCollapsed ? "collapsed" : ""
              }`}
              onClick={() => toggleSection(section.key)}
              aria-expanded={!sectionCollapsed}
            >
              <span className="tickets-section-chevron">
                {sectionCollapsed ? "▸" : "▾"}
              </span>
              <span className="tickets-section-title">{section.label}</span>
              <span className="tickets-section-meta">
                {sectionGroups.length} work order
                {sectionGroups.length === 1 ? "" : "s"} · {totalTickets} ticket
                {totalTickets === 1 ? "" : "s"}
              </span>
            </button>
            {!sectionCollapsed &&
              sectionGroups.map(([woId, group]) =>
                renderWorkOrderGroup(woId, group),
              )}
          </div>
        );
      })}
    </AppShell>
  );

  function renderWorkOrderGroup(woId, group) {
    const wo = workOrderLookup.get(woId);
    const woLabel = wo
      ? `Work Order #${wo.work_order_id ?? wo.id.slice(0, 8)}`
      : `Work Order ${woId.slice(0, 8)}`;
    const woDescription = wo?.description || "";
    const isCollapsed = collapsedGroups.has(woId);
    const completedCount = group.filter((t) => t.status === "COMPLETED").length;
    return (
      <section key={woId} className="tickets-group">
        <button
          type="button"
          className={`tickets-group-header ${isCollapsed ? "collapsed" : ""}`}
          onClick={() => toggleGroup(woId)}
          aria-expanded={!isCollapsed}
        >
          <span className="tickets-group-chevron">{isCollapsed ? "▸" : "▾"}</span>
          <span className="tickets-group-title">
            <span>{woLabel}</span>
            {woDescription && (
              <span className="tickets-group-subtitle">{woDescription}</span>
            )}
          </span>
          <span className="tickets-group-meta">
            {completedCount}/{group.length} completed
          </span>
        </button>

        {!isCollapsed && (
          <div className="tickets-table-wrap">
            <table className="tickets-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Contractor</th>
                  <th>Priority</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Anomaly</th>
                </tr>
              </thead>
              <tbody>
                {group.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div className="tickets-description">{t.description}</div>
                      {t.notes && (
                        <div className="tickets-description tickets-description-muted">
                          {t.notes}
                        </div>
                      )}
                    </td>
                    <td>{t.assigned_contractor || "-"}</td>
                    <td>
                      <span
                        className={`tickets-priority priority-${t.priority}`}
                      >
                        {t.priority || "-"}
                      </span>
                    </td>
                    <td>{formatDate(t.due_date)}</td>
                    <td>
                      <span className={`tickets-status status-${t.status}`}>
                        {t.status?.replace(/_/g, " ") || "-"}
                      </span>
                    </td>
                    <td>
                      {t.anomaly_flag ? (
                        <span className="tickets-anomaly" title={t.anomaly_reason || ""}>
                          ⚠ Flagged
                        </span>
                      ) : (
                        <span className="tickets-no-action">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }
}
