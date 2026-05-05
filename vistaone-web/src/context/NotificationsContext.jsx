import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRealtimeNotifications } from "../hooks/useRealtimeNotifications";

const NotificationsContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications() {
    return useContext(NotificationsContext);
}

export function NotificationsProvider({ children }) {
    const { items, unreadCount, markAllRead, markRead } = useRealtimeNotifications();
    const [toast, setToast] = useState(null);
    const seenRef = useRef(new Set());

    // Whenever a brand-new notification arrives, surface it as a toast once.
    useEffect(() => {
        for (const n of items) {
            if (!seenRef.current.has(n.id)) {
                seenRef.current.add(n.id);
                // Legitimate respond-to-async-data: set toast state when a
                // realtime row arrives. Items only grow on a Supabase event,
                // so this can't cascade.
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setToast(n);
                break;
            }
        }
    }, [items]);

    return (
        <NotificationsContext.Provider
            value={{ items, unreadCount, markAllRead, markRead, toast, dismissToast: () => setToast(null) }}
        >
            {children}
        </NotificationsContext.Provider>
    );
}
