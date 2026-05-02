import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { messagingService } from "../services/messagingService";

export default function WorkOrderRecipients({ workOrderId }) {
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const r = await messagingService.listRecipients(workOrderId);
        if (!cancelled) setRecipients(r);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load recipients");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workOrderId]);

  const goToChat = (userId) => {
    navigate(`/messages?wo=${workOrderId}&user=${userId}`);
  };

  if (loading) return <div className="wo-recipients-state">Loading…</div>;
  if (error) return <div className="wo-recipients-state wo-recipients-error">{error}</div>;
  if (!recipients.length) {
    return (
      <div className="wo-recipients-state">
        No vendor or contractor users linked to this work order yet.
      </div>
    );
  }

  const vendors = recipients.filter((r) => r.role?.startsWith("vendor"));
  const contractors = recipients.filter((r) => r.role === "contractor");
  const others = recipients.filter(
    (r) => !r.role?.startsWith("vendor") && r.role !== "contractor"
  );

  return (
    <div className="wo-recipients">
      {vendors.length > 0 && (
        <RecipientGroup label="Vendor" items={vendors} onPick={goToChat} />
      )}
      {contractors.length > 0 && (
        <RecipientGroup label="Contractors" items={contractors} onPick={goToChat} />
      )}
      {others.length > 0 && (
        <RecipientGroup label="Other" items={others} onPick={goToChat} />
      )}
    </div>
  );
}

function RecipientGroup({ label, items, onPick }) {
  return (
    <div className="wo-recipients-group">
      <h4 className="wo-recipients-group-label">{label}</h4>
      <ul className="wo-recipients-list">
        {items.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              className="wo-recipients-link"
              onClick={() => onPick(r.id)}
            >
              <span className="wo-recipients-name">{r.name}</span>
              <span className="wo-recipients-role">{r.role}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
