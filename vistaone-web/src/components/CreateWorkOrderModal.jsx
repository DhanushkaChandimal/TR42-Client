import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import MapPicker from "./MapPicker";
import { useWorkOrder } from "../hooks/useWorkOrder";
import { vendorService } from "../services/vendorService";
import { useWell } from "../hooks/useWell";
import AddressFields, { validateZip } from "./AddressFields";

const recurringOptions = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const emptyForm = {
  client_id: "",
  vendor: "",
  jobType: "",
  description: "",
  locationMethod: "gps",
  gpsCoordinates: "",
  latitude: "",
  longitude: "",
  units: "",
  quantity: 0,
  priority: "MEDIUM",
  recurring: false,
  recurringInterval: "weekly",
  date: "",
  endDate: "",
  address_id: "",
  well: "",
  street: "",
  city: "",
  state: "",
  zip: "",
  country: "US",
};

function CreateWorkOrderModal({ setShowModal, fetchWorkOrders, prefilledVendorId }) {
  const [formData, setFormData] = useState({
    ...emptyForm,
    vendor: prefilledVendorId || "",
  });
  const { wells, fetchWells } = useWell();
  const [markerPos, setMarkerPos] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [zipError, setZipError] = useState("");
  const { createWorkOrder } = useWorkOrder();
  const [vendors, setVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    vendorService
      .getAll()
      .then((data) => {
        if (!cancelled) setVendors(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setVendors([]);
      })
      .finally(() => {
        if (!cancelled) setVendorsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Build vendor and service option lists with cross-filter logic.
  // Selecting a vendor narrows job type list to that vendor's services.
  // Selecting a job type narrows vendor list to vendors offering that service.
  const allServices = useMemo(() => {
    const map = new Map();
    vendors.forEach((v) =>
      (v.services || []).forEach((s) => {
        if (s?.id && !map.has(s.id)) map.set(s.id, s);
      }),
    );
    return Array.from(map.values()).sort((a, b) =>
      (a.service || "").localeCompare(b.service || ""),
    );
  }, [vendors]);

  const vendorOptions = useMemo(() => {
    if (!formData.jobType) return vendors;
    return vendors.filter((v) =>
      (v.services || []).some((s) => s.id === formData.jobType),
    );
  }, [vendors, formData.jobType]);

  const jobTypeOptions = useMemo(() => {
    if (!formData.vendor) return allServices;
    const v = vendors.find((x) => x.id === formData.vendor);
    return v ? v.services || [] : [];
  }, [vendors, allServices, formData.vendor]);

  useEffect(() => {
    fetchWells();
  }, [fetchWells]);

  const wellOptions = useMemo(
    () =>
      wells.map((w) => ({
        id: w.id,
        label: w.well_name ? `${w.well_name} - ${w.api_number}` : w.api_number,
        gps:
          w.location?.surface_latitude && w.location?.surface_longitude
            ? `${w.location.surface_latitude}, ${w.location.surface_longitude}`
            : "",
      })),
    [wells],
  );

  useEffect(() => {
    // Default to the first well once async data arrives. This is a legitimate
    // setState in an effect: we cannot derive it from props/state alone and
    // we only want it to run once after wells load.
    if (wells.length && !formData.well) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData((prev) => ({ ...prev, well: wells[0].id }));
    }
  }, [wells, formData.well]);

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    // If picking a vendor that doesn't offer the currently selected job type,
    // clear job type so the user re-picks. Same in reverse.
    if (name === "vendor" && value && formData.jobType) {
      const v = vendors.find((x) => x.id === value);
      const offers = (v?.services || []).some((s) => s.id === formData.jobType);
      if (!offers) {
        setFormData((prev) => ({ ...prev, vendor: value, jobType: "" }));
        return;
      }
    }
    if (name === "jobType" && value && formData.vendor) {
      const v = vendors.find((x) => x.id === formData.vendor);
      const offers = (v?.services || []).some((s) => s.id === value);
      if (!offers) {
        setFormData((prev) => ({ ...prev, jobType: value, vendor: "" }));
        return;
      }
    }
    // If changing locationMethod to 'well', fill GPS from well and set map
    if (name === "locationMethod" && value === "well") {
      const selectedWell = wellOptions.find((w) => w.id === formData.well);
      if (selectedWell && selectedWell.gps) {
        setFormData((prev) => ({
          ...prev,
          locationMethod: value,
          gpsCoordinates: selectedWell.gps,
          physicalAddress: "",
        }));
        const [lat, lng] = selectedWell.gps.split(",").map(Number);
        if (!isNaN(lat) && !isNaN(lng)) setMarkerPos([lat, lng]);
        return;
      }
    }
    // If changing well and locationMethod is 'well', update GPS from new well
    if (name === "well" && formData.locationMethod === "well") {
      const selectedWell = wellOptions.find((w) => w.id === value);
      if (selectedWell && selectedWell.gps) {
        setFormData((prev) => ({
          ...prev,
          well: value,
          gpsCoordinates: selectedWell.gps,
          physicalAddress: "",
        }));
        const [lat, lng] = selectedWell.gps.split(",").map(Number);
        if (!isNaN(lat) && !isNaN(lng)) setMarkerPos([lat, lng]);
        return;
      }
    }
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (name === "gpsCoordinates") {
      const [lat, lng] = value.split(",").map(Number);
      if (!isNaN(lat) && !isNaN(lng)) setMarkerPos([lat, lng]);
    }
  };

  const handleCreateWorkOrder = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!formData.vendor || !formData.jobType) {
      setError("Please pick a vendor and job type.");
      setLoading(false);
      return;
    }

    const locationType =
      formData.locationMethod === "gps"
        ? "GPS"
        : formData.locationMethod === "address"
          ? "ADDRESS"
          : "WELL";

    // Build location fields mutually exclusive per the backend schema:
    // GPS -> latitude/longitude only; ADDRESS -> location only; WELL -> well_id only.
    let locationFields;
    if (locationType === "GPS") {
      const [lat, lng] = (formData.gpsCoordinates || "")
        .split(",")
        .map((v) => v.trim());
      if (!lat || !lng) {
        setError("Please set GPS coordinates.");
        setLoading(false);
        return;
      }
      locationFields = { latitude: lat, longitude: lng };
    } else if (locationType === "ADDRESS") {
      const street = (formData.street || "").trim();
      const city = (formData.city || "").trim();
      const state = (formData.state || "").trim();
      const zip = (formData.zip || "").trim();
      const country = formData.country || "US";
      if (!street || !city || !state || !zip) {
        setError("Please complete the address fields.");
        setLoading(false);
        return;
      }
      const zipErr = validateZip(zip, country);
      if (zipErr) {
        setZipError(zipErr);
        setError("Please fix the ZIP code.");
        setLoading(false);
        return;
      }
      locationFields = { street, city, state, zip, country };
    } else {
      if (!formData.well) {
        setError("Please pick a well.");
        setLoading(false);
        return;
      }
      locationFields = { well_id: formData.well };
    }

    // Marshmallow DateTime expects full ISO 8601, not bare YYYY-MM-DD.
    const toIso = (d) => (d ? `${d}T00:00:00` : null);

    const newWorkOrder = {
      assigned_vendor: formData.vendor,
      service_type: formData.jobType,
      description: formData.description.trim(),
      location_type: locationType,
      units: formData.units || null,
      estimated_quantity: formData.quantity ? Number(formData.quantity) : 0,
      priority: formData.priority?.toUpperCase() || "MEDIUM",
      is_recurring: !!formData.recurring,
      recurrence_type: formData.recurring
        ? formData.recurringInterval?.toUpperCase() || "ONE_TIME"
        : "ONE_TIME",
      estimated_start_date: toIso(formData.date),
      estimated_end_date: toIso(formData.endDate || formData.date),
      ...locationFields,
    };

    try {
      await createWorkOrder(newWorkOrder);
      if (fetchWorkOrders) await fetchWorkOrders();
      setLoading(false);
      handleCloseModal();
    } catch (err) {
      setError(err?.message || "Failed to create work order.");
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormData(emptyForm);
    setZipError("");
  };

  return createPortal(
    <div className="workorders-modal-overlay" onClick={handleCloseModal}>
      <div
        className="workorders-modal workorder-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="workorders-modal-header workorder-modal-header">
          <div className="workorder-modal-icon">
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="14" y="6" width="4" height="20" rx="2" fill="#007bff" />
              <rect x="6" y="14" width="20" height="4" rx="2" fill="#007bff" />
            </svg>
          </div>
          <h2 className="workorder-modal-title">Create Work Order</h2>
          <button
            className="workorders-close-btn workorder-close-btn"
            onClick={handleCloseModal}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <form
          className="workorders-form workorder-form"
          onSubmit={handleCreateWorkOrder}
          autoComplete="off"
        >
          {error && (
            <div style={{ color: "red", marginBottom: 8 }}>{error}</div>
          )}
          {loading && (
            <div style={{ color: "#007bff", marginBottom: 8 }}>
              Creating work order...
            </div>
          )}
          <label>
            Vendor
            <select
              name="vendor"
              value={formData.vendor}
              onChange={handleFormChange}
              required
              disabled={vendorsLoading}
            >
              <option value="">
                {vendorsLoading ? "Loading vendors..." : "Select a vendor"}
              </option>
              {vendorOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.company_name || v.name}
                </option>
              ))}
            </select>
          </label>
          <div className="workorders-form-row">
            <label>
              Job Type
              <select
                name="jobType"
                value={formData.jobType}
                onChange={handleFormChange}
                required
                disabled={vendorsLoading || jobTypeOptions.length === 0}
              >
                <option value="">
                  {jobTypeOptions.length === 0 && formData.vendor
                    ? "No services for this vendor"
                    : "Select a job type"}
                </option>
                {jobTypeOptions.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.service || type.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quantity
              <input
                type="number"
                name="quantity"
                placeholder="e.g., 120"
                value={formData.quantity}
                onChange={handleFormChange}
                min="0"
                step="any"
                style={{ width: 100, marginRight: 8 }}
              />
            </label>
            <label>
              Units
              <input
                type="text"
                name="units"
                placeholder="e.g., BBL"
                value={formData.units}
                onChange={handleFormChange}
                style={{ width: 80 }}
              />
            </label>
          </div>
          <label>
            Description
            <textarea
              name="description"
              rows="3"
              value={formData.description}
              onChange={handleFormChange}
            />
          </label>

          {/* Job Location method and conditional well dropdown */}
          <div className="workorder-location-method">
            <span className="workorder-location-label">Job Location</span>
            <div className="workorder-location-options">
              <button
                type="button"
                className={
                  formData.locationMethod === "well"
                    ? "workorder-location-btn active"
                    : "workorder-location-btn"
                }
                onClick={() =>
                  handleFormChange({
                    target: {
                      name: "locationMethod",
                      value: "well",
                      type: "radio",
                    },
                  })
                }
              >
                Same as Well Location
              </button>
              <button
                type="button"
                className={
                  formData.locationMethod === "gps"
                    ? "workorder-location-btn active"
                    : "workorder-location-btn"
                }
                onClick={() =>
                  handleFormChange({
                    target: {
                      name: "locationMethod",
                      value: "gps",
                      type: "radio",
                    },
                  })
                }
              >
                GPS Coordinates
              </button>
              <button
                type="button"
                className={
                  formData.locationMethod === "address"
                    ? "workorder-location-btn active"
                    : "workorder-location-btn"
                }
                onClick={() =>
                  handleFormChange({
                    target: {
                      name: "locationMethod",
                      value: "address",
                      type: "radio",
                    },
                  })
                }
              >
                Physical Address
              </button>
            </div>
            {/* Well dropdown only if Same as Well Location is selected */}
            {formData.locationMethod === "well" && (
              <label style={{ marginTop: "1rem", display: "block" }}>
                Well
                <select
                  name="well"
                  value={formData.well}
                  onChange={(e) => {
                    if (e.target.value === "__create_well__") {
                      window.location.href = "/wells";
                    } else {
                      handleFormChange(e);
                    }
                  }}
                  style={{ marginLeft: 8 }}
                >
                  {wellOptions.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label}
                    </option>
                  ))}
                  <option value="__create_well__">+ Create Well...</option>
                </select>
              </label>
            )}
          </div>

          {/* Show map and well dropdown only for Same as Well Location, show map for GPS, hide well dropdown for GPS/Address */}
          {formData.locationMethod === "well" && (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  height: 220,
                  width: "100%",
                  borderRadius: 8,
                  overflow: "hidden",
                  marginBottom: 8,
                }}
              >
                <MapPicker
                  markerPos={(() => {
                    const selectedWell = wellOptions.find(
                      (w) => w.id === formData.well,
                    );
                    if (selectedWell && selectedWell.gps) {
                      const [lat, lng] = selectedWell.gps
                        .split(",")
                        .map(Number);
                      return [lat, lng];
                    }
                    return [31.7451, -102.5028];
                  })()}
                  setMarkerPos={() => {}}
                  height={220}
                />
              </div>
              <small>Location is set from selected well.</small>
            </div>
          )}
          {formData.locationMethod === "gps" && (
            <div style={{ marginBottom: 16 }}>
              <input
                type="text"
                name="gpsCoordinates"
                placeholder="31.7451, -102.5028"
                value={formData.gpsCoordinates}
                onChange={handleFormChange}
                required
                style={{ marginBottom: 8 }}
              />
              <MapPicker
                markerPos={markerPos}
                setMarkerPos={(pos) => {
                  setMarkerPos(pos);
                  if (pos && Array.isArray(pos) && pos.length === 2) {
                    setFormData((prev) => ({
                      ...prev,
                      gpsCoordinates: `${pos[0].toFixed(6)}, ${pos[1].toFixed(6)}`,
                    }));
                  }
                }}
                height={220}
              />
              <small>Click on the map to set coordinates.</small>
            </div>
          )}
          {formData.locationMethod === "address" && (
            <div className="workorder-address-fields" style={{ marginBottom: 16 }}>
              <AddressFields
                values={{
                  street: formData.street,
                  city: formData.city,
                  state: formData.state,
                  zip: formData.zip,
                  country: formData.country,
                }}
                onChange={(e) => {
                  if (e.target.name === "country") setZipError("");
                  handleFormChange(e);
                }}
                zipError={zipError}
                onZipBlur={() =>
                  setZipError(validateZip(formData.zip, formData.country || "US"))
                }
              />
            </div>
          )}
          {/* Date, priority, recurring */}
          <div className="workorders-form-row">
            <label>
              Start Date
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleFormChange}
                required
              />
            </label>
            <label>
              Priority
              <select
                name="priority"
                value={formData.priority}
                onChange={handleFormChange}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>
          <div className="workorder-recurring-row">
            <span>Recurring Work Order</span>
            <label className="workorder-recurring-label">
              <input
                type="checkbox"
                name="recurring"
                checked={formData.recurring}
                onChange={handleFormChange}
                className="workorder-recurring-checkbox"
              />
            </label>
          </div>
          {formData.recurring && (
            <div className="workorders-form-row">
              <label>
                End Date
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleFormChange}
                  required
                />
              </label>
              <label>
                Recurring Interval
                <select
                  name="recurringInterval"
                  value={formData.recurringInterval}
                  onChange={handleFormChange}
                  required
                >
                  <option value="">Select interval</option>
                  {recurringOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <button type="submit" className="workorder-submit-btn">
            <span>Create Work Order</span>
            <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
              <path
                d="M7 15l5-5-5-5"
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export default CreateWorkOrderModal;
