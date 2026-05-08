import { useCallback, useEffect, useState } from "react";
import { ticketService } from "../services/ticketService";
import { useAuthContext } from "../context/AuthContext";

// Event the badge listens for so approving or rejecting a ticket updates the
// sidebar without a page reload. Mirrors the unread-messages pattern.
export const PENDING_APPROVAL_CHANGED = "pendingApprovalChanged";

export function notifyPendingApprovalChanged() {
    window.dispatchEvent(new Event(PENDING_APPROVAL_CHANGED));
}

/**
 * Returns the number of tickets in PENDING_APPROVAL status for the current
 * client. Refreshes on mount, when the auth token changes, and whenever a
 * `PENDING_APPROVAL_CHANGED` event fires (e.g. after an approve/reject).
 */
export function usePendingApprovalCount() {
    const { token } = useAuthContext();
    const [count, setCount] = useState(0);

    const refresh = useCallback(async () => {
        if (!token) return;
        try {
            const rows = await ticketService.getAll({ status: "PENDING_APPROVAL" });
            setCount(Array.isArray(rows) ? rows.length : 0);
        } catch {
            setCount(0);
        }
    }, [token]);

    useEffect(() => {
        if (!token) return;
        refresh();
        window.addEventListener(PENDING_APPROVAL_CHANGED, refresh);
        return () => {
            window.removeEventListener(PENDING_APPROVAL_CHANGED, refresh);
        };
    }, [token, refresh]);

    return count;
}
