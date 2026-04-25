import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import CreateWorkOrderModal from "../components/CreateWorkOrderModal";
import { vendorService } from "../services/vendorService";
import "../styles/vendor-marketplace.css";

export default function VendorFavorites() {
    const navigate = useNavigate();
    const [favorites, setFavorites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [clientId, setClientId] = useState(null);
    const [createWOForVendor, setCreateWOForVendor] = useState(null);

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
                    const favs = await vendorService.getFavorites(
                        user.company_id,
                    );
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
            setFavorites((prev) => prev.filter((v) => v.id !== vendorId));
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
                        <div key={vendor.id} className="vm-card">
                            <div className="vm-card-header">
                                <div>
                                    <h3
                                        className="vm-card-name"
                                        onClick={() =>
                                            navigate(`/vendors/${vendor.id}`)
                                        }
                                    >
                                        {vendor.company_name || vendor.name}
                                    </h3>
                                    <p className="vm-card-code">
                                        {vendor.company_code || ""}
                                    </p>
                                </div>
                                <div className="vm-card-badges">
                                    <span
                                        className={`vm-badge vm-badge-${vendor.status}`}
                                    >
                                        {vendor.status}
                                    </span>
                                    <span
                                        className={`vm-badge vm-badge-${vendor.compliance_status}`}
                                    >
                                        {vendor.compliance_status}
                                    </span>
                                </div>
                            </div>

                            <p className="vm-card-desc">
                                {vendor.description ||
                                    "No description available"}
                            </p>

                            <div className="vm-card-contact">
                                <p>{vendor.primary_contact_name || "-"}</p>
                                <p>{vendor.company_email || "-"}</p>
                                <p>{vendor.company_phone || "-"}</p>
                            </div>

                            <div className="vm-card-footer">
                                <button
                                    className="vm-card-view"
                                    onClick={() =>
                                        navigate(`/vendors/${vendor.id}`)
                                    }
                                >
                                    View History
                                </button>
                                {vendor.status === "active" &&
                                    vendor.compliance_status === "complete" && (
                                        <button
                                            className="vm-card-create-wo"
                                            onClick={() =>
                                                setCreateWOForVendor(vendor.id)
                                            }
                                        >
                                            + Work Order
                                        </button>
                                    )}
                                <button
                                    className="vm-card-remove"
                                    onClick={() =>
                                        handleRemoveFavorite(vendor.id)
                                    }
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    ))}
                </section>
            )}

            {createWOForVendor && (
                <CreateWorkOrderModal
                    setShowModal={() => setCreateWOForVendor(null)}
                    prefilledVendorId={createWOForVendor}
                />
            )}
        </AppShell>
    );
}
