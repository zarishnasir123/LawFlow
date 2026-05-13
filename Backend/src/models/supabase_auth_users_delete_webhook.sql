-- =====================================================================
-- Optional: run this in the Supabase SQL Editor to register a Postgres
-- trigger that calls LawFlow's webhook whenever a row in auth.users
-- is deleted from Supabase. Requires the pg_net extension (enabled by
-- default on Supabase projects).
--
-- IMPORTANT: replace the placeholders below before running:
--   - LAWFLOW_PUBLIC_URL   — must be a URL Supabase can reach, e.g. the
--                            ngrok URL pointing at http://localhost:5000
--                            in dev, or your deployed backend URL.
--   - SUPABASE_WEBHOOK_SECRET — must match the same env var on the LawFlow
--                                backend (auth.controller.supabaseAuthWebhook
--                                validates it via timing-safe compare).
--
-- Once registered, deleting a user in Supabase Auth (dashboard or via
-- the admin API) automatically cleans their LawFlow records.
-- If you do not / cannot expose LawFlow publicly, skip this file and
-- rely on `npm run sync:supabase-users:apply` instead.
-- =====================================================================

-- 1) Make sure pg_net is available.
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2) Trigger function. Posts the OLD row to the LawFlow webhook in the
--    same JSON shape that supabaseAuthWebhook expects: { type, schema,
--    table, old_record }.
CREATE OR REPLACE FUNCTION public.lawflow_notify_auth_user_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  webhook_url    TEXT := 'LAWFLOW_PUBLIC_URL/api/auth/webhooks/supabase';
  webhook_secret TEXT := 'SUPABASE_WEBHOOK_SECRET';
BEGIN
  PERFORM net.http_post(
    url     := webhook_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-webhook-secret', webhook_secret
               ),
    body    := jsonb_build_object(
                 'type',       'DELETE',
                 'schema',     'auth',
                 'table',      'users',
                 'old_record', to_jsonb(OLD)
               )
  );
  RETURN OLD;
END;
$$;

-- 3) Attach the trigger to auth.users. Drop first for idempotence.
DROP TRIGGER IF EXISTS lawflow_on_auth_user_delete ON auth.users;
CREATE TRIGGER lawflow_on_auth_user_delete
AFTER DELETE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.lawflow_notify_auth_user_delete();
