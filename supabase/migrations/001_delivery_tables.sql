-- =============================================================
-- CafeQR Delivery — New Tables Migration
-- Run on: Test Supabase project first, then Production
-- Safe to run: All tables use IF NOT EXISTS
-- Does NOT alter any existing tables (orders, clients, etc.)
-- =============================================================

-- -----------------------------------------------------------
-- 1. delivery_orders
--    Extends the existing orders concept for online delivery.
--    Linked to clients/organizations but stores delivery-specific
--    fields that the POS orders table doesn't have.
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_orders (
  id                    uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id             uuid NOT NULL REFERENCES public.clients(id),
  org_id                uuid REFERENCES public.organizations(id),

  -- Order identity
  order_no              character varying NOT NULL,
  order_type            character varying NOT NULL DEFAULT 'DELIVERY', -- DELIVERY | TAKEAWAY
  order_status          character varying NOT NULL DEFAULT 'PENDING',
  payment_status        character varying NOT NULL DEFAULT 'PENDING',
  payment_method        character varying DEFAULT 'CASH',

  -- Customer (may or may not be a registered customer)
  customer_id           uuid REFERENCES public.customers(id),
  customer_name         character varying NOT NULL,
  customer_phone        character varying NOT NULL,
  customer_email        character varying,

  -- Delivery address (stored as JSONB for flexibility)
  -- Structure: { line1, line2, area, city, pincode, landmark, lat, lng }
  delivery_address      jsonb,

  -- Delivery agent
  agent_id              uuid,  -- references delivery_agents.id
  agent_assigned_at     timestamp without time zone,
  picked_up_at          timestamp without time zone,
  delivered_at          timestamp without time zone,

  -- Financial
  total_amount          numeric NOT NULL DEFAULT 0,
  total_tax_amount      numeric DEFAULT 0,
  total_discount_amount numeric DEFAULT 0,
  delivery_fee          numeric DEFAULT 0,
  grand_total           numeric NOT NULL DEFAULT 0,
  currency              character varying DEFAULT 'INR',

  -- Order items snapshot (JSONB — avoids join complexity for delivery)
  -- Array of: { product_id, product_name, variant_id, quantity, unit_price, line_total }
  order_lines_snapshot  jsonb DEFAULT '[]'::jsonb,

  -- Timing
  estimated_time_minutes integer DEFAULT 30,
  order_date            timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  confirmed_at          timestamp without time zone,
  cancelled_at          timestamp without time zone,
  cancellation_reason   text,
  cancelled_by          character varying, -- customer | restaurant | system

  -- Linked POS order (set after restaurant confirms and creates POS order)
  pos_order_id          uuid REFERENCES public.orders(id),

  -- Source tracking
  order_source          character varying DEFAULT 'ONLINE', -- ONLINE | APP
  device_info           jsonb,
  utm_source            character varying,

  -- Special instructions
  notes                 text,

  -- Audit
  isactive              character DEFAULT 'Y'::bpchar,
  created_at            timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at            timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  created_by            character varying,
  updated_by            character varying,
  version               bigint NOT NULL DEFAULT 0,

  CONSTRAINT delivery_orders_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_orders_client_id  ON public.delivery_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_org_id     ON public.delivery_orders(org_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_status     ON public.delivery_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_phone      ON public.delivery_orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_created_at ON public.delivery_orders(created_at DESC);


-- -----------------------------------------------------------
-- 2. delivery_agents
--    Delivery personnel registered per client/org.
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_agents (
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id     uuid NOT NULL REFERENCES public.clients(id),
  org_id        uuid REFERENCES public.organizations(id),
  name          character varying NOT NULL,
  phone         character varying NOT NULL,
  email         character varying,
  photo_url     text,
  status        character varying DEFAULT 'AVAILABLE', -- AVAILABLE | BUSY | OFFLINE
  vehicle_type  character varying,   -- BIKE | CYCLE | WALK
  vehicle_no    character varying,
  is_active     boolean DEFAULT true,
  created_at    timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at    timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  created_by    character varying,
  updated_by    character varying,
  CONSTRAINT delivery_agents_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_agents_client_id ON public.delivery_agents(client_id);
CREATE INDEX IF NOT EXISTS idx_delivery_agents_status    ON public.delivery_agents(status);


-- -----------------------------------------------------------
-- 3. delivery_fcm_tokens
--    Stores FCM device tokens for push notifications.
--    role: 'customer' | 'restaurant' | 'agent'
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_fcm_tokens (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id    uuid REFERENCES public.clients(id),
  org_id       uuid REFERENCES public.organizations(id),
  role         character varying NOT NULL,  -- customer | restaurant | agent
  entity_id    uuid,   -- customer_id or agent_id (null for restaurant tokens)
  token        text NOT NULL,
  device_type  character varying,  -- web | android | ios
  is_active    boolean DEFAULT true,
  last_seen_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  created_at   timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at   timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT delivery_fcm_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT delivery_fcm_tokens_token_unique UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_client_org  ON public.delivery_fcm_tokens(client_id, org_id);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_entity_id   ON public.delivery_fcm_tokens(entity_id);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_role        ON public.delivery_fcm_tokens(role);


-- -----------------------------------------------------------
-- 4. delivery_notifications_log
--    Audit trail for every push notification sent.
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_notifications_log (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id     uuid REFERENCES public.delivery_orders(id),
  client_id    uuid REFERENCES public.clients(id),
  target_role  character varying NOT NULL,
  event_type   character varying NOT NULL,
  title        text,
  body         text,
  data         jsonb DEFAULT '{}'::jsonb,
  sent_at      timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT delivery_notifications_log_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_notif_log_order_id  ON public.delivery_notifications_log(order_id);
CREATE INDEX IF NOT EXISTS idx_notif_log_client_id ON public.delivery_notifications_log(client_id);


-- -----------------------------------------------------------
-- 5. delivery_addresses
--    Saved delivery addresses per customer phone number.
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_addresses (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id    uuid REFERENCES public.clients(id),
  customer_phone character varying NOT NULL,
  label        character varying DEFAULT 'Home', -- Home | Work | Other
  line1        text NOT NULL,
  line2        text,
  area         character varying,
  city         character varying,
  pincode      character varying,
  landmark     text,
  latitude     double precision,
  longitude    double precision,
  is_default   boolean DEFAULT false,
  is_active    boolean DEFAULT true,
  created_at   timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at   timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT delivery_addresses_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_del_addresses_phone     ON public.delivery_addresses(customer_phone);
CREATE INDEX IF NOT EXISTS idx_del_addresses_client_id ON public.delivery_addresses(client_id);


-- -----------------------------------------------------------
-- 6. delivery_settings
--    Per-org delivery configuration (fees, radius, hours, etc.)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_settings (
  id                    uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id             uuid NOT NULL REFERENCES public.clients(id),
  org_id                uuid REFERENCES public.organizations(id),
  is_delivery_enabled   boolean DEFAULT true,
  is_takeaway_enabled   boolean DEFAULT true,
  delivery_fee          numeric DEFAULT 40,
  free_delivery_above   numeric DEFAULT 299,
  min_order_amount      numeric DEFAULT 0,
  max_delivery_radius_km double precision DEFAULT 5,
  estimated_time_min    integer DEFAULT 20,
  estimated_time_max    integer DEFAULT 40,
  -- Operating hours: { mon: { open: '09:00', close: '22:00', closed: false }, ... }
  operating_hours       jsonb DEFAULT '{}'::jsonb,
  -- Banner / promo text shown on the ordering page
  promo_text            text,
  created_at            timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at            timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  created_by            character varying,
  updated_by            character varying,
  CONSTRAINT delivery_settings_pkey PRIMARY KEY (id),
  CONSTRAINT delivery_settings_client_org_unique UNIQUE (client_id, org_id)
);
