import { useEffect, useState, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "../services/supabase";
import { useAuthContext } from "../context/AuthContext";

const READ_KEY_PREFIX = "notifications.readIds.";

function loadReadIds(userId) {
    if (!userId) return new Set();
    try {
        const raw = localStorage.getItem(READ_KEY_PREFIX + userId);
        return new Set(raw ? JSON.parse(raw) : []);
    } catch {
        return new Set();
    }
}

function saveReadIds(userId, ids) {
    if (!userId) return;
    try {
        localStorage.setItem(READ_KEY_PREFIX + userId, JSON.stringify([...ids]));
    } catch {
        /* ignore quota errors */
    }
}

/**
 * Subscribes to notification rows where recipient = current user.
 * Returns { items, unreadCount, markAllRead, markRead }.
 *
 * Subscription only — never writes to the notification table. The "read"
 * concept lives in localStorage so we can do it without a DB write.
 */
export function useRealtimeNotifications() {
    const { user, token } = useAuthContext();
    const userId = user?.id;
    const [items, setItems] = useState([]);
    const [readIds, setReadIds] = useState(() => loadReadIds(userId));

    useEffect(() => {
        // Reload localStorage-backed read state when the logged-in user changes
        // (e.g. logout then login in the same tab).
        setReadIds(loadReadIds(userId));
    }, [userId]);

    useEffect(() => {
        if (!isSupabaseConfigured || !userId || !token) return;

        const channel = supabase
            .channel(`notifications:${userId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "notification",
                    filter: `recipient=eq.${userId}`,
                },
                (payload) => {
                    setItems((prev) => {
                        if (prev.some((n) => n.id === payload.new.id)) return prev;
                        return [payload.new, ...prev].slice(0, 50);
                    });
                },
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, token]);

    const markAllRead = useCallback(() => {
        setReadIds((prev) => {
            const next = new Set(prev);
            items.forEach((n) => next.add(n.id));
            saveReadIds(userId, next);
            return next;
        });
    }, [items, userId]);

    const markRead = useCallback(
        (id) => {
            setReadIds((prev) => {
                const next = new Set(prev);
                next.add(id);
                saveReadIds(userId, next);
                return next;
            });
        },
        [userId],
    );

    const unreadCount = items.filter((n) => !readIds.has(n.id)).length;

    return { items, unreadCount, markAllRead, markRead };
}
