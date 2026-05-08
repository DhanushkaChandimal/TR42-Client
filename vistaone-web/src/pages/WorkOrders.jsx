import { useCallback, useState } from "react";
import AppShell from "../components/AppShell";
import { useAuthContext } from "../context/AuthContext";
import ExportButton from "../components/ExportButton";
import Pagination from "../components/Pagination";
import StatusSummaryCards from "../components/StatusSummaryCards";
import { usePaginatedList } from "../hooks/usePaginatedList";
import { workOrderService } from "../services/workOrderService";
import CreateWorkOrderModal from "../components/CreateWorkOrderModal";
import WorkOrderDetailModal from "../components/WorkOrderDetailModal";
import { exportService } from "../services/exportService";
import "../styles/workorder.css";
import "../styles/dataTable.css";

const SUMMARY_STATUSES = [
  { value: "UNASSIGNED", label: "Unassigned" },
  { value: "PENDING", label: "Pending" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "HALTED", label: "Halted" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CLOSED", label: "Closed" },
];

// Map UI column keys to actual WorkOrder attribute names the backend can sort by.
const SORT_COLUMN_MAP = {
  order_id: "work_order_code",
  vendor: "assigned_vendor",
  job_type: "service_type",
  location_type: "location_type",
  date: "created_at",
  status: "current_status",
};

const statusOptions = [
  { value: "ALL", label: "All" },
  { value: "UNASSIGNED", label: "Unassigned" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "APPROVED", label: "Approved" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CLOSED", label: "Closed" },
];

const HEADER_SORT_DEFAULTS = {
  order_id: "asc",
  vendor: "asc",
  job_type: "asc",
  location_type: "asc",
  date: "desc",
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

export default function WorkOrders() {
  const { hasPermission } = useAuthContext();
  const canWrite = hasPermission("workorders", "write");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("date_desc");
  const [showModal, setShowModal] = useState(false);
  const [detailOrder, setDetailOrder] = useState(null);

  const fetcher = useCallback(
    (page, perPage) => {
      const { column, direction } = parseSort(sortBy);
      return workOrderService.search({
        q: searchTerm.trim(),
        status: statusFilter === "ALL" ? "" : statusFilter,
        sort_by: SORT_COLUMN_MAP[column] || "created_at",
        order: direction || "desc",
        page,
        per_page: perPage,
      });
    },
    [searchTerm, statusFilter, sortBy],
  );

  const {
    items: filteredOrders,
    total,
    pages,
    page,
    perPage,
    loading,
    setPage,
    setPerPage,
    refresh,
  } = usePaginatedList(fetcher);

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

  const handleOpenModal = () => setShowModal(true);

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const formatStatusLabel = (status) => {
    if (!status) return "";
    if (status === "INVOICE_REJECTED") return "Invoice Rejected";
    if (status === "PENDING_REVIEW") return "Pending Review";
    return status.replace(/_/g, " ");
  };

  return (
    <AppShell
      title="Work Orders"
      subtitle="Manage field work orders"
      loading={loading}
      loadingText="Loading work orders..."
      controls={
        <>
          <ExportButton withDateRange onExport={exportService.workorders} />
          {canWrite && (
            <button
              className="workorders-create-btn"
              onClick={handleOpenModal}
              title="Create Work Order"
            >
              + Create Work Order
            </button>
          )}
        </>
      }
    >
      <StatusSummaryCards
        fetchSummary={workOrderService.summary}
        q={searchTerm.trim()}
        statuses={SUMMARY_STATUSES}
        activeStatus={statusFilter === "ALL" ? "" : statusFilter}
        onSelect={(value) => setStatusFilter(value || "ALL")}
        refreshKey={filteredOrders
          .map((o) => `${o.id}:${o.current_status}`)
          .join(",")}
      />

      <section className="workorders-controls">
        <input
          type="search"
          className="workorders-search"
          placeholder="Search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="workorders-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </section>

      <section className="data-table-wrap">
        {loading && filteredOrders.length === 0 ? (
          <div className="data-table-state">Loading work orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="data-table-state">No work orders found</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th {...headerProps("order_id", "order id")}>
                  Order ID {sortIndicator("order_id")}
                </th>
                <th {...headerProps("vendor", "vendor")}>
                  Vendor {sortIndicator("vendor")}
                </th>
                <th {...headerProps("job_type", "job type")}>
                  Job Type {sortIndicator("job_type")}
                </th>
                <th {...headerProps("location_type", "location type")}>
                  Location Type {sortIndicator("location_type")}
                </th>
                <th>Location</th>
                <th {...headerProps("date", "date")}>
                  Date {sortIndicator("date")}
                </th>
                <th {...headerProps("status", "status")}>
                  Status {sortIndicator("status")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr
                  key={order.work_order_code}
                  className="data-table-row-clickable"
                  onClick={() => setDetailOrder(order)}
                  tabIndex={0}
                  role="button"
                  aria-label={`View details for work order ${order.work_order_code}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setDetailOrder(order);
                    }
                  }}
                >
                  <td>{order.work_order_code ?? "—"}</td>
                  <td>{order.vendor?.company_name || order.vendor?.name || "—"}</td>
                  <td>{order.service?.service || "—"}</td>
                  <td>{order.location_type || "—"}</td>
                  <td>
                    {order.location_type === "ADDRESS" && order.location
                      ? order.location
                      : order.latitude != null && order.longitude != null
                      ? `${order.latitude}, ${order.longitude}`
                      : "—"}
                  </td>
                  <td>{formatDate(order.created_at)}</td>
                  <td>
                    {(() => {
                      const effective = order.display_status || order.current_status;
                      return (
                        <span
                          className={`status-badge status-${effective?.toLowerCase()}`}
                        >
                          {formatStatusLabel(effective)}
                        </span>
                      );
                    })()}
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

      {showModal && (
        <CreateWorkOrderModal
          setShowModal={setShowModal}
          fetchWorkOrders={refresh}
        />
      )}

      {detailOrder && (
        <WorkOrderDetailModal
          workOrder={detailOrder}
          onClose={() => setDetailOrder(null)}
          onSaved={refresh}
        />
      )}
    </AppShell>
  );
}
