import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { vendorService } from "../services/vendorService";
import "../styles/vendor-marketplace.css";

const PAGE_SIZE = 30;

// Stable color picker so the same service shows the same pill colour on every
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

export default function VendorMarketplace() {
    const navigate = useNavigate();
    const [vendors, setVendors] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingPage, setLoadingPage] = useState(false);
    const [appendingPage, setAppendingPage] = useState(false);

    const [services, setServices] = useState([]);
    const [favoriteIds, setFavoriteIds] = useState(new Set());
    const [clientId, setClientId] = useState(null);
    const [error, setError] = useState("");

    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [serviceFilter, setServiceFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [complianceFilter, setComplianceFilter] = useState("");
    const [sortValue, setSortValue] = useState("company_name|asc");

    const sentinelRef = useRef(null);
    const requestIdRef = useRef(0);

    // Debounce the search box so we don't fire a request per keystroke.
    useEffect(() => {
        const id = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
        return () => clearTimeout(id);
    }, [searchTerm]);

    // Load static dropdown data + favourites once.
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
                        // Favourites optional; surface nothing.
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

    const fetchPage = useCallback(
        async (pageNum, mode) => {
            const [sort_by, order] = sortValue.split("|");
            const myRequest = ++requestIdRef.current;
            if (mode === "replace") setLoadingPage(true);
            else setAppendingPage(true);
            try {
                const res = await vendorService.search({
                    q: debouncedSearch,
                    service_id: serviceFilter,
                    status: statusFilter,
                    compliance: complianceFilter,
                    sort_by,
                    order,
                    page: pageNum,
                    per_page: PAGE_SIZE,
                });
                // Drop stale responses if the user kept typing/filtering.
                if (myRequest !== requestIdRef.current) return;
                setTotal(res.total || 0);
                setHasMore(!!res.has_more);
                setPage(pageNum);
                setVendors((prev) =>
                    mode === "append" ? [...prev, ...(res.items || [])] : res.items || []
                );
                setError("");
            } catch (err) {
                if (myRequest !== requestIdRef.current) return;
                setError(err.message || "Failed to load vendors");
            } finally {
                if (myRequest === requestIdRef.current) {
                    setLoadingPage(false);
                    setAppendingPage(false);
                }
            }
        },
        [debouncedSearch, serviceFilter, statusFilter, complianceFilter, sortValue]
    );

    // Reset to page 1 whenever filters change.
    useEffect(() => {
        fetchPage(1, "replace");
    }, [fetchPage]);

    // Infinite scroll: fetch the next page when the sentinel enters the viewport.
    useEffect(() => {
        const node = sentinelRef.current;
        if (!node) return;
        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (
                    entry.isIntersecting &&
                    hasMore &&
                    !loadingPage &&
                    !appendingPage
                ) {
                    fetchPage(page + 1, "append");
                }
            },
            { rootMargin: "200px 0px" }
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, [hasMore, loadingPage, appendingPage, page, fetchPage]);

    const handleAddFavorite = async (vendorId) => {
        if (!clientId) return;
        try {
            await vendorService.addFavorite(clientId, vendorId);
            setFavoriteIds((prev) => new Set(prev).add(vendorId));
        } catch (err) {
            setError(err.message || "Failed to add to favorites");
        }
    };

    return (
        <AppShell
            title="Vendor Marketplace"
            subtitle="Browse, search, and add vendors to your favorites"
            loading={loadingPage && vendors.length === 0}
            loadingText="Loading vendors..."
        >
            {error && <div className="vm-error">{error}</div>}

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
                Showing {vendors.length} of {total} vendor
                {total !== 1 ? "s" : ""}
            </p>

            <section className="vm-grid">
                {!loadingPage && vendors.length === 0 ? (
                    <div className="vm-empty">No vendors match your search</div>
                ) : (
                    vendors.map((vendor) => (
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

                            {vendor.services?.length > 0 && (
                                <div className="vm-card-services">
                                    {vendor.services.slice(0, 4).map((s) => {
                                        const c = colorForService(s.service);
                                        return (
                                            <span
                                                key={s.id}
                                                className="vm-service-pill"
                                                style={{
                                                    background: c.bg,
                                                    color: c.fg,
                                                }}
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
                                    onClick={() =>
                                        navigate(`/vendors/${vendor.id}`)
                                    }
                                >
                                    View Details
                                </button>
                                {clientId && !favoriteIds.has(vendor.id) && (
                                    <button
                                        className="vm-card-fav"
                                        onClick={() =>
                                            handleAddFavorite(vendor.id)
                                        }
                                    >
                                        + Add to Favorites
                                    </button>
                                )}
                                {clientId && favoriteIds.has(vendor.id) && (
                                    <span className="vm-card-fav-added">
                                        In Favorites
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </section>

            <div ref={sentinelRef} className="vm-sentinel" aria-hidden="true" />
            {appendingPage && (
                <div className="vm-loading-more">Loading more vendors…</div>
            )}
            {!hasMore && vendors.length > 0 && (
                <div className="vm-end">You've reached the end.</div>
            )}
        </AppShell>
    );
}
