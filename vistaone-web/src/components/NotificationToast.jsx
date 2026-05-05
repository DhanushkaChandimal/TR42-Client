import { useEffect } from "react";
import { FiBell, FiX } from "react-icons/fi";
import { useNotifications } from "../context/NotificationsContext";

const AUTO_DISMISS_MS = 6000;

export default function NotificationToast() {
    const ctx = useNotifications();
    const toast = ctx?.toast;
    const dismissToast = ctx?.dismissToast;

    useEffect(() => {
        if (!toast || !dismissToast) return;
        const t = setTimeout(dismissToast, AUTO_DISMISS_MS);
        return () => clearTimeout(t);
    }, [toast, dismissToast]);

    if (!toast) return null;

    return (
        <div
            role="status"
            aria-live="polite"
            style={{
                position: "fixed",
                right: 24,
                bottom: 24,
                zIndex: 1080,
                minWidth: 320,
                maxWidth: 400,
                background: "#fff",
                border: "1px solid #d6d8dc",
                borderRadius: 8,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                padding: "12px 14px",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
            }}
        >
            <FiBell size={18} style={{ marginTop: 2, color: "#0d6efd" }} />
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, lineHeight: 1.35 }}>{toast.message}</div>
                <div style={{ fontSize: 11, color: "#6c757d", marginTop: 4 }}>
                    {new Date(toast.created_at).toLocaleString()}
                </div>
            </div>
            <button
                onClick={dismissToast}
                aria-label="Dismiss"
                style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: "#6c757d",
                    padding: 0,
                }}
            >
                <FiX size={18} />
            </button>
        </div>
    );
}
