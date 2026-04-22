import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { vendorService } from "../services/vendorService";
import "../styles/vendor-marketplace.css";

export default function VendorFavorites() {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clientId, setClientId] = useState(null);

  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/users/me", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });
      if (res.ok) {
        const user = await res.json();
        if (user.company_id) {
          setClientId(user.company_id);
          const favs = await vendorService.getFavorites(user.company_id);
          setFavorites(favs);
        }
      }
      setError("");
    } catch (err) {
      setError("Failed to load favorites");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavorite = async (vendorId) => {
    if (!clientId) return;
    try {
      await vendorService.removeFavorite(clientId, vendorId);
      setFavorites((prev) => prev.filter((v) => v.vendor_id !== vendorId));
    } catch (err) {
      setError("Failed to remove from favorites");
    }
  };

  return (
    <AppShell
      title="Vendor Favorites"
      subtitle="Your saved vendors"
      loading={loading}
      loadingText="Loading favorites..."
    >
      {error && <div className="vm-error">{error}</div>}

      <div className="vm-fav-actions">
        <button
          className="vm-fav-browse"
          onClick={() => navigate("/vendor-marketplace")}
        >
          Browse Marketplace
        </button>
      </div>

      {!loading && favorites.length === 0 ? (
        <div className="vm-empty">
          <p>No vendors in your favorites yet</p>
          <button
            className="vm-fav-browse"
            onClick={() => navigate("/vendor-marketplace")}
          >
            Browse Vendor Marketplace
          </button>
        </div>
      ) : (
        <section className="vm-grid">
          {favorites.map((vendor) => (
            <div key={vendor.vendor_id} className="vm-card">
              <div className="vm-card-header">
                <div>
                  <h3
                    className="vm-card-name"
                    onClick={() => navigate(`/vendors/${vendor.vendor_id}`)}
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

              <div className="vm-card-contact">
                <p>{vendor.primary_contact_name || "-"}</p>
                <p>{vendor.company_email || "-"}</p>
                <p>{vendor.company_phone || "-"}</p>
              </div>

              <div className="vm-card-footer">
                <button
                  className="vm-card-view"
                  onClick={() => navigate(`/vendors/${vendor.vendor_id}`)}
                >
                  View History
                </button>
                <button
                  className="vm-card-remove"
                  onClick={() => handleRemoveFavorite(vendor.vendor_id)}
                >
                  Remove from Favorites
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
    </AppShell>
  );
}
