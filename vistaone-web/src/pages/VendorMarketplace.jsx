import { useEffect, useRef, useState } from "react";
import {
    useInfiniteQuery,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import AppShell from "../components/AppShell";
import VendorCard from "../components/VendorCard";
import { vendorService } from "../services/vendorService";
import { qk } from "../lib/queryKeys";
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

export default function VendorMarketplace() {
    const queryClient = useQueryClient();

    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [serviceFilter, setServiceFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [complianceFilter, setComplianceFilter] = useState("");
    const [sortValue, setSortValue] = useState("company_name|asc");
    const [error, setError] = useState("");

    const sentinelRef = useRef(null);

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
    const filterParams = {
        q: debouncedSearch,
        service_id: serviceFilter,
        status: statusFilter,
        compliance: complianceFilter,
        sort_by,
        order,
    };

    const list = useInfiniteQuery({
        queryKey: qk.vendors.list(filterParams),
        initialPageParam: 1,
        queryFn: ({ pageParam }) =>
            vendorService.search({
                ...filterParams,
                page: pageParam,
                per_page: PAGE_SIZE,
            }),
        getNextPageParam: (lastPage, _pages, lastPageParam) =>
            lastPage?.has_more ? lastPageParam + 1 : undefined,
    });

    const vendors = (list.data?.pages || []).flatMap((p) => p.items || []);
    const total = list.data?.pages?.[0]?.total || 0;

    // Infinite scroll: fetch the next page when the sentinel enters the viewport.
    useEffect(() => {
        const node = sentinelRef.current;
        if (!node) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (
                    entries[0].isIntersecting &&
                    list.hasNextPage &&
                    !list.isFetchingNextPage
                ) {
                    list.fetchNextPage();
                }
            },
            { rootMargin: "200px 0px" }
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, [list]);

    const addFavorite = useMutation({
        mutationFn: (vendorId) =>
            vendorService.addFavorite(clientId, vendorId),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: qk.vendors.favorites(clientId),
            });
        },
        onError: (err) => setError(err.message || "Failed to add favorite"),
    });

    const fetchError =
        list.error?.message ||
        servicesQuery.error?.message ||
        meQuery.error?.message ||
        "";

    return (
        <AppShell
            title="Vendor Marketplace"
            subtitle="Browse, search, and add vendors to your favorites"
            loading={list.isLoading}
            loadingText="Loading vendors..."
        >
            {(error || fetchError) && (
                <div className="vm-error">{error || fetchError}</div>
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
                Showing {vendors.length} of {total} vendor
                {total !== 1 ? "s" : ""}
            </p>

            <section className="vm-grid">
                {!list.isLoading && vendors.length === 0 ? (
                    <div className="vm-empty">No vendors match your search</div>
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

            <div ref={sentinelRef} className="vm-sentinel" aria-hidden="true" />
            {list.isFetchingNextPage && (
                <div className="vm-loading-more">Loading more vendors…</div>
            )}
            {!list.hasNextPage && vendors.length > 0 && (
                <div className="vm-end">You've reached the end.</div>
            )}
        </AppShell>
    );
}
