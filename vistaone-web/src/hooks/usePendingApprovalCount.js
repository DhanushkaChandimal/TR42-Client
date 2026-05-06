import { useEffect, useState } from "react";
import { ticketService } from "../services/ticketService";
import { useAuthContext } from "../context/AuthContext";

/**
 * Returns the number of tickets in PENDING_APPROVAL status for the current
 * client, fetched once per AppShell mount. The shared database means the
 * count is whatever the contractor and vendor apps last wrote — no realtime
 * subscription needed, just a fetch.
 */
export function usePendingApprovalCount() {
    const { token } = useAuthContext();
    const [count, setCount] = useState(0);

    useEffect(() => {
        // AppShell only renders for authenticated users, so token is always
        // present here in practice. Skip the fetch defensively if it isn't.
        if (!token) return;
        let cancelled = false;
        ticketService
            .getAll({ status: "PENDING_APPROVAL" })
            .then((rows) => {
                if (!cancelled) {
                    setCount(Array.isArray(rows) ? rows.length : 0);
                }
            })
            .catch(() => {
                if (!cancelled) setCount(0);
            });
        return () => {
            cancelled = true;
        };
    }, [token]);

    return count;
}
