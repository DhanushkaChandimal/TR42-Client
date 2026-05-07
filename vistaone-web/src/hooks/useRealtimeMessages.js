import { useEffect } from "react";
import { supabase, isSupabaseConfigured } from "../services/supabase";

/**
 * Subscribes to new messages addressed to the current user via Supabase
 * Realtime Broadcast. A DB trigger calls realtime.send() on every INSERT
 * into the message table, routing to channel "messages:<recipient_id>".
 *
 * Falls back silently when Supabase is not configured (local dev without env vars).
 */
export function useRealtimeMessages({ userId, onMessage }) {
    useEffect(() => {
        if (!isSupabaseConfigured || !userId) return;

        const channel = supabase
            .channel(`messages:${userId}`)
            .on("broadcast", { event: "new_message" }, (payload) => {
                onMessage(payload.payload);
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [userId, onMessage]);
}
