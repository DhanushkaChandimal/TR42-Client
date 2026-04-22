import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { vendorService } from "../services/vendorService";
import "../styles/vendor-marketplace.css";

const statusOptions = [
  { value: "ALL", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const complianceOptions = [
  { value: "ALL", label: "All Compliance" },
  { value: "complete", label: "Complete" },
  { value: "incomplete", label: "Incomplete" },
  { value: "expired", label: "Expired" },
];

const sortOptions = [
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
  { value: "status", label: "Status" },
  { value: "compliance", label: "Compliance" },
];

export default function VendorMarketplace() {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [complianceFilter, setComplianceFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("name-asc");
  const [clientId, setClientId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const allVendors = await vendorService.getAll();
      setVendors(allVendors);

      // Get current user's company_id to load their client favorites
      try {
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
            setFavoriteIds(new Set(favs.map((v) => v.vendor_id)));
          }
        }
      } catch {
        // Favorites will be disabled if user profile fails
      }
      setError("");
    } catch (err) {
      setError("Failed to load vendors");
    } finally {
      setLoading(false);
    }
  };

  const handleAddFavorite = async (vendorId) => {
    if (!clientId) return;
    try {
      await vendorService.addFavorite(clientId, vendorId);
      setFavoriteIds((prev) => new Set(prev).add(vendorId));
    } catch (err) {
      setError("Failed to add to favorites");
    }
  };

  const processedVendors = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const filtered = vendors.filter((v) => {
      const matchesStatus =
        statusFilter === "ALL" || v.status === statusFilter;
      const matchesCompliance =
        complianceFilter === "ALL" || v.compliance_status === complianceFilter;
      const matchesSearch =
        (v.company_name || "").toLowerCase().includes(search) ||
        (v.company_code || "").toLowerCase().includes(search) ||
        (v.primary_contact_name || "").toLowerCase().includes(search) ||
        (v.description || "").toLowerCase().includes(search) ||
        (v.service_type || "").toLowerCase().includes(search);
      return matchesStatus && matchesCompliance && matchesSearch;
    });

    return filtered.sort((a, b) => {
      if (sortBy === "name-asc")
        return (a.company_name || "").localeCompare(b.company_name || "");
      if (sortBy === "name-desc")
        return (b.company_name || "").localeCompare(a.company_name || "");
      if (sortBy === "status")
        return (a.status || "").localeCompare(b.status || "");
      if (sortBy === "compliance")
        return (a.compliance_status || "").localeCompare(b.compliance_status || "");
      return 0;
    });
  }, [vendors, searchTerm, statusFilter, complianceFilter, sortBy]);

  return (
    <AppShell
      title="Vendor Marketplace"
      subtitle="Browse, search, and add vendors to your favorites"
      loading={loading}
      loadingText="Loading vendors..."
    >
      {error && <div className="vm-error">{error}</div>}

      <section className="vm-controls">
        <input
          type="search"
          className="vm-search"
          placeholder="Search by name, code, service type..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="vm-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          className="vm-filter"
          value={complianceFilter}
          onChange={(e) => setComplianceFilter(e.target.value)}
        >
          {complianceOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          className="vm-filter"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </section>

      <p className="vm-count">
        {processedVendors.length} vendor{processedVendors.length !== 1 ? "s" : ""} found
      </p>

      <section className="vm-grid">
        {!loading && processedVendors.length === 0 ? (
          <div className="vm-empty">No vendors match your search</div>
        ) : (
          processedVendors.map((vendor) => (
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
                  View Details
                </button>
                {clientId && !favoriteIds.has(vendor.vendor_id) && (
                  <button
                    className="vm-card-fav"
                    onClick={() => handleAddFavorite(vendor.vendor_id)}
                  >
                    + Add to Favorites
                  </button>
                )}
                {clientId && favoriteIds.has(vendor.vendor_id) && (
                  <span className="vm-card-fav-added">In Favorites</span>
                )}
              </div>
            </div>
          ))
        )}
      </section>
    </AppShell>
  );
}
