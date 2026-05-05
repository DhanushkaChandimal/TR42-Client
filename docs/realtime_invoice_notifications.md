# Realtime Invoice-Submission Notifications — Deploy Guide

When the vendor app flips an invoice's status to `SUBMITTED`, every active member of that invoice's client gets a real-time toast plus a bell-icon entry. No vendor-side code change required, no polling.

## How it works

```
Vendor app  ─UPDATE invoice.invoice_status='SUBMITTED'─►  Postgres
                                                            │
                              AFTER UPDATE OF invoice_status trigger fires
                                                            │
                              INSERT into notification (one row per active client_user)
                                                            │
                  Supabase Realtime broadcasts the new notification rows
                                                            │
                  Client app subscribed to notification rows where recipient = me
                                                            ▼
                                            Toast + bell badge update instantly
```

## What ships in the codebase (this PR)

- `vistaone-api/app/utils/util.py` — `encode_token` now signs with `JWT_SECRET` and includes `role: 'authenticated'` + `aud: 'authenticated'` claims so Supabase Realtime/RLS recognizes the JWT
- `vistaone-web/src/services/supabase.js` — Supabase JS client + `setRealtimeAuth()`
- `vistaone-web/src/hooks/useRealtimeNotifications.js` — subscription hook (read-only, never writes)
- `vistaone-web/src/context/NotificationsContext.jsx` — provider + toast surface logic
- `vistaone-web/src/components/NotificationToast.jsx` — auto-dismissing toast UI
- `vistaone-web/src/components/TopBar.jsx` — bell icon + dropdown rewired to live data (replaces the previous mock `initialNotifications`)
- `docs/realtime_invoice_notifications.sql` — the four DB blocks to run

## Deploy steps

### 1. Run the SQL (one-time, in Supabase dashboard)

Open Supabase → SQL Editor → paste the contents of `docs/realtime_invoice_notifications.sql` → run. The script is idempotent; safe to re-run.

What it adds:

- `public.notify_invoice_submitted()` function
- `invoice_submitted_notify` trigger on `public.invoice` for status changes
- `public.notification` added to the `supabase_realtime` publication
- RLS enabled on `public.notification` with a `recipient = auth.jwt() ->> 'sub'` SELECT policy

What it does **not** touch: any existing table column, any existing row.

### 2. Set the env vars

**Backend (`vistaone-api/.env`):**
```
JWT_SECRET=<paste from Supabase: Project Settings → API → JWT Secret>
```
If `JWT_SECRET` is unset, the code falls back to `SECRET_KEY`, so local dev not pointed at Supabase keeps working.

**Frontend (`vistaone-web/.env`):**
```
VITE_SUPABASE_URL=<from Supabase: Project Settings → API → Project URL>
VITE_SUPABASE_ANON_KEY=<from Supabase: Project Settings → API → anon public key>
```
If either is missing, the Realtime subscription becomes a no-op stub — the app still runs, the bell just stays empty.

### 3. Deploy backend, then frontend

Order matters: backend must mint JWTs with the new claims before the frontend tries to use them for Realtime. Once both are deployed, all currently-logged-in users have to log out and back in once to get a token signed with the Supabase JWT secret.

### 4. Smoke-test

In Supabase SQL editor, run a single benign-looking update on an invoice you know about:

```sql
-- pick an invoice whose status is already SUBMITTED, just nudge it
UPDATE invoice
   SET invoice_status = 'SUBMITTED', updated_at = now()
 WHERE id = '<some-existing-submitted-invoice>';
```

(Or have the vendor side run a real submission.)

Then check from the client app — a toast should appear within a second or two for any logged-in user belonging to that invoice's client.

## Knobs you can change without code

- **Recipient set** — the trigger currently notifies every `client_user` with `status = 'ACTIVE'` for the invoice's client. To narrow to MASTER/ADMIN only, edit the SELECT inside `notify_invoice_submitted()` to JOIN through `user_role` / `roles`.
- **Message text** — also inside the function, top-level string literal.
- **Other status transitions** — duplicate the trigger pattern for `APPROVED` / `REJECTED` if vendors should be notified of decisions later.

## What this PR explicitly does not do

- Does not add a `read_at` or `reference_id` column to `notification` (the schema constraint stands). "Read" is tracked client-side in localStorage; clicking a toast doesn't deep-link to the invoice.
- Does not touch existing rows. Older notifications already in the table show up in the bell on next login normally.
- Does not change the vendor or contractor app. The trigger fires regardless of which app issued the UPDATE.

## Free-tier headroom

VistaOne sits comfortably inside the Supabase free tier for this feature: ~75 concurrent Realtime connections (cap is 200), a few hundred broadcast messages per month at most (cap is 2M). Project-pause after 7 idle days and the 200-connection ceiling are the only things to watch.

## Cross-app safety check before running the SQL

Confirm that the vendor and contractor apps either (a) connect to Supabase as a superuser/service role, **or** (b) do not read from the `notification` table. Once RLS is enabled on `notification`, non-superuser connections only see rows where `recipient = their JWT sub`. INSERTs are not affected by the policy.
