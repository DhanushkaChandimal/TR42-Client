import { useCallback, useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import { useAuthContext } from "../context/AuthContext";
import ExportButton from "../components/ExportButton";
import VendorCard from "../components/VendorCard";
import { exportService } from "../services/exportService";
import { vendorService } from "../services/vendorService";
import "../styles/vendors.css";
import "../styles/vendor-marketplace.css";

const PAGE_SIZE = 30;

const statusOptions = [
    { value: "", label: "All Statuses" },
    { value: "ACTIVE", label: "Active" },
    { value: "INACTIVE", label: "Inactive" },
];

const complianceOptions = [
    { value: "", label: "All Compliance" },
    { value: "COMPLETE", label: "Complete" },
    { value: "INCOMPLETE", label: "Incomplete" },
    { value: "EXPIRED", label: "Expired" },
];

const sortOptions = [
    { value: "company_name|asc", label: "Name A-Z" },
    { value: "company_name|desc", label: "Name Z-A" },
    { value: "status|asc", label: "Status" },
    { value: "compliance_status|asc", label: "Compliance" },
    { value: "created_at|desc", label: "Newest" },
];

export default function Vendors() {
    const { hasPermission } = useAuthContext();
    const canWrite = hasPermission("vendors", "write");
    const [vendors, setVendors] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [services, setServices] = useState([]);
    const [favoriteIds, setFavoriteIds] = useState(new Set());
    const [clientId, setClientId] = useState(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [serviceFilter, setServiceFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [complianceFilter, setComplianceFilter] = useState("");
    const [sortValue, setSortValue] = useState("company_name|asc");

    const [showCreateForm, setShowCreateForm] = useState(false);
    const [creating, setCreating] = useState(false);
    const [formData, setFormData] = useState({
        company_name: "",
        company_code: "",
        primary_contact_name: "",
        company_email: "",
        company_phone: "",
        description: "",
    });

    useEffect(() => {
        const id = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
        return () => clearTimeout(id);
    }, [searchTerm]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [serviceList, me] = await Promise.all([
                    vendorService.listServices().catch(() => []),
                    fetch("/api/users/me", {
                        headers: {
                            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
                        },
                    })
                        .then((r) => (r.ok ? r.json() : null))
                        .catch(() => null),
                ]);
                if (cancelled) return;
                setServices(serviceList || []);
                if (me?.company_id) {
                    setClientId(me.company_id);
                    try {
                        const favs = await vendorService.getFavorites(me.company_id);
                        if (!cancelled) setFavoriteIds(new Set(favs.map((v) => v.id)));
                    } catch {
                        // Favourites optional.
                    }
                }
            } catch (err) {
                if (!cancelled) setError(err.message || "Failed to load filters");
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const fetchVendors = useCallback(async () => {
        const [sort_by, order] = sortValue.split("|");
        setLoading(true);
        try {
            const res = await vendorService.search({
                scope: "engaged",
                q: debouncedSearch,
                service_id: serviceFilter,
                status: statusFilter,
                compliance: complianceFilter,
                sort_by,
                order,
                page: 1,
                per_page: PAGE_SIZE,
            });
            setVendors(res.items || []);
            setTotal(res.total || 0);
            setError("");
        } catch (err) {
            setError(err.message || "Failed to load vendors");
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, serviceFilter, statusFilter, complianceFilter, sortValue]);

    useEffect(() => {
        fetchVendors();
    }, [fetchVendors]);

    const handleAddFavorite = async (vendorId) => {
        if (!clientId) return;
        try {
            await vendorService.addFavorite(clientId, vendorId);
            setFavoriteIds((prev) => new Set(prev).add(vendorId));
        } catch (err) {
            setError(err.message || "Failed to add to favorites");
        }
    };

    const handleFormChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleCreateVendor = async (e) => {
        e.preventDefault();
        if (!formData.company_name.trim() || !formData.company_email.trim()) {
            return;
        }
        try {
            setCreating(true);
            await vendorService.create(formData);
            setFormData({
                company_name: "",
                company_code: "",
                primary_contact_name: "",
                company_email: "",
                company_phone: "",
                description: "",
            });
            setShowCreateForm(false);
            fetchVendors();
        } catch (err) {
            setError(err.message || "Failed to create vendor");
        } finally {
            setCreating(false);
        }
    };

    return (
        <AppShell
            title="Vendors"
            subtitle="Vendors connected to your client through favorites, work orders, tickets, or invoices"
            loading={loading && vendors.length === 0}
            loadingText="Loading vendors..."
            controls={<ExportButton onExport={exportService.vendors} />}
        >
            {error && <div className="vendors-error">{error}</div>}

            <section className="vm-controls">
                <input
                    type="search"
                    className="vm-search"
                    placeholder="Search by name, code, contact, description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <select
                    className="vm-filter"
                    value={serviceFilter}
                    onChange={(e) => setServiceFilter(e.target.value)}
                >
                    <option value="">All Services</option>
                    {services.map((s) => (
                        <option key={s.id} value={s.id}>
                            {s.service}
                        </option>
                    ))}
                </select>
                <select
                    className="vm-filter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    {statusOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                <select
                    className="vm-filter"
                    value={complianceFilter}
                    onChange={(e) => setComplianceFilter(e.target.value)}
                >
                    {complianceOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                <select
                    className="vm-filter"
                    value={sortValue}
                    onChange={(e) => setSortValue(e.target.value)}
                >
                    {sortOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            </section>

            <p className="vm-count">
                {total} vendor{total !== 1 ? "s" : ""} connected to your client
            </p>

            {canWrite && (
                <button
                    className="fab-create-vendor"
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    title="Add Vendor"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="12" fill="#007bff" />
                        <rect x="11" y="6" width="2" height="12" rx="1" fill="#fff" />
                        <rect x="6" y="11" width="12" height="2" rx="1" fill="#fff" />
                    </svg>
                    <span className="fab-label">Add Vendor</span>
                </button>
            )}

            {showCreateForm && (
                <section className="vendors-create-form">
                    <h3>Add New Vendor</h3>
                    <form onSubmit={handleCreateVendor}>
                        <div className="vendors-form-grid">
                            <div className="vendors-form-field">
                                <label>Company Name *</label>
                                <input
                                    type="text"
                                    name="company_name"
                                    value={formData.company_name}
                                    onChange={handleFormChange}
                                    required
                                />
                            </div>
                            <div className="vendors-form-field">
                                <label>Company Code</label>
                                <input
                                    type="text"
                                    name="company_code"
                                    value={formData.company_code}
                                    onChange={handleFormChange}
                                />
                            </div>
                            <div className="vendors-form-field">
                                <label>Contact Name</label>
                                <input
                                    type="text"
                                    name="primary_contact_name"
                                    value={formData.primary_contact_name}
                                    onChange={handleFormChange}
                                />
                            </div>
                            <div className="vendors-form-field">
                                <label>Email *</label>
                                <input
                                    type="email"
                                    name="company_email"
                                    value={formData.company_email}
                                    onChange={handleFormChange}
                                    required
                                />
                            </div>
                            <div className="vendors-form-field">
                                <label>Phone</label>
                                <input
                                    type="text"
                                    name="company_phone"
                                    value={formData.company_phone}
                                    onChange={handleFormChange}
                                />
                            </div>
                            <div className="vendors-form-field vendors-form-field-full">
                                <label>Description</label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleFormChange}
                                    rows={3}
                                />
                            </div>
                        </div>
                        <div className="vendors-form-actions">
                            <button
                                type="button"
                                className="vendors-btn-cancel"
                                onClick={() => setShowCreateForm(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="vendors-btn-submit"
                                disabled={creating}
                            >
                                {creating ? "Creating..." : "Create Vendor"}
                            </button>
                        </div>
                    </form>
                </section>
            )}

            <section className="vm-grid">
                {!loading && vendors.length === 0 ? (
                    <div className="vm-empty">
                        Your client isn't linked to any vendors yet. Visit the
                        Marketplace to add favorites or assign vendors to a
                        work order.
                    </div>
                ) : (
                    vendors.map((vendor) => (
                        <VendorCard
                            key={vendor.id}
                            vendor={vendor}
                            isFavorite={favoriteIds.has(vendor.id)}
                            canFavorite={!!clientId}
                            onAddFavorite={handleAddFavorite}
                        />
                    ))
                )}
            </section>
        </AppShell>
    );
}
