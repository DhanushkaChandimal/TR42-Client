import { useEffect, useState } from "react";

/**
 * Shared form for rejecting a ticket or invoice. Loads candidate recipients
 * via `loadRecipients` and lets the user pick who gets the automated message
 * with the rejection note.
 */
export default function RejectionForm({
  loadRecipients,
  onSubmit,
  onCancel,
  submitting,
  submitLabel = "Confirm Reject",
}) {
  const [note, setNote] = useState("");
  const [recipients, setRecipients] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    loadRecipients()
      .then((rows) => {
        if (cancelled) return;
        setRecipients(Array.isArray(rows) ? rows : []);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || "Failed to load recipients");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadRecipients]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected =
    recipients.length > 0 && selected.size === recipients.length;
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(recipients.map((r) => r.id)));
  };

  const trimmed = note.trim();
  const canSubmit = !submitting && trimmed.length > 0;

  return (
    <div className="ticket-detail-reject-form">
      <label
        htmlFor="rejection-note"
        className="ticket-detail-reject-label"
      >
        Reason for rejection
      </label>
      <textarea
        id="rejection-note"
        className="ticket-detail-reject-textarea"
        placeholder="Add a short note explaining why this is being rejected."
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        disabled={submitting}
      />

      <div className="ticket-detail-reject-recipients">
        <div className="ticket-detail-reject-recipients-header">
          <span>Notify (sent individually)</span>
          {recipients.length > 0 && (
            <button
              type="button"
              className="ticket-detail-reject-toggle-all"
              onClick={toggleAll}
              disabled={submitting}
            >
              {allSelected ? "Clear all" : "Select all"}
            </button>
          )}
        </div>
        {loading ? (
          <div className="ticket-detail-reject-recipients-state">Loading…</div>
        ) : loadError ? (
          <div className="ticket-detail-reject-recipients-state ticket-detail-reject-error">
            {loadError}
          </div>
        ) : recipients.length === 0 ? (
          <div className="ticket-detail-reject-recipients-state">
            No vendor or contractor users are linked to this record.
          </div>
        ) : (
          <ul className="ticket-detail-reject-recipients-list">
            {recipients.map((r) => (
              <li key={r.id}>
                <label className="ticket-detail-reject-recipient">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                    disabled={submitting}
                  />
                  <span className="ticket-detail-reject-recipient-name">
                    {r.name}
                  </span>
                  <span className="ticket-detail-reject-recipient-role">
                    {r.role}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="ticket-detail-reject-actions">
        <button
          type="button"
          className="ticket-btn-reject"
          onClick={() => onSubmit(trimmed, Array.from(selected))}
          disabled={!canSubmit}
        >
          {submitting ? "Processing…" : submitLabel}
        </button>
        <button
          type="button"
          className="ticket-btn-undo"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
