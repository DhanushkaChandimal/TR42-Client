import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AppShell from "../components/AppShell";
import { useAuthContext } from "../context/AuthContext";
import ExportButton from "../components/ExportButton";
import VendorCard from "../components/VendorCard";
import { exportService } from "../services/exportService";
import { vendorService } from "../services/vendorService";
import { qk } from "../lib/queryKeys";
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

async function fetchMe() {
    const res = await fetch("/api/users/me", {
        headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    if (!res.ok) return null;
    return res.json();
}

export default function Vendors() {
    const { hasPermission } = useAuthContext();
    const canWrite = hasPermission("vendors", "write");
    const queryClient = useQueryClient();

    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [serviceFilter, setServiceFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [complianceFilter, setComplianceFilter] = useState("");
    const [sortValue, setSortValue] = useState("company_name|asc");

    const [showCreateForm, setShowCreateForm] = useState(false);
    const [error, setError] = useState("");
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

    const meQuery = useQuery({ queryKey: qk.users.me, queryFn: fetchMe });
    const clientId = meQuery.data?.company_id || null;

    const servicesQuery = useQuery({
        queryKey: qk.vendors.services(),
        queryFn: () => vendorService.listServices(),
        staleTime: 10 * 60 * 1000,
    });
    const services = servicesQuery.data || [];

    const favoritesQuery = useQuery({
        queryKey: qk.vendors.favorites(clientId),
        queryFn: () => vendorService.getFavorites(clientId),
        enabled: !!clientId,
    });
    const favoriteIds = new Set((favoritesQuery.data || []).map((v) => v.id));

    const [sort_by, order] = sortValue.split("|");
    const listParams = {
        scope: "engaged",
        q: debouncedSearch,
        service_id: serviceFilter,
        status: statusFilter,
        compliance: complianceFilter,
        sort_by,
        order,
        page: 1,
        per_page: PAGE_SIZE,
    };
    const vendorsQuery = useQuery({
        queryKey: qk.vendors.list(listParams),
        queryFn: () => vendorService.search(listParams),
        placeholderData: (prev) => prev,
    });
    const vendors = vendorsQuery.data?.items || [];
    const total = vendorsQuery.data?.total || 0;
    const loading = vendorsQuery.isLoading;

    const addFavorite = useMutation({
        mutationFn: (vendorId) =>
            vendorService.addFavorite(clientId, vendorId),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: qk.vendors.favorites(clientId),
            });
            queryClient.invalidateQueries({ queryKey: qk.vendors.all });
        },
        onError: (err) =>
            setError(err.message || "Failed to add to favorites"),
    });

    const createVendor = useMutation({
        mutationFn: (payload) => vendorService.create(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: qk.vendors.all });
            setShowCreateForm(false);
            setFormData({
                company_name: "",
                company_code: "",
                primary_contact_name: "",
                company_email: "",
                company_phone: "",
                description: "",
            });
        },
        onError: (err) => setError(err.message || "Failed to create vendor"),
    });

    const handleFormChange = (e) =>
        setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleCreateVendor = (e) => {
        e.preventDefault();
        if (!formData.company_name.trim() || !formData.company_email.trim()) return;
        setError("");
        createVendor.mutate(formData);
    };

    const fetchError =
        vendorsQuery.error?.message ||
        servicesQuery.error?.message ||
        meQuery.error?.message ||
        "";

    return (
        <AppShell
            title="Vendors"
            subtitle="Vendors connected to your client through favorites, work orders, tickets, or invoices"
            loading={loading && vendors.length === 0}
            loadingText="Loading vendors..."
            controls={<ExportButton onExport={exportService.vendors} />}
        >
            {(error || fetchError) && (
                <div className="vendors-error">{error || fetchError}</div>
            )}

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
                                disabled={createVendor.isPending}
                            >
                                {createVendor.isPending ? "Creating..." : "Create Vendor"}
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
                            onAddFavorite={(id) => addFavorite.mutate(id)}
                        />
                    ))
                )}
            </section>
        </AppShell>
    );
}
