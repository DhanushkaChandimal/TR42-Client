import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// When the env vars are absent (e.g. local dev not pointed at Supabase), we
// expose a no-op client so calling code does not have to defensively check.
const stubClient = {
  channel: () => ({
    on: () => stubClient.channel(),
    subscribe: () => ({ unsubscribe: () => {} }),
  }),
  realtime: { setAuth: () => {} },
  removeChannel: () => {},
};

export const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : stubClient;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Tell Realtime to use our Flask-issued JWT for RLS evaluation. Call this
// after login and whenever the token rotates.
export function setRealtimeAuth(token) {
  if (!isSupabaseConfigured) return;
  supabase.realtime.setAuth(token);
}
