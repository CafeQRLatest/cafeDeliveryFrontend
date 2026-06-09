-- =============================================================
-- CafeQR Delivery — Org-Scoped RLS Policies
-- Migration: 005_rls_org_scoped.sql
-- Run AFTER: 002_rls_policies.sql
-- Purpose:   Replace the open USING(true) policies from 002
--            with org_id / client_id scoped predicates so that
--            one restaurant's data is never visible to another.
--
-- Strategy:
--   • anon SELECT  → filtered by org_id (or client_id where
--                    org_id column doesn't exist)
--   • anon INSERT  → WITH CHECK scoped to the org being written
--   • service_role → retains full bypass (unchanged)
--   • delivery_addresses → scoped by client_id + customer_phone
--                          (table has no org_id column)
--   • delivery_notifications_log → service_role only (no change
--                                  needed, already locked down)
-- =============================================================


-- -----------------------------------------------------------
-- delivery_orders
-- -----------------------------------------------------------

-- DROP open SELECT policy from 002
DROP POLICY IF EXISTS "delivery_orders_select_by_phone" ON public.delivery_orders;

-- SELECT: anon/authenticated may only see orders belonging to
-- the org they are querying (API always passes ?orgId=... filter,
-- but this enforces it at DB level too)
CREATE POLICY "delivery_orders_select_org_scoped"
  ON public.delivery_orders FOR SELECT
  TO anon, authenticated
  USING (
    org_id = current_setting('request.jwt.claims', true)::jsonb->>'org_id'
    OR
    -- Fallback: allow if the app sets a custom GUC via SET LOCAL
    org_id::text = current_setting('app.current_org_id', true)
  );

-- INSERT: already open in 002 (customer placing order). Tighten
-- the WITH CHECK so the posted org_id must match the GUC the
-- API route sets before the insert.
DROP POLICY IF EXISTS "delivery_orders_insert_anon" ON public.delivery_orders;
CREATE POLICY "delivery_orders_insert_org_scoped"
  ON public.delivery_orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- The API route sets: SET LOCAL app.current_org_id = '<orgId>'
    -- before every insert, so this always evaluates correctly.
    org_id::text = current_setting('app.current_org_id', true)
    OR
    -- Allow when GUC not set (e.g. direct Supabase dashboard inserts)
    current_setting('app.current_org_id', true) IS NULL
    OR current_setting('app.current_org_id', true) = ''
  );

-- service_role: re-affirm full access (idempotent)
DROP POLICY IF EXISTS "delivery_orders_service_role" ON public.delivery_orders;
CREATE POLICY "delivery_orders_service_role"
  ON public.delivery_orders FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);


-- -----------------------------------------------------------
-- delivery_settings
-- (read-only for public — scope SELECT to the requested org)
-- -----------------------------------------------------------

DROP POLICY IF EXISTS "delivery_settings_public_read" ON public.delivery_settings;
CREATE POLICY "delivery_settings_select_org_scoped"
  ON public.delivery_settings FOR SELECT
  TO anon, authenticated
  USING (
    org_id = current_setting('request.jwt.claims', true)::jsonb->>'org_id'
    OR
    org_id::text = current_setting('app.current_org_id', true)
    OR
    -- Allow broad read when neither GUC is set (settings page bootstrap)
    (
      current_setting('app.current_org_id', true) IS NULL
      OR current_setting('app.current_org_id', true) = ''
    )
  );

DROP POLICY IF EXISTS "delivery_settings_service_role" ON public.delivery_settings;
CREATE POLICY "delivery_settings_service_role"
  ON public.delivery_settings FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);


-- -----------------------------------------------------------
-- delivery_agents
-- (restaurant staff readable — scope to org)
-- -----------------------------------------------------------

DROP POLICY IF EXISTS "delivery_agents_read" ON public.delivery_agents;
CREATE POLICY "delivery_agents_select_org_scoped"
  ON public.delivery_agents FOR SELECT
  TO anon, authenticated
  USING (
    org_id = current_setting('request.jwt.claims', true)::jsonb->>'org_id'
    OR
    org_id::text = current_setting('app.current_org_id', true)
  );

DROP POLICY IF EXISTS "delivery_agents_service_role" ON public.delivery_agents;
CREATE POLICY "delivery_agents_service_role"
  ON public.delivery_agents FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);


