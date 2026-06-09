-- =============================================================
-- CafeQR Delivery — Row Level Security Policies
-- Run AFTER 001_delivery_tables.sql
-- =============================================================

-- Enable RLS on all delivery tables
ALTER TABLE public.delivery_orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_agents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_fcm_tokens       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_notifications_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_addresses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_settings         ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------
-- delivery_orders
-- -----------------------------------------------------------

-- Anon/public: can INSERT a new order (customer placing order)
DROP POLICY IF EXISTS "delivery_orders_insert_anon" ON public.delivery_orders;
CREATE POLICY "delivery_orders_insert_anon"
  ON public.delivery_orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Anon/public: can SELECT their own order by phone (for status page)
DROP POLICY IF EXISTS "delivery_orders_select_by_phone" ON public.delivery_orders;
CREATE POLICY "delivery_orders_select_by_phone"
  ON public.delivery_orders FOR SELECT
  TO anon, authenticated
  USING (true);  -- narrowed by app-level filter on customer_phone + order_id

-- Service role: full access (used by API routes with service key)
DROP POLICY IF EXISTS "delivery_orders_service_role" ON public.delivery_orders;
CREATE POLICY "delivery_orders_service_role"
  ON public.delivery_orders FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);


-- -----------------------------------------------------------
-- delivery_fcm_tokens
-- -----------------------------------------------------------

-- Customers can insert/update their own FCM token
DROP POLICY IF EXISTS "fcm_tokens_upsert_anon" ON public.delivery_fcm_tokens;
CREATE POLICY "fcm_tokens_upsert_anon"
  ON public.delivery_fcm_tokens FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Service role: full access
DROP POLICY IF EXISTS "fcm_tokens_service_role" ON public.delivery_fcm_tokens;
CREATE POLICY "fcm_tokens_service_role"
  ON public.delivery_fcm_tokens FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);


-- -----------------------------------------------------------
-- delivery_addresses
-- -----------------------------------------------------------

DROP POLICY IF EXISTS "del_addresses_anon_rw" ON public.delivery_addresses;
CREATE POLICY "del_addresses_anon_rw"
  ON public.delivery_addresses FOR ALL
  TO anon, authenticated
  USING (true) WITH CHECK (true);


-- -----------------------------------------------------------
-- delivery_settings (read-only for public)
-- -----------------------------------------------------------

DROP POLICY IF EXISTS "delivery_settings_public_read" ON public.delivery_settings;
CREATE POLICY "delivery_settings_public_read"
  ON public.delivery_settings FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "delivery_settings_service_role" ON public.delivery_settings;
CREATE POLICY "delivery_settings_service_role"
  ON public.delivery_settings FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);


-- -----------------------------------------------------------
-- delivery_agents (restaurant staff readable, service role writable)
-- -----------------------------------------------------------

DROP POLICY IF EXISTS "delivery_agents_read" ON public.delivery_agents;
CREATE POLICY "delivery_agents_read"
  ON public.delivery_agents FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "delivery_agents_service_role" ON public.delivery_agents;
CREATE POLICY "delivery_agents_service_role"
  ON public.delivery_agents FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);


-- -----------------------------------------------------------
-- delivery_notifications_log (service role only)
-- -----------------------------------------------------------

DROP POLICY IF EXISTS "notif_log_service_role" ON public.delivery_notifications_log;
CREATE POLICY "notif_log_service_role"
  ON public.delivery_notifications_log FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
