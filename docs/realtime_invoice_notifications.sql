-- =====================================================================
-- Realtime invoice-submission notifications
--
-- Run this in the Supabase SQL editor against the VistaOne project.
-- All four blocks are additive: a function, a trigger, a publication
-- change, and an RLS policy. None of them alter existing tables, columns,
-- or rows. Idempotent — safe to re-run.
--
-- After running, swap the Flask JWT_SECRET to the value at:
--   Supabase Project Settings -> API -> JWT Secret
-- so the JWTs Flask issues validate against Realtime / RLS.
-- All currently-logged-in users will need to log out and back in once
-- after the secret swap.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Function: write a notification row for every active member of the
--    client when an invoice transitions into SUBMITTED.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_invoice_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only act on the OLD != SUBMITTED, NEW = SUBMITTED transition.
  -- (The trigger's WHEN clause already gates on a status change, so
  -- this guards against any other status flipping into SUBMITTED via
  -- a path that bypasses the WHEN.)
  IF NEW.invoice_status = 'SUBMITTED'
     AND (OLD.invoice_status IS DISTINCT FROM 'SUBMITTED') THEN

    INSERT INTO public.notification (
      id, message, recipient, level, created_by, updated_by
    )
    SELECT
      gen_random_uuid()::text,
      'A new invoice was submitted for your review',
      cu.user_id,
      'INFO',
      NEW.updated_by,
      NEW.updated_by
    FROM public.client_user cu
    WHERE cu.client_id = NEW.client_id
      AND cu.status = 'ACTIVE';

  END IF;

  RETURN NEW;
END;
$$;


-- ---------------------------------------------------------------------
-- 2. Trigger: fire AFTER UPDATE OF invoice_status only.
--    Idempotent via DROP IF EXISTS so re-running is safe.
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS invoice_submitted_notify ON public.invoice;

CREATE TRIGGER invoice_submitted_notify
  AFTER UPDATE OF invoice_status ON public.invoice
  FOR EACH ROW
  WHEN (NEW.invoice_status IS DISTINCT FROM OLD.invoice_status)
  EXECUTE FUNCTION public.notify_invoice_submitted();


-- ---------------------------------------------------------------------
-- 3. Realtime: broadcast row changes on the notification table.
--    The IF NOT EXISTS guard makes re-runs safe.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notification'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notification';
  END IF;
END
$$;


-- ---------------------------------------------------------------------
-- 4. Row Level Security: each user only sees their own notifications.
--    Existing Flask connections via the postgres superuser bypass RLS,
--    so the API layer is unaffected.
-- ---------------------------------------------------------------------
ALTER TABLE public.notification ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_own_only_select ON public.notification;

CREATE POLICY notification_own_only_select ON public.notification
  FOR SELECT
  USING ((auth.jwt() ->> 'sub') = recipient);


-- =====================================================================
-- Verification queries (read-only — run after the four blocks above)
-- =====================================================================

-- Trigger present and tied to the right table?
-- SELECT tgname, tgrelid::regclass
--   FROM pg_trigger
--  WHERE tgname = 'invoice_submitted_notify';

-- Notification table in the realtime publication?
-- SELECT pubname, schemaname, tablename
--   FROM pg_publication_tables
--  WHERE tablename = 'notification';

-- Policy in place?
-- SELECT polname, polrelid::regclass
--   FROM pg_policy
--  WHERE polrelid = 'public.notification'::regclass;