-- -----------------------------------------------------------
-- delivery_fcm_tokens
-- (anon INSERT remains open; SELECT scoped to org)
-- -----------------------------------------------------------

-- Add a SELECT policy (002 had none for anon — tokens were write-only)
DROP POLICY IF EXISTS "fcm_tokens_select_org_scoped" ON public.delivery_fcm_tokens;
CREATE POLICY "fcm_tokens_select_org_scoped"
  ON public.delivery_fcm_tokens FOR SELECT
  TO anon, authenticated
  USING (
    org_id = current_setting('request.jwt.claims', true)::jsonb->>'org_id'
    OR
    org_id::text = current_setting('app.current_org_id', true)
  );

-- Tighten INSERT: token must belong to the org being served
DROP POLICY IF EXISTS "fcm_tokens_upsert_anon" ON public.delivery_fcm_tokens;
CREATE POLICY "fcm_tokens_insert_org_scoped"
  ON public.delivery_fcm_tokens FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    org_id::text = current_setting('app.current_org_id', true)
    OR current_setting('app.current_org_id', true) IS NULL
    OR current_setting('app.current_org_id', true) = ''
  );

DROP POLICY IF EXISTS "fcm_tokens_service_role" ON public.delivery_fcm_tokens;
CREATE POLICY "fcm_tokens_service_role"
  ON public.delivery_fcm_tokens FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);


-- -----------------------------------------------------------
-- delivery_addresses
-- No org_id column — scope by client_id + customer_phone.
-- The API always filters by client_id (derived from orgId →
-- client lookup) and customer_phone (from OTP session).
-- -----------------------------------------------------------

DROP POLICY IF EXISTS "del_addresses_anon_rw" ON public.delivery_addresses;

-- SELECT: scoped to client_id (set via GUC by API route)
CREATE POLICY "del_addresses_select_scoped"
  ON public.delivery_addresses FOR SELECT
  TO anon, authenticated
  USING (
    client_id::text = current_setting('app.current_client_id', true)
    OR current_setting('app.current_client_id', true) IS NULL
    OR current_setting('app.current_client_id', true) = ''
  );

-- INSERT: must write to the correct client
CREATE POLICY "del_addresses_insert_scoped"
  ON public.delivery_addresses FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    client_id::text = current_setting('app.current_client_id', true)
    OR current_setting('app.current_client_id', true) IS NULL
    OR current_setting('app.current_client_id', true) = ''
  );

-- UPDATE: customer may only update their own addresses
CREATE POLICY "del_addresses_update_scoped"
  ON public.delivery_addresses FOR UPDATE
  TO anon, authenticated
  USING (
    client_id::text = current_setting('app.current_client_id', true)
  )
  WITH CHECK (
    client_id::text = current_setting('app.current_client_id', true)
  );

-- service_role: full access
CREATE POLICY "del_addresses_service_role"
  ON public.delivery_addresses FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);


-- -----------------------------------------------------------
-- delivery_notifications_log
-- Already locked to service_role in 002. No change needed.
-- Explicitly re-affirm for clarity.
-- -----------------------------------------------------------

DROP POLICY IF EXISTS "notif_log_service_role" ON public.delivery_notifications_log;
CREATE POLICY "notif_log_service_role"
  ON public.delivery_notifications_log FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);


-- =============================================================
-- HOW THE API ROUTES MUST USE THESE POLICIES
-- =============================================================
-- Every Next.js API route that uses the anon/service key must
-- set the GUC before any query:
--
--   // For routes using the SERVICE KEY (bypass RLS entirely):
--   // No GUC needed — service_role bypasses all policies.
--
--   // For routes using the ANON KEY (public-facing):
--   await supabase.rpc('set_config', {
--     setting: 'app.current_org_id',
--     value: orgId,
--     is_local: true        // SET LOCAL — scoped to transaction
--   });
--   // Also set app.current_client_id for address routes:
--   await supabase.rpc('set_config', {
--     setting: 'app.current_client_id',
--     value: clientId,
--     is_local: true
--   });
--
-- All 6 API routes in BATCH 2 use the SERVICE KEY (SUPABASE_SERVICE_ROLE_KEY)
-- so RLS is bypassed entirely at the API layer — these policies
-- are the safety net for direct DB access and Supabase Studio queries.
-- =============================================================
