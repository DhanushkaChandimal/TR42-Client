import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { vendorService } from "../services/vendorService";
import "../styles/vendors.css";

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

export default function Vendors() {
    const navigate = useNavigate();
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [complianceFilter, setComplianceFilter] = useState("ALL");
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
        fetchVendors();
    }, []);

    const fetchVendors = async () => {
        try {
            setLoading(true);
            const data = await vendorService.getAll();
            setVendors(data);
            setError("");
        } catch (err) {
            setError("Failed to load vendors");
        } finally {
            setLoading(false);
        }
    };

    const filteredVendors = useMemo(() => {
        const search = searchTerm.trim().toLowerCase();
        return vendors.filter((v) => {
            const matchesStatus =
                statusFilter === "ALL" || v.status === statusFilter;
            const matchesCompliance =
                complianceFilter === "ALL" ||
                v.compliance_status === complianceFilter;
            const matchesSearch =
                (v.company_name || "").toLowerCase().includes(search) ||
                (v.company_code || "").toLowerCase().includes(search) ||
                (v.primary_contact_name || "").toLowerCase().includes(search) ||
                (v.description || "").toLowerCase().includes(search);
            return matchesStatus && matchesCompliance && matchesSearch;
        });
    }, [vendors, searchTerm, statusFilter, complianceFilter]);

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
            setError("Failed to create vendor");
        } finally {
            setCreating(false);
        }
    };

    return (
        <AppShell
            title="Vendor Marketplace"
            subtitle="Browse and manage vendors"
            loading={loading}
            loadingText="Loading vendors..."
        >
            {error && <div className="vendors-error">{error}</div>}

            <section className="vendors-controls">
                <input
                    type="search"
                    className="vendors-search"
                    placeholder="Search vendors..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <select
                    className="vendors-filter"
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
                    className="vendors-filter"
                    value={complianceFilter}
                    onChange={(e) => setComplianceFilter(e.target.value)}
                >
                    {complianceOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            </section>

            <button
                className="fab-create-vendor"
                onClick={() => setShowCreateForm(!showCreateForm)}
                title="Add Vendor"
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="12" fill="#007bff" />
                    <rect
                        x="11"
                        y="6"
                        width="2"
                        height="12"
                        rx="1"
                        fill="#fff"
                    />
                    <rect
                        x="6"
                        y="11"
                        width="12"
                        height="2"
                        rx="1"
                        fill="#fff"
                    />
                </svg>
                <span className="fab-label">Add Vendor</span>
            </button>

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

            <section className="vendors-table-wrap">
                {!loading && filteredVendors.length === 0 ? (
                    <div className="vendors-state">No vendors found</div>
                ) : (
                    <table className="vendors-table">
                        <thead>
                            <tr>
                                <th>Company</th>
                                <th>Code</th>
                                <th>Contact</th>
                                <th>Email</th>
                                <th>Status</th>
                                <th>Compliance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredVendors.map((vendor) => (
                                <tr
                                    key={vendor.id}
                                    className="vendors-row-clickable"
                                    onClick={() =>
                                        navigate(`/vendors/${vendor.id}`)
                                    }
                                >
                                    <td>
                                        {vendor.company_name || vendor.name}
                                    </td>
                                    <td>{vendor.company_code || "-"}</td>
                                    <td>
                                        {vendor.primary_contact_name || "-"}
                                    </td>
                                    <td>{vendor.company_email || "-"}</td>
                                    <td>
                                        <span
                                            className={`status-badge status-${vendor.status}`}
                                        >
                                            {vendor.status}
                                        </span>
                                    </td>
                                    <td>
                                        <span
                                            className={`status-badge compliance-${vendor.compliance_status}`}
                                        >
                                            {vendor.compliance_status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>
        </AppShell>
    );
}
