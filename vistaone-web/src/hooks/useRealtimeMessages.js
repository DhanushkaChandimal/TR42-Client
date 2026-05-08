import { useEffect } from "react";
import { supabase, isSupabaseConfigured } from "../services/supabase";

/**
 * Subscribes to new messages via Supabase Realtime postgres_changes.
 *
 * We deliberately do NOT use a server-side `recipient_id=eq.<id>` filter:
 * if the JWT subject id and the row recipient_id ever drift (different
 * casing, hyphenation, or auth provider), the server silently drops the
 * event. Instead we subscribe to every INSERT on the message table and
 * gate it client-side, which is robust at the cost of a few extra payloads
 * per second.
 *
 * Falls back silently when Supabase is not configured (local dev without
 * env vars).
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
                },
                (payload) => {
                    const row = payload?.new;
                    if (!row) return;
                    if (row.recipient_id === userId || row.sender_id === userId) {
                        onMessage(row);
                    }
                },
            )
            .subscribe((status, err) => {
                if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                    // eslint-disable-next-line no-console
                    console.warn(
                        "[messages-realtime] subscription status",
                        status,
                        err,
                    );
                }
            });

        return () => supabase.removeChannel(channel);
    }, [userId, onMessage]);
}
