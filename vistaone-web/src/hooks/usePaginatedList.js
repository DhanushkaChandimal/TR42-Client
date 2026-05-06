import { useCallback, useEffect, useState } from "react";

/**
 * Drives a server-paginated list. Caller supplies a `fetcher(page, perPage)`
 * that resolves to `{ data, total, pages }`. The fetcher should be memoized
 * via useCallback with the filter deps it cares about so changing filters
 * triggers a refetch and resets to page 1.
 */
export function usePaginatedList(fetcher, { initialPerPage = 10 } = {}) {
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(0);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(initialPerPage);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Reset to page 1 whenever filters (and therefore the fetcher identity) change.
    useEffect(() => {
        setPage(1);
    }, [fetcher]);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetcher(page, perPage);
            setItems(Array.isArray(res?.data) ? res.data : []);
            setTotal(res?.total ?? 0);
            setPages(res?.pages ?? 0);
        } catch (err) {
            setError(err?.message || "Failed to load");
            setItems([]);
            setTotal(0);
            setPages(0);
        } finally {
            setLoading(false);
        }
    }, [fetcher, page, perPage]);

    useEffect(() => {
        load();
    }, [load]);

    return {
        items,
        total,
        pages,
        page,
        perPage,
        loading,
        error,
        setPage,
        setPerPage,
        refresh: load,
    };
}
