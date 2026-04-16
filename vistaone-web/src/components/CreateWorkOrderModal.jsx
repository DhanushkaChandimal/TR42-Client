import { useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function LocationPicker({ setCoordinates }) {
  useMapEvents({
    click(e) {
      setCoordinates(`${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`);
    },
  });
  return null;
}
import { useWorkOrder } from "../hooks/useWorkOrder";

const recurringOptions = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const vendorOptions = [
  { id: "aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1", label: "Delta Services" },
  {
    id: "bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2",
    label: "Epsilon Drilling",
  },
  { id: "ccccccc3-cccc-cccc-cccc-ccccccccccc3", label: "Zeta Field Solutions" },
];

const jobTypeOptions = [
  { id: "11111111-aaaa-bbbb-cccc-111111111111", label: "Drilling" },
  { id: "22222222-bbbb-cccc-dddd-222222222222", label: "Well Maintenance" },
  { id: "33333333-cccc-dddd-eeee-333333333333", label: "Inspection" },
  { id: "44444444-dddd-eeee-ffff-444444444444", label: "Equipment Rental" },
];

const wellOptions = [
  {
    id: "w1111111-1111-1111-1111-111111111111",
    label: "Well 1 - API 42-001-00001",
    gps: "31.7451, -102.5028",
  },
  {
    id: "w2222222-2222-2222-2222-222222222222",
    label: "Well 2 - API 42-001-00002",
    gps: "31.7500, -102.5100",
  },
  {
    id: "w3333333-3333-3333-3333-333333333333",
    label: "Well 3 - API 42-001-00003",
    gps: "31.7600, -102.5200",
  },
];

const emptyForm = {
  client_id: "",
  vendor: vendorOptions[0].id,
  jobType: jobTypeOptions[0].id,
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
  well: wellOptions[0].id,
};

function CreateWorkOrderModal({ setShowModal, fetchWorkOrders }) {
  const [formData, setFormData] = useState(emptyForm);
  const [markerPos, setMarkerPos] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { createWorkOrder } = useWorkOrder();

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
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
      const selectedWell = wellOptions.find((w) => w.value === value);
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

  // When user clicks map, update gpsCoordinates and marker
  const handleMapClick = (coords) => {
    setFormData((prev) => ({ ...prev, gpsCoordinates: coords }));
    const [lat, lng] = coords.split(",").map(Number);
    setMarkerPos([lat, lng]);
  };

  const handleCreateWorkOrder = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    let locationDisplay = "";
    if (formData.locationMethod === "well") {
      const selectedWell = wellOptions.find((w) => w.id === formData.well);
      locationDisplay = selectedWell ? selectedWell.label : "";
    } else if (formData.locationMethod === "gps") {
      locationDisplay = formData.gpsCoordinates.trim();
    } else {
      locationDisplay = formData.physicalAddress.trim();
    }

    // Parse latitude/longitude from GPS coordinates if present
    let latitude = "";
    let longitude = "";
    if (formData.gpsCoordinates) {
      const [lat, lng] = formData.gpsCoordinates
        .split(",")
        .map((v) => v.trim());
      latitude = lat || "";
      longitude = lng || "";
    }

    const newWorkOrder = {
      client_id: formData.client_id || "11111111-1111-1111-1111-111111111111",
      vendor_id: formData.vendor,
      service_type_id: formData.jobType,
      description: formData.description.trim(),
      location_type:
        formData.locationMethod === "gps"
          ? "GPS"
          : formData.locationMethod === "address"
            ? "ADDRESS"
            : "WELL",
      latitude,
      longitude,
      units: formData.units,
      estimated_quantity: formData.quantity ? formData.quantity : 0,
      priority: formData.priority?.toUpperCase() || "MEDIUM",
      is_recurring: !!formData.recurring,
      recurrence_type: formData.recurring
        ? formData.recurringInterval?.toUpperCase() || "ONE_TIME"
        : "ONE_TIME",
      estimated_start_date: formData.date,
      estimated_end_date: formData.endDate ? formData.endDate : formData.date,
      address_id: formData.address_id || null,
    };

    if (!locationDisplay || !formData.jobType) {
      setError("Please fill all required fields.");
      setLoading(false);
      return;
    }
    try {
      await createWorkOrder(newWorkOrder);
      await fetchWorkOrders();
      setLoading(false);
      handleCloseModal();
    } catch (err) {
      setError("Failed to create work order. " + (err?.message || ""));
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormData(emptyForm);
  };

  return (
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
            >
              {vendorOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
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
              >
                {jobTypeOptions.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
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
                  onChange={handleFormChange}
                  style={{ marginLeft: 8 }}
                >
                  {wellOptions.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label}
                    </option>
                  ))}
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
                <MapContainer
                  center={(() => {
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
                  zoom={13}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="&copy; OpenStreetMap contributors"
                  />
                  {(() => {
                    const selectedWell = wellOptions.find(
                      (w) => w.id === formData.well,
                    );
                    if (selectedWell && selectedWell.gps) {
                      const [lat, lng] = selectedWell.gps
                        .split(",")
                        .map(Number);
                      return <Marker position={[lat, lng]} />;
                    }
                    return null;
                  })()}
                </MapContainer>
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
              <div
                style={{
                  height: 220,
                  width: "100%",
                  borderRadius: 8,
                  overflow: "hidden",
                  marginBottom: 8,
                }}
              >
                <MapContainer
                  center={markerPos || [31.7451, -102.5028]}
                  zoom={13}
                  style={{ height: "100%", width: "100%" }}
                  whenCreated={(map) => {
                    if (markerPos) map.setView(markerPos, 13);
                  }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="&copy; OpenStreetMap contributors"
                  />
                  <LocationPicker setCoordinates={handleMapClick} />
                  {markerPos && <Marker position={markerPos} />}
                </MapContainer>
              </div>
              <small>Click on the map to set coordinates.</small>
            </div>
          )}
          {formData.locationMethod === "address" && (
            <div
              className="workorder-address-fields"
              style={{ marginBottom: 16 }}
            >
              <input
                type="text"
                name="street"
                placeholder="Street Address"
                value={formData.street || ""}
                onChange={handleFormChange}
                required
                style={{ marginBottom: 8 }}
              />
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  name="city"
                  placeholder="City"
                  value={formData.city || ""}
                  onChange={handleFormChange}
                  required
                  style={{ flex: 2 }}
                />
                <input
                  type="text"
                  name="state"
                  placeholder="State"
                  value={formData.state || ""}
                  onChange={handleFormChange}
                  required
                  style={{ flex: 1 }}
                />
                <input
                  type="text"
                  name="zip"
                  placeholder="ZIP"
                  value={formData.zip || ""}
                  onChange={handleFormChange}
                  required
                  style={{ flex: 1 }}
                />
              </div>
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
    </div>
  );
}

export default CreateWorkOrderModal;
