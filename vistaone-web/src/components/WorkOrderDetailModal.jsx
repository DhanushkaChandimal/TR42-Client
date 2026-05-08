import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ticketService } from "../services/ticketService";
import { invoiceService } from "../services/invoiceService";
import { workOrderService } from "../services/workOrderService";
import { vendorService } from "../services/vendorService";
import WorkOrderRecipients from "./WorkOrderRecipients";
import AddressFields, { validateZip } from "./AddressFields";
import "../styles/workOrderRecipients.css";

const formatDate = (s) =>
  s
    ? new Date(s).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const formatStatusLabel = (status) => {
  if (!status) return "";
  if (status === "INVOICE_REJECTED") return "Invoice Rejected";
  if (status === "PENDING_REVIEW") return "Pending Review";
  return status.replace(/_/g, " ");
};

const toDateInputValue = (s) => {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

export default function WorkOrderDetailModal({ workOrder, onClose, onSaved }) {
  const [current, setCurrent] = useState(workOrder);
  const [tickets, setTickets] = useState(null);
  const [invoices, setInvoices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [zipError, setZipError] = useState("");
  const [vendors, setVendors] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const buildDraft = (wo) => ({
    description: wo.description || "",
    priority: wo.priority || "MEDIUM",
    estimated_start_date: toDateInputValue(wo.estimated_start_date),
    estimated_end_date: toDateInputValue(wo.estimated_end_date),
    assigned_vendor: wo.assigned_vendor || "",
    location_type: wo.location_type || "GPS",
    latitude: wo.latitude != null ? String(wo.latitude) : "",
    longitude: wo.longitude != null ? String(wo.longitude) : "",
    street: wo.address?.street || "",
    city: wo.address?.city || "",
    state: wo.address?.state || "",
    zip: wo.address?.zip || "",
    country: wo.address?.country || "US",
  });
  const [draft, setDraft] = useState(() => buildDraft(workOrder));

  const isEditable = current.current_status === "UNASSIGNED";

  useEffect(() => {
    if (!editMode || vendors.length) return;
    let cancelled = false;
    vendorService
      .getAll()
      .then((data) => {
        if (!cancelled) setVendors(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [editMode, vendors.length]);

  const startEdit = () => {
    setDraft(buildDraft(current));
    setSaveError("");
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setSaveError("");
    setZipError("");
  };

  const saveEdit = async () => {
    setSaving(true);
    setSaveError("");
    const toIso = (d) => (d ? `${d}T00:00:00` : null);

    // Mirror create-modal rules: location fields are mutually exclusive per location_type.
    let locationFields;
    if (draft.location_type === "GPS") {
      if (!draft.latitude || !draft.longitude) {
        setSaveError("GPS coordinates required.");
        setSaving(false);
        return;
      }
      locationFields = {
        latitude: draft.latitude,
        longitude: draft.longitude,
        location: null,
        well_id: null,
      };
    } else if (draft.location_type === "ADDRESS") {
      if (!draft.street.trim() || !draft.city.trim() || !draft.zip.trim()) {
        setSaveError("Street, city, and ZIP are required.");
        setSaving(false);
        return;
      }
      const country = draft.country || "US";
      const zipErr = validateZip(draft.zip.trim(), country);
      if (zipErr) {
        setZipError(zipErr);
        setSaveError("Please fix the ZIP code.");
        setSaving(false);
        return;
      }
      locationFields = {
        street: draft.street.trim(),
        city: draft.city.trim(),
        state: draft.state.trim(),
        zip: draft.zip.trim(),
        country,
        latitude: null,
        longitude: null,
        well_id: null,
      };
    } else {
      // WELL — keep existing well_id; modal doesn't expose well picker yet
      if (!current.well_id) {
        setSaveError("This work order has no well linked. Pick GPS or Address instead.");
        setSaving(false);
        return;
      }
      locationFields = {
        well_id: current.well_id,
        latitude: null,
        longitude: null,
        location: null,
      };
    }

    const payload = {
      description: draft.description.trim(),
      priority: draft.priority,
      estimated_start_date: toIso(draft.estimated_start_date),
      estimated_end_date: toIso(draft.estimated_end_date || draft.estimated_start_date),
      assigned_vendor: draft.assigned_vendor || null,
      location_type: draft.location_type,
      ...locationFields,
    };

    try {
      const updated = await workOrderService.update(current.id, payload);
      setCurrent(updated);
      setEditMode(false);
      if (onSaved) onSaved();
    } catch (err) {
      setSaveError(err?.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this work order? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await workOrderService.remove(current.id);
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      setSaveError(err?.message || "Failed to delete work order");
      setDeleting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [t, i] = await Promise.all([
          ticketService.getAll({ work_order_id: current.id }),
          invoiceService.getAll({ work_order_id: current.id }),
        ]);
        if (cancelled) return;
        setTickets(t);
        setInvoices(i);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load related records");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [current.id]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="workorders-modal-overlay" onClick={onClose}>
      <div
        className="workorders-modal workorder-detail-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="workorders-modal-header workorder-modal-header">
          <h2 className="workorder-modal-title">
            Work Order #{current.work_order_code}
          </h2>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            {isEditable && !editMode && (
              <>
                <button
                  className="workorders-action-btn"
                  onClick={startEdit}
                  aria-label="Edit work order"
                >
                  Edit
                </button>
                <button
                  className="workorders-action-btn workorders-action-btn-secondary"
                  onClick={handleDelete}
                  disabled={deleting}
                  aria-label="Delete work order"
                  style={{ color: "#b00020", borderColor: "#f5c6cb" }}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </>
            )}
            <button
              className="workorders-close-btn workorder-close-btn"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="workorder-detail-body">
          <section className="workorder-detail-section">
            <h3>Information</h3>
            {editMode ? (
              <div style={{ display: "grid", gap: "0.75rem" }}>
                <label>
                  Description
                  <textarea
                    rows="3"
                    value={draft.description}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, description: e.target.value }))
                    }
                    style={{ width: "100%" }}
                  />
                </label>
                <label>
                  Priority
                  <select
                    value={draft.priority}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, priority: e.target.value }))
                    }
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </label>
                <label>
                  Vendor
                  <select
                    value={draft.assigned_vendor}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, assigned_vendor: e.target.value }))
                    }
                  >
                    <option value="">— Unassigned —</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.company_name || v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Location Type
                  <select
                    value={draft.location_type}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, location_type: e.target.value }))
                    }
                  >
                    <option value="GPS">GPS</option>
                    <option value="ADDRESS">Address</option>
                    <option value="WELL">Well</option>
                  </select>
                </label>
                {draft.location_type === "GPS" && (
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <label style={{ flex: 1 }}>
                      Latitude
                      <input
                        type="text"
                        value={draft.latitude}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, latitude: e.target.value }))
                        }
                        placeholder="31.7451"
                      />
                    </label>
                    <label style={{ flex: 1 }}>
                      Longitude
                      <input
                        type="text"
                        value={draft.longitude}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, longitude: e.target.value }))
                        }
                        placeholder="-102.5028"
                      />
                    </label>
                  </div>
                )}
                {draft.location_type === "ADDRESS" && (
                  <AddressFields
                    values={{
                      street: draft.street,
                      city: draft.city,
                      state: draft.state,
                      zip: draft.zip,
                      country: draft.country,
                    }}
                    onChange={(e) => {
                      if (e.target.name === "country") setZipError("");
                      setDraft((d) => ({ ...d, [e.target.name]: e.target.value }));
                    }}
                    zipError={zipError}
                    onZipBlur={() =>
                      setZipError(validateZip(draft.zip, draft.country || "US"))
                    }
                  />
                )}
                {draft.location_type === "WELL" && (
                  <div style={{ fontSize: "0.85rem", color: "#666" }}>
                    Well location is locked to the originally selected well.
                  </div>
                )}
                <label>
                  Start Date
                  <input
                    type="date"
                    value={draft.estimated_start_date}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        estimated_start_date: e.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  End Date
                  <input
                    type="date"
                    value={draft.estimated_end_date}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        estimated_end_date: e.target.value,
                      }))
                    }
                  />
                </label>
                {saveError && (
                  <div style={{ color: "red" }}>{saveError}</div>
                )}
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    className="workorders-action-btn"
                    onClick={saveEdit}
                    disabled={saving}
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    className="workorders-action-btn workorders-action-btn-secondary"
                    onClick={cancelEdit}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <dl className="workorder-detail-grid">
                <dt>Vendor</dt><dd>{current.vendor?.company_name || current.vendor?.name || "—"}</dd>
                <dt>Job Type</dt><dd>{current.service?.service || "—"}</dd>
                <dt>Description</dt><dd>{current.description || "—"}</dd>
                <dt>Location Type</dt><dd>{current.location_type || "—"}</dd>
                <dt>Location</dt>
                <dd>
                  {current.location_type === "ADDRESS"
                    ? current.address
                      ? [current.address.street, current.address.city, current.address.state, current.address.zip].filter(Boolean).join(", ")
                      : current.location || "—"
                    : current.latitude != null && current.longitude != null
                    ? `${current.latitude}, ${current.longitude}`
                    : "—"}
                </dd>
                <dt>Priority</dt><dd>{current.priority || "—"}</dd>
                <dt>Start</dt><dd>{formatDate(current.estimated_start_date)}</dd>
                <dt>End</dt><dd>{formatDate(current.estimated_end_date)}</dd>
                <dt>Status</dt>
                <dd>
                  {(() => {
                    const effective = current.display_status || current.current_status;
                    return (
                      <span className={`status-badge status-${effective?.toLowerCase()}`}>
                        {formatStatusLabel(effective)}
                      </span>
                    );
                  })()}
                </dd>
                <dt>Created</dt><dd>{formatDate(current.created_at)}</dd>
              </dl>
            )}
          </section>

          <section className="workorder-detail-section">
            <h3>Tickets {tickets ? `(${tickets.length})` : ""}</h3>
            {loading ? (
              <div className="workorders-tickets-state">Loading…</div>
            ) : error ? (
              <div className="workorders-tickets-state workorders-tickets-error">{error}</div>
            ) : !tickets || tickets.length === 0 ? (
              <div className="workorders-tickets-state">No tickets.</div>
            ) : (
              <table className="workorders-tickets-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Description</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id}>
                      <td>{t.id.slice(0, 8)}</td>
                      <td>{t.description}</td>
                      <td>{t.priority}</td>
                      <td>{t.status}</td>
                      <td>{formatDate(t.due_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="workorder-detail-section">
            <h3>Invoices {invoices ? `(${invoices.length})` : ""}</h3>
            {loading ? (
              <div className="workorders-tickets-state">Loading…</div>
            ) : error ? (
              <div className="workorders-tickets-state workorders-tickets-error">{error}</div>
            ) : !invoices || invoices.length === 0 ? (
              <div className="workorders-tickets-state">No invoices.</div>
            ) : (
              <table className="workorders-tickets-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Invoice Date</th>
                    <th>Due</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>{inv.id.slice(0, 8)}</td>
                      <td>{formatDate(inv.invoice_date)}</td>
                      <td>{formatDate(inv.due_date)}</td>
                      <td>{inv.total_amount != null ? `$${Number(inv.total_amount).toFixed(2)}` : "—"}</td>
                      <td>{inv.invoice_status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="workorder-detail-section">
            <h3>Message a recipient</h3>
            <WorkOrderRecipients workOrderId={current.id} />
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}
