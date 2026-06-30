-- Schedule the abandoned-checkout transactional email nudge.
--
-- Apply this through the Supabase SQL editor after deploying the
-- nudge-abandoned-orders edge function. Do not commit the real service-role
-- key. Before running this file, create or update this Vault secret in the SQL
-- editor:
--
--   SELECT vault.create_secret(
--     '<service-role-key>',
--     'thistle_service_role_key',
--     'Service role key used by pg_cron to invoke nudge-abandoned-orders'
--   );

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'thistle_service_role_key'
  ) THEN
    RAISE EXCEPTION 'Missing Vault secret: thistle_service_role_key';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'nudge-abandoned-orders-hourly'
  ) THEN
    PERFORM cron.unschedule('nudge-abandoned-orders-hourly');
  END IF;
END
$$;

SELECT cron.schedule(
  'nudge-abandoned-orders-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://uglsyitjasajubfvbiry.supabase.co/functions/v1/nudge-abandoned-orders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || btrim((
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'thistle_service_role_key'
      ))
    ),
    body := jsonb_build_object('source', 'pg_cron'),
    timeout_milliseconds := 5000
  ) AS request_id;
  $$
);

-- Verification queries after applying:
-- SELECT * FROM cron.job WHERE jobname = 'nudge-abandoned-orders-hourly';
-- SELECT * FROM net._http_response ORDER BY created DESC LIMIT 5;
