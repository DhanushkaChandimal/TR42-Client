import { useNavigate } from "react-router-dom";

// Stable colour picker so the same service shows the same pill colour on every
// card. Pastel backgrounds with darker text for legibility.
const SERVICE_PALETTE = [
  { bg: "#dbeafe", fg: "#1e3a8a" },
  { bg: "#dcfce7", fg: "#14532d" },
  { bg: "#fef3c7", fg: "#78350f" },
  { bg: "#fce7f3", fg: "#831843" },
  { bg: "#ede9fe", fg: "#4c1d95" },
  { bg: "#cffafe", fg: "#155e75" },
  { bg: "#ffe4e6", fg: "#881337" },
  { bg: "#e0f2fe", fg: "#0c4a6e" },
];

function colorForService(name) {
  const s = String(name || "");
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return SERVICE_PALETTE[hash % SERVICE_PALETTE.length];
}

function formatServiceLabel(name) {
  return String(name || "")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export default function VendorCard({
  vendor,
  isFavorite = false,
  canFavorite = false,
  onAddFavorite,
}) {
  const navigate = useNavigate();
  return (
    <div className="vm-card">
      <div className="vm-card-header">
        <div>
          <h3
            className="vm-card-name"
            onClick={() => navigate(`/vendors/${vendor.id}`)}
          >
            {vendor.company_name || vendor.name}
          </h3>
          <p className="vm-card-code">{vendor.company_code || ""}</p>
        </div>
        <div className="vm-card-badges">
          <span className={`vm-badge vm-badge-${vendor.status}`}>
            {vendor.status}
          </span>
          <span className={`vm-badge vm-badge-${vendor.compliance_status}`}>
            {vendor.compliance_status}
          </span>
        </div>
      </div>

      <p className="vm-card-desc">
        {vendor.description || "No description available"}
      </p>

      {vendor.services?.length > 0 && (
        <div className="vm-card-services">
          {vendor.services.slice(0, 4).map((s) => {
            const c = colorForService(s.service);
            return (
              <span
                key={s.id}
                className="vm-service-pill"
                style={{ background: c.bg, color: c.fg }}
              >
                {formatServiceLabel(s.service)}
              </span>
            );
          })}
          {vendor.services.length > 4 && (
            <span className="vm-service-pill vm-service-pill-more">
              +{vendor.services.length - 4}
            </span>
          )}
        </div>
      )}

      <div className="vm-card-contact">
        <p>{vendor.primary_contact_name || "-"}</p>
        <p>{vendor.company_email || "-"}</p>
        <p>{vendor.company_phone || "-"}</p>
      </div>

      <div className="vm-card-footer">
        <button
          className="vm-card-view"
          onClick={() => navigate(`/vendors/${vendor.id}`)}
        >
          View Details
        </button>
        {canFavorite && !isFavorite && (
          <button
            className="vm-card-fav"
            onClick={() => onAddFavorite?.(vendor.id)}
          >
            + Add to Favorites
          </button>
        )}
        {canFavorite && isFavorite && (
          <span className="vm-card-fav-added">In Favorites</span>
        )}
      </div>
    </div>
  );
}
