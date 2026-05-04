import { useState } from "react";
import "../styles/exportButton.css";

export default function ExportButton({
  label = "Export to Excel",
  onExport,
  withDateRange = false,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const handle = async () => {
    setBusy(true);
    setError("");
    try {
      if (withDateRange) {
        await onExport({ from, to });
      } else {
        await onExport();
      }
    } catch (err) {
      setError(err.message || "Export failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="export-btn-wrap">
      {withDateRange && (
        <>
          <label className="export-date-label">
            From
            <input
              type="date"
              className="export-date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              disabled={busy}
              max={to || undefined}
            />
          </label>
          <label className="export-date-label">
            To
            <input
              type="date"
              className="export-date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={busy}
              min={from || undefined}
            />
          </label>
        </>
      )}
      <button
        type="button"
        className="export-btn"
        onClick={handle}
        disabled={busy}
        title="Download an .xlsx file"
      >
        {busy ? "Building..." : label}
      </button>
      {error && <span className="export-btn-error">{error}</span>}
    </div>
  );
}
