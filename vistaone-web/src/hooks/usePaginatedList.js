import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

/**
 * Drives a server-paginated list, backed by React Query so the same filter
 * combination shows cached pages instantly on revisit.
 *
 *   usePaginatedList({
 *     queryKey: ["tickets", "list", { q, status }],
 *     queryFn: (page, perPage) =>
 *       ticketService.search({ q, status, page, per_page: perPage }),
 *   });
 *
 * The query key automatically appends `{ page, perPage }`, so callers only
 * include the filter portion. When the filter portion changes the hook
 * resets to page 1.
 */
export function usePaginatedList({
    queryKey,
    queryFn,
    initialPerPage = 10,
    enabled = true,
}) {
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(initialPerPage);

    const serializedKey = useMemo(() => JSON.stringify(queryKey), [queryKey]);
    const prevKeyRef = useRef(serializedKey);
    useEffect(() => {
        if (prevKeyRef.current !== serializedKey) {
            setPage(1);
            prevKeyRef.current = serializedKey;
        }
    }, [serializedKey]);

    const fullKey = useMemo(
        () => [...(queryKey || []), { page, perPage }],
        [queryKey, page, perPage]
    );

    const query = useQuery({
        queryKey: fullKey,
        queryFn: () => queryFn(page, perPage),
        enabled: enabled && !!queryFn,
        placeholderData: (prev) => prev,
    });

    const data = query.data;
    return {
        items: Array.isArray(data?.data) ? data.data : [],
        total: data?.total ?? 0,
        pages: data?.pages ?? 0,
        page,
        perPage,
        loading: query.isLoading || query.isFetching,
        error: query.error?.message || "",
        setPage,
        setPerPage,
        refresh: query.refetch,
    };
}
