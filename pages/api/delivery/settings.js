/**
 * pages/api/delivery/settings.js
 *
 * GET /api/delivery/settings?orgId=<uuid>
 *
 * Returns the delivery_settings row for the given org.
 * Also returns the organization name + address from the
 * organizations table so the order page can display the
 * restaurant header without a second round-trip.
 *
 * Response shape:
 * {
 *   settings: {
 *     is_delivery_enabled, is_takeaway_enabled,
 *     delivery_fee, free_delivery_above, min_order_amount,
 *     max_delivery_radius_km, estimated_time_min, estimated_time_max,
 *     operating_hours, promo_text
 *   },
 *   restaurant: {
 *     client_id, org_id, name, branch_name, address,
 *     phone, logo_url, google_maps_url
 *   }
 * }
 *
 * Auth:   Public (no session required) — settings are read-only public data.
 * DB:     lib/db.js (PostgreSQL pool via Docker)
 * Cache:  Redis, key = delivery:settings:<orgId>, TTL = 5 min
 */

import { query }    from '@/lib/db';
import { getCache, setCache } from '@/lib/redis';

const CACHE_TTL_SECONDS = 300; // 5 minutes

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orgId } = req.query;

  if (!orgId || typeof orgId !== 'string' || orgId.trim() === '') {
    return res.status(400).json({ error: 'Missing required query param: orgId' });
  }

  // Basic UUID format guard — prevents injection via cache key
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(orgId)) {
    return res.status(400).json({ error: 'Invalid orgId format' });
  }

  const cacheKey = `delivery:settings:${orgId}`;

  try {
    // ── 1. Cache hit ────────────────────────────────────────────
    const cached = await getCache(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cached);
    }

    // ── 2. DB query ─────────────────────────────────────────────
    // Single JOIN: delivery_settings → organizations → clients
    // Fetches everything the order page needs in one round-trip.
    const { rows } = await query(
      `SELECT
         ds.id                    AS settings_id,
         ds.client_id,
         ds.org_id,
         ds.is_delivery_enabled,
         ds.is_takeaway_enabled,
         ds.delivery_fee,
         ds.free_delivery_above,
         ds.min_order_amount,
         ds.max_delivery_radius_km,
         ds.estimated_time_min,
         ds.estimated_time_max,
         ds.operating_hours,
         ds.promo_text,
         -- restaurant / branch info
         c.name                   AS restaurant_name,
         c.phone                  AS restaurant_phone,
         c.logo_url               AS restaurant_logo,
         o.name                   AS branch_name,
         o.address                AS branch_address,
         o.google_maps_url        AS branch_maps_url
       FROM public.delivery_settings ds
       JOIN public.organizations o  ON o.id  = ds.org_id
       JOIN public.clients       c  ON c.id  = ds.client_id
       WHERE ds.org_id = $1
         AND o.isactive = 'Y'
         AND c.isactive = 'Y'
       LIMIT 1`,
      [orgId],
    );

    // ── 3. Not found ─────────────────────────────────────────────
    if (rows.length === 0) {
      return res.status(404).json({
        error: 'No delivery settings found for this organisation',
      });
    }

    const row = rows[0];

    // ── 4. Shape response ────────────────────────────────────────
    const payload = {
      settings: {
        is_delivery_enabled:    row.is_delivery_enabled,
        is_takeaway_enabled:    row.is_takeaway_enabled,
        delivery_fee:           Number(row.delivery_fee),
        free_delivery_above:    Number(row.free_delivery_above),
        min_order_amount:       Number(row.min_order_amount),
        max_delivery_radius_km: Number(row.max_delivery_radius_km),
        estimated_time_min:     row.estimated_time_min,
        estimated_time_max:     row.estimated_time_max,
        operating_hours:        row.operating_hours ?? {},
        promo_text:             row.promo_text ?? null,
      },
      restaurant: {
        client_id:      row.client_id,
        org_id:         row.org_id,
        name:           row.restaurant_name,
        branch_name:    row.branch_name,
        address:        row.branch_address,
        phone:          row.restaurant_phone,
        logo_url:       row.restaurant_logo,
        google_maps_url: row.branch_maps_url,
      },
    };

    // ── 5. Write to cache ────────────────────────────────────────
    await setCache(cacheKey, payload, CACHE_TTL_SECONDS);

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(payload);

  } catch (err) {
    console.error('[api/delivery/settings] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
