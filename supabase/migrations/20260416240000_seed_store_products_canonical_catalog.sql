-- Seed the live catalog for store_products.
--
-- Context: The store_products table was created by 20260415180000 but never
-- populated. The Store page therefore rendered "No products found" for every
-- authenticated viewer (including super_admin). This seeds the canonical
-- retail catalog (jerseys, hoodies, caps, tees, accessories, rewards) plus
-- the six custom team jerseys that the SBBL-HQ Ops team agreed on as the
-- launch set.
--
-- Images live in public/images/store/** (served at /images/store/*.svg and
-- /images/store/custom/*.jpg). Prices are stored in cents (price_cents).
-- Custom jerseys have price_cents = 0 because they are quote-request flows.
--
-- Idempotent: stable string IDs are used as the conflict target via a
-- partial unique index on `name` (store_products has no natural
-- content-key, so we use name uniqueness with WHERE _deleted=false).

CREATE UNIQUE INDEX IF NOT EXISTS store_products_name_uq
  ON public.store_products (name)
  WHERE _deleted = false;

INSERT INTO public.store_products
  (name, description, category, price_cents, image_url, sizes, colors, badge, is_custom, active)
VALUES
  -- Retail catalog (league-agnostic SBBL-HQ branding)
  ('SBBL HQ Official Jersey',  'Official league jersey — Black/Gold or White/Gold.', 'jerseys',     4500,
   '/images/store/store-jersey.svg',      ARRAY['S','M','L','XL','2XL']::text[],
   ARRAY['Black/Gold','White/Gold']::text[], 'SALE',  false, true),
  ('APEX Hoodie',              'Heavyweight fleece hoodie — Black or Charcoal.',     'hoodies',     5500,
   '/images/store/store-hoodie.svg',      ARRAY['S','M','L','XL']::text[],
   ARRAY['Black','Charcoal']::text[],        'SALE',  false, true),
  ('Championship Cap',         'Structured 6-panel with embroidered logo.',          'caps',        2500,
   '/images/store/store-cap.svg',         NULL::text[],
   ARRAY['Black/Gold','Black/Silver']::text[], NULL, false, true),
  ('Court Culture Tee',        'Premium cotton tee in Black or Graphite.',           'tees',        2900,
   '/images/store/store-tee.svg',         ARRAY['S','M','L','XL','2XL']::text[],
   ARRAY['Black','Graphite']::text[],        'SALE',  false, true),
  ('Pro Gear Bundle',          'Jersey + cap + tee bundle — save vs. separates.',    'accessories', 3500,
   '/images/store/store-accessories.svg', NULL::text[], NULL::text[],                'Bundle Deal', false, true),
  ('MVP Rewards Jersey',       'Reward redemption item — for qualified MVP tier.',   'rewards',        0,
   '/images/store/store-jersey.svg',      ARRAY['M','L','XL']::text[], NULL::text[], 'Reward Item', false, true),

  -- Custom team jerseys (quote-request flow — price_cents = 0)
  ('OY Phoenix Custom Jersey',        'Custom jersey order — OY Phoenix roster.',        'jerseys', 0,
   '/images/store/custom/oy-phoenix.jpg',        ARRAY['YS','YXL','S','M','L','XL','2XL','3XL','4XL']::text[], NULL::text[], 'CUSTOM', true, true),
  ('REBORN Custom Jersey',            'Custom jersey order — REBORN roster.',            'jerseys', 0,
   '/images/store/custom/reborn.jpg',            ARRAY['YS','YXL','S','M','L','XL','2XL','3XL','4XL']::text[], NULL::text[], 'CUSTOM', true, true),
  ('JRG Custom Jersey',               'Custom jersey order — JRG roster.',               'jerseys', 0,
   '/images/store/custom/jrg.jpg',               ARRAY['YS','YXL','S','M','L','XL','2XL','3XL','4XL']::text[], NULL::text[], 'CUSTOM', true, true),
  ('Pinoy Northstars Custom Jersey',  'Custom jersey order — Pinoy Northstars roster.',  'jerseys', 0,
   '/images/store/custom/pinoy-northstars.jpg',  ARRAY['YS','YXL','S','M','L','XL','2XL','3XL','4XL']::text[], NULL::text[], 'CUSTOM', true, true),
  ('Quadros Custom Jersey',           'Custom jersey order — Quadros roster.',           'jerseys', 0,
   '/images/store/custom/quadros.jpg',           ARRAY['YS','YXL','S','M','L','XL','2XL','3XL','4XL']::text[], NULL::text[], 'CUSTOM', true, true),
  ('Montanyosa Custom Jersey',        'Custom jersey order — Montanyosa roster.',        'jerseys', 0,
   '/images/store/custom/montanyosa.jpg',        ARRAY['YS','YXL','S','M','L','XL','2XL','3XL','4XL']::text[], NULL::text[], 'CUSTOM', true, true)
ON CONFLICT (name) WHERE _deleted = false DO UPDATE
SET description = EXCLUDED.description,
    category    = EXCLUDED.category,
    price_cents = EXCLUDED.price_cents,
    image_url   = EXCLUDED.image_url,
    sizes       = EXCLUDED.sizes,
    colors      = EXCLUDED.colors,
    badge       = EXCLUDED.badge,
    is_custom   = EXCLUDED.is_custom,
    active      = EXCLUDED.active;
