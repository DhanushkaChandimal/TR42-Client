import { useState, useMemo } from "react";
import stateData from "../assets/state_codes.json";
import MapPicker from "./MapPicker";

export default function CreateOrEditWellModal({
  setShowModal,
  onSubmit,
  initialData,
  mode = "create",
}) {
  const [form, setForm] = useState(() =>
    initialData
      ? {
          well_number: initialData.well_number || "",
          well_name: initialData.well_name || "",
          latitude: initialData.latitude ? String(initialData.latitude) : "",
          longitude: initialData.longitude ? String(initialData.longitude) : "",
          status: initialData.status || "ACTIVE",
          client_id: initialData.client_id || "",
        }
      : {
          well_number: "",
          well_name: "",
          latitude: "",
          longitude: "",
          status: "ACTIVE",
          client_id: "",
        },
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // For map marker position
  const markerPos = useMemo(() => {
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
    return null;
  }, [form.latitude, form.longitude]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  function validateApiWellNumber(wellNumber) {
    // Format: XX-XXX-XXXXX-XX-XX (10-14 digits, dashes required)
    const apiPattern = /^(\d{2})-(\d{3})-(\d{5})(?:-(\d{2}))?(?:-(\d{2}))?$/;
    const match = wellNumber.match(apiPattern);
    if (!match) {
      return "API Well Number must be in format XX-XXX-XXXXX-XX-XX (dashes required).";
    }
    const stateCode = match[1];
    const countyCode = match[2];
    const state = stateData.states.find((s) => s.state_code === stateCode);
    if (!state) {
      return `Invalid state code: ${stateCode}.`;
    }
    const county = state.counties.find((c) => c.county_code === countyCode);
    if (!county) {
      return `Invalid county code: ${countyCode} for state ${state.state_name}.`;
    }
    return "";
  }

  // Show state/county name as user types API number
  const apiNumberInfo = useMemo(() => {
    const apiPattern = /^(\d{2})-(\d{3})/;
    const match = form.well_number.match(apiPattern);
    if (!match) return { state: "", county: "" };
    const stateCode = match[1];
    const countyCode = match[2];
    const state = stateData.states.find((s) => s.state_code === stateCode);
    const stateName = state ? state.state_name : "";
    const county =
      state && state.counties.find((c) => c.county_code === countyCode);
    const countyName = county ? county.county_name : "";
    return { state: stateName, county: countyName };
  }, [form.well_number, stateData]);

  const validateForm = () => {
    if (!form.well_number.trim()) {
      return "Well number is required.";
    }
    const apiError = validateApiWellNumber(form.well_number.trim());
    if (apiError) {
      return apiError;
    }
    if (!form.latitude.trim() || isNaN(Number(form.latitude))) {
      return "Latitude must be a valid number.";
    }
    if (!form.longitude.trim() || isNaN(Number(form.longitude))) {
      return "Longitude must be a valid number.";
    }
    if (!form.well_name.trim()) {
      return "Please enter a well name.";
    }
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    try {
      const formWithClient = {
        ...form,
        client_id: "11111111-1111-1111-1111-111111111111",
      };
      await onSubmit(formWithClient);
    } catch (err) {
      console.error(err);
      setError(`Failed to ${mode === "edit" ? "update" : "create"} well.`);
    }
    setLoading(false);
  };

  return (
    <div
      className="workorders-modal-overlay"
      onClick={() => setShowModal(false)}
    >
      <div
        className="workorders-modal workorder-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="workorders-modal-header workorder-modal-header">
          <h2 className="workorder-modal-title">
            {mode === "edit" ? "Edit Well" : "Create Well"}
          </h2>
          <button
            className="workorders-close-btn workorder-close-btn"
            onClick={() => setShowModal(false)}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <form
          className="workorders-form workorder-form"
          onSubmit={handleSubmit}
          autoComplete="off"
        >
          {error && (
            <div style={{ color: "red", marginBottom: 8 }}>{error}</div>
          )}
          {loading && (
            <div style={{ color: "#007bff", marginBottom: 8 }}>
              Creating well...
            </div>
          )}
          <label>
            Well Number
            <input
              name="well_number"
              value={form.well_number}
              onChange={handleChange}
              required
              placeholder="XX-XXX-XXXXX-XX-XX"
            />
            {form.well_number &&
              (apiNumberInfo.state || apiNumberInfo.county) && (
                <div
                  style={{ fontSize: "0.9em", color: "#007bff", marginTop: 2 }}
                >
                  {apiNumberInfo.state && (
                    <span>State: {apiNumberInfo.state}</span>
                  )}
                  {apiNumberInfo.county && (
                    <span> &nbsp;|&nbsp; County: {apiNumberInfo.county}</span>
                  )}
                </div>
              )}
          </label>
          <label>
            Name
            <input
              name="well_name"
              value={form.well_name}
              onChange={handleChange}
            />
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <label style={{ flex: 1 }}>
              Latitude
              <input
                name="latitude"
                value={form.latitude}
                onChange={handleChange}
                placeholder="e.g., 31.7451"
              />
            </label>
            <label style={{ flex: 1 }}>
              Longitude
              <input
                name="longitude"
                value={form.longitude}
                onChange={handleChange}
                placeholder="e.g., -102.5028"
              />
            </label>
          </div>
          <div style={{ margin: "12px 0 16px 0" }}>
            <MapPicker
              markerPos={markerPos}
              setMarkerPos={(pos) => {
                if (pos && Array.isArray(pos) && pos.length === 2) {
                  setForm((prev) => ({
                    ...prev,
                    latitude: pos[0].toFixed(6),
                    longitude: pos[1].toFixed(6),
                  }));
                }
              }}
              height={220}
            />
            <small>
              Enter latitude/longitude or pick a location on the map.
            </small>
          </div>
          <label>
            Status
            <select name="status" value={form.status} onChange={handleChange}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
          <button type="submit" className="workorder-submit-btn">
            <span>{mode === "edit" ? "Update Well" : "Create Well"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
