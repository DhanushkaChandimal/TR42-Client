import { useEffect } from "react";
import { supabase, isSupabaseConfigured } from "../services/supabase";

/**
 * Subscribes to new messages addressed to the current user via Supabase
 * Realtime postgres_changes. Fires automatically on every INSERT into the
 * message table where recipient_id matches — no DB trigger or server-side
 * broadcast call required.
 *
 * Falls back silently when Supabase is not configured (local dev without env vars).
 */
export function useRealtimeMessages({ userId, onMessage }) {
    useEffect(() => {
        if (!isSupabaseConfigured || !userId) return;

        const channel = supabase
            .channel(`messages-inbox:${userId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "message",
                    filter: `recipient_id=eq.${userId}`,
                },
                (payload) => {
                    onMessage(payload.new);
                },
            )
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [userId, onMessage]);
}
