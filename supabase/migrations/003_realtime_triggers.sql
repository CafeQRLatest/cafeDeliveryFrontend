-- =============================================================
-- CafeQR Delivery — Realtime + DB Triggers
-- Enables Supabase Realtime on delivery_orders so the
-- order tracking page auto-updates without polling.
-- =============================================================

-- Enable Realtime publication for delivery_orders
-- (Supabase project must have Realtime enabled)
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_agents;


-- -----------------------------------------------------------
-- Auto-update updated_at on delivery_orders
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_delivery_orders_updated_at ON public.delivery_orders;
CREATE TRIGGER trg_delivery_orders_updated_at
  BEFORE UPDATE ON public.delivery_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_delivery_agents_updated_at ON public.delivery_agents;
CREATE TRIGGER trg_delivery_agents_updated_at
  BEFORE UPDATE ON public.delivery_agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- -----------------------------------------------------------
-- pg_notify trigger: fires on every order status change
-- The Next.js API layer can listen via Supabase Realtime
-- channel subscriptions — this is the DB-level safety net.
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_delivery_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.order_status IS DISTINCT FROM NEW.order_status THEN
    PERFORM pg_notify(
      'delivery_order_status_changed',
      json_build_object(
        'id',           NEW.id,
        'order_no',     NEW.order_no,
        'client_id',    NEW.client_id,
        'org_id',       NEW.org_id,
        'order_status', NEW.order_status,
        'customer_id',  NEW.customer_id,
        'agent_id',     NEW.agent_id,
        'updated_at',   NEW.updated_at
      )::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_delivery_status ON public.delivery_orders;
CREATE TRIGGER trg_notify_delivery_status
  AFTER UPDATE ON public.delivery_orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_delivery_order_status_change();


-- -----------------------------------------------------------
-- Helper view: active delivery orders with restaurant info
-- -----------------------------------------------------------
CREATE OR REPLACE VIEW public.v_active_delivery_orders AS
SELECT
  d.*,
  c.name  AS restaurant_name,
  c.logo_url AS restaurant_logo,
  c.phone AS restaurant_phone,
  o.name  AS branch_name,
  o.address AS branch_address,
  o.google_maps_url AS branch_maps_url
FROM public.delivery_orders d
JOIN public.clients c ON c.id = d.client_id
LEFT JOIN public.organizations o ON o.id = d.org_id
WHERE d.isactive = 'Y'
  AND d.order_status NOT IN ('DELIVERED', 'CANCELLED');
