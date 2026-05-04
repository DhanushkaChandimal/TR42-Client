import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import ExportButton from "../components/ExportButton";
import { useWorkOrder } from "../hooks/useWorkOrder";
import CreateWorkOrderModal from "../components/CreateWorkOrderModal";
import WorkOrderDetailModal from "../components/WorkOrderDetailModal";
import { exportService } from "../services/exportService";
import "../styles/workorder.css";

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

const STATUS_RANK = {
  IN_PROGRESS: 0,
  ASSIGNED: 1,
  UNASSIGNED: 2,
  APPROVED: 3,
  COMPLETED: 4,
  CLOSED: 5,
  CANCELLED: 6,
};

const HEADER_SORT_DEFAULTS = {
  order_id: "asc",
  vendor: "asc",
  job_type: "asc",
  location_type: "asc",
  date: "desc",
  status: "asc",
};

function dateValue(value) {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function vendorLabel(o) {
  return (o.vendor?.name || "").toLowerCase();
}

function jobTypeLabel(o) {
  return (o.service_type?.service || "").toLowerCase();
}

function locationTypeLabel(o) {
  return (o.location_type || "").toLowerCase();
}

function orderIdValue(o) {
  const n = Number(o.work_order_id);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

function effectiveStatus(o) {
  return o.display_status || o.status || "";
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

function sortOrders(list, sortBy) {
  const sorted = [...list];
  switch (sortBy) {
    case "order_id_asc":
      sorted.sort((a, b) => orderIdValue(a) - orderIdValue(b));
      break;
    case "order_id_desc":
      sorted.sort((a, b) => orderIdValue(b) - orderIdValue(a));
      break;
    case "vendor_asc":
      sorted.sort((a, b) => vendorLabel(a).localeCompare(vendorLabel(b)));
      break;
    case "vendor_desc":
      sorted.sort((a, b) => vendorLabel(b).localeCompare(vendorLabel(a)));
      break;
    case "job_type_asc":
      sorted.sort((a, b) => jobTypeLabel(a).localeCompare(jobTypeLabel(b)));
      break;
    case "job_type_desc":
      sorted.sort((a, b) => jobTypeLabel(b).localeCompare(jobTypeLabel(a)));
      break;
    case "location_type_asc":
      sorted.sort((a, b) =>
        locationTypeLabel(a).localeCompare(locationTypeLabel(b)),
      );
      break;
    case "location_type_desc":
      sorted.sort((a, b) =>
        locationTypeLabel(b).localeCompare(locationTypeLabel(a)),
      );
      break;
    case "date_asc":
      sorted.sort((a, b) => dateValue(a.created_at) - dateValue(b.created_at));
      break;
    case "date_desc":
      sorted.sort((a, b) => dateValue(b.created_at) - dateValue(a.created_at));
      break;
    case "status_asc":
      sorted.sort(
        (a, b) =>
          (STATUS_RANK[effectiveStatus(a)] ?? 99) -
          (STATUS_RANK[effectiveStatus(b)] ?? 99),
      );
      break;
    case "status_desc":
      sorted.sort(
        (a, b) =>
          (STATUS_RANK[effectiveStatus(b)] ?? 99) -
          (STATUS_RANK[effectiveStatus(a)] ?? 99),
      );
      break;
    default:
      break;
  }
  return sorted;
}

export default function WorkOrders() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("date_desc");
  const [showModal, setShowModal] = useState(false);
  const [detailOrder, setDetailOrder] = useState(null);
  const {
    workOrders,
    loading,
    fetchWorkOrders,
    // createWorkOrder,
    // updateWorkOrder,
    // removeWorkOrder
  } = useWorkOrder();

  useEffect(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

  const filteredOrders = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const matched = workOrders.filter((order) => {
      const matchesStatus =
        statusFilter === "ALL" ||
        (order.status && order.status === statusFilter);
      // Search by description, location, or work_order_id
      const matchesSearch =
        order.description?.toLowerCase().includes(normalizedSearch) ||
        order.location_type?.toLowerCase().includes(normalizedSearch) ||
        String(order.work_order_id ?? "").toLowerCase().includes(normalizedSearch);
      return matchesStatus && matchesSearch;
    });
    return sortOrders(matched, sortBy);
  }, [workOrders, searchTerm, statusFilter, sortBy]);

  const activeSort = parseSort(sortBy);
  const handleHeaderSort = (column) => setSortBy(nextSortFor(column, sortBy));
  const sortIndicator = (column) => {
    if (activeSort.column !== column) return null;
    return (
      <span className="workorders-sort-arrow" aria-hidden="true">
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
    className: `workorders-th-sortable ${
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
      controls={<ExportButton withDateRange onExport={exportService.workorders} />}
    >
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

      <button
        className="fab-create-workorder"
        onClick={handleOpenModal}
        title="Create Work Order"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="12" fill="#007bff" />
          <rect x="11" y="6" width="2" height="12" rx="1" fill="#fff" />
          <rect x="6" y="11" width="12" height="2" rx="1" fill="#fff" />
        </svg>
        <span className="fab-label">Create Work Order</span>
      </button>

      <section className="workorders-table-wrap">
        {loading ? (
          <div className="workorders-state">Loading work orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="workorders-state">No work orders found</div>
        ) : (
          <table className="workorders-table workorders-table-flat">
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
                  key={order.work_order_id}
                  className="workorders-row-clickable"
                  onClick={() => setDetailOrder(order)}
                  tabIndex={0}
                  role="button"
                  aria-label={`View details for work order ${order.work_order_id}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setDetailOrder(order);
                    }
                  }}
                >
                  <td>{order.work_order_id}</td>
                  <td>{order.vendor.name}</td>
                  <td>{order.service_type.service}</td>
                  <td>{order.location_type}</td>
                  <td>{`${order.latitude}, ${order.longitude}`}</td>
                  <td>{formatDate(order.created_at)}</td>
                  <td>
                    {(() => {
                      const effective = order.display_status || order.status;
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
      </section>

      {showModal && (
        <CreateWorkOrderModal
          setShowModal={setShowModal}
          fetchWorkOrders={fetchWorkOrders}
        />
      )}

      {detailOrder && (
        <WorkOrderDetailModal
          workOrder={detailOrder}
          onClose={() => setDetailOrder(null)}
        />
      )}
    </AppShell>
  );
}
