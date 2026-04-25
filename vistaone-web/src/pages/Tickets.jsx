import { Fragment, useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { ticketService } from "../services/ticketService";
import { workOrderService } from "../services/workOrderService";
import "../styles/tickets.css";

const STATUS_OPTIONS = [
  { value: "ALL", label: "All Statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "PENDING_APPROVAL", label: "Pending Approval" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

const REVIEWABLE_STATUSES = new Set([
  "COMPLETED",
  "PENDING_APPROVAL",
  "REJECTED",
]);

const SORT_OPTIONS = [
  { value: "scheduled_desc", label: "Scheduled (newest first)" },
  { value: "scheduled_asc", label: "Scheduled (oldest first)" },
  { value: "created_desc", label: "Created (newest first)" },
  { value: "created_asc", label: "Created (oldest first)" },
];

function dateValue(value) {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function sortTickets(list, sortBy) {
  const sorted = [...list];
  switch (sortBy) {
    case "scheduled_asc":
      sorted.sort((a, b) => dateValue(a.scheduled_start) - dateValue(b.scheduled_start));
      break;
    case "scheduled_desc":
      sorted.sort((a, b) => dateValue(b.scheduled_start) - dateValue(a.scheduled_start));
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

const WO_SECTIONS = [
  { key: "in_progress", label: "In Progress" },
  { key: "scheduled", label: "Scheduled — Not Started" },
  { key: "completed", label: "Completed" },
];

const NOT_STARTED_TICKETS = new Set(["DRAFT", "ASSIGNED"]);

function bucketForGroup(tickets) {
  if (!tickets || tickets.length === 0) return "scheduled";
  const allApproved = tickets.every((t) => t.status === "APPROVED");
  if (allApproved) return "completed";
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
  const [statusFilter, setStatusFilter] = useState("PENDING_APPROVAL");
  const [sortBy, setSortBy] = useState("scheduled_desc");
  const [actionMessage, setActionMessage] = useState("");
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busyId, setBusyId] = useState(null);
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
      if (!term) return true;
      const haystack = [
        t.title,
        t.description,
        t.contractor_name,
        t.vendor?.company_name,
        t.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
    return sortTickets(matched, sortBy);
  }, [tickets, searchTerm, statusFilter, sortBy]);

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

  const replaceTicket = (saved) => {
    setTickets((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
  };

  const handleApprove = async (ticket) => {
    setBusyId(ticket.id);
    setActionMessage("");
    try {
      const saved = await ticketService.approve(ticket.id);
      replaceTicket(saved);
      setActionMessage(`Ticket #${saved.ticket_number} approved.`);
    } catch (err) {
      setActionMessage(err.message || "Failed to approve");
    } finally {
      setBusyId(null);
    }
  };

  const openReject = (ticket) => {
    setRejectingId(ticket.id);
    setRejectReason("");
    setActionMessage("");
  };

  const cancelReject = () => {
    setRejectingId(null);
    setRejectReason("");
  };

  const submitReject = async () => {
    if (!rejectReason.trim()) {
      setActionMessage("Rejection reason is required.");
      return;
    }
    setBusyId(rejectingId);
    try {
      const saved = await ticketService.reject(rejectingId, rejectReason);
      replaceTicket(saved);
      setActionMessage(`Ticket #${saved.ticket_number} rejected.`);
      cancelReject();
    } catch (err) {
      setActionMessage(err.message || "Failed to reject");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AppShell
      title="Tickets"
      subtitle="Review and approve work tickets submitted by vendors"
      loading={loading}
      loadingText="Loading tickets..."
    >
      {error && <div className="tickets-error">{error}</div>}

      <section className="tickets-controls">
        <input
          type="search"
          className="tickets-search"
          placeholder="Search by title, vendor, or contractor..."
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

      {actionMessage && (
        <div className="tickets-action-message">{actionMessage}</div>
      )}

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
        const approvedCount = group.filter((t) => t.status === "APPROVED").length;
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
                {approvedCount}/{group.length} approved
              </span>
            </button>

            {!isCollapsed && (
            <div className="tickets-table-wrap">
              <table className="tickets-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Title</th>
                    <th>Contractor</th>
                    <th>Scheduled</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {group.map((t) => {
                    const canReview = REVIEWABLE_STATUSES.has(t.status);
                    const isRejecting = rejectingId === t.id;
                    const busy = busyId === t.id;
                    return (
                      <Fragment key={t.id}>
                        <tr>
                          <td>{t.ticket_number ?? "-"}</td>
                          <td>
                            <div className="tickets-title">{t.title}</div>
                            {t.description && (
                              <div className="tickets-description">
                                {t.description}
                              </div>
                            )}
                          </td>
                          <td>{t.contractor_name || "-"}</td>
                          <td>
                            {formatDate(t.scheduled_start)}
                            {t.scheduled_end
                              ? ` → ${formatDate(t.scheduled_end)}`
                              : ""}
                          </td>
                          <td>
                            <span
                              className={`tickets-status status-${t.status}`}
                            >
                              {t.status.replace(/_/g, " ")}
                            </span>
                            {t.status === "REJECTED" && t.rejection_reason && (
                              <div className="tickets-rejection-note">
                                Reason: {t.rejection_reason}
                              </div>
                            )}
                          </td>
                          <td className="tickets-actions">
                            {canReview && !isRejecting && (
                              <>
                                <button
                                  type="button"
                                  className="tickets-btn tickets-btn-approve"
                                  disabled={busy}
                                  onClick={() => handleApprove(t)}
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  className="tickets-btn tickets-btn-reject"
                                  disabled={busy}
                                  onClick={() => openReject(t)}
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {!canReview && (
                              <span className="tickets-no-action">—</span>
                            )}
                          </td>
                        </tr>
                        {isRejecting && (
                          <tr>
                            <td colSpan={6} className="tickets-reject-row">
                              <label>
                                Rejection notes (sent to vendor):
                                <textarea
                                  value={rejectReason}
                                  onChange={(e) =>
                                    setRejectReason(e.target.value)
                                  }
                                  rows={3}
                                  placeholder="What needs to be redone?"
                                />
                              </label>
                              <div className="tickets-reject-actions">
                                <button
                                  type="button"
                                  className="tickets-btn tickets-btn-reject"
                                  disabled={busy}
                                  onClick={submitReject}
                                >
                                  Send Rejection
                                </button>
                                <button
                                  type="button"
                                  className="tickets-btn tickets-btn-cancel"
                                  disabled={busy}
                                  onClick={cancelReject}
                                >
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}
          </section>
        );
  }
}
