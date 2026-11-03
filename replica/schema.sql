-- Rental platform schema (a clean-room rebuild of a rental back office + storefront).
-- Postgres 16. Multi-tenant: every business row carries org_id.
--
-- Conventions
--   ids        uuid, gen_random_uuid()
--   money      bigint cents; currency lives on orgs (one currency per org) and is
--              copied onto orders and payments so history survives a change
--   time       timestamptz, real UTC instants. Wall-clock rules (operating hours,
--              default times) are stored as local `time` plus the org's IANA zone
--   tenancy    row level security on every org table, keyed on the
--              `app.org_id` setting the data layer sets per transaction.
--              Child rows reference parents by (org_id, id), so a row can never
--              point at another tenant's row, even through a forged id.
--   deletes    business records archive (archived_at), they are not deleted.
--              on delete rules below cover the cases where a hard delete is allowed.

create extension if not exists btree_gist;
create extension if not exists citext;
create extension if not exists pgcrypto;  -- gen_random_bytes for link tokens

-- ---------------------------------------------------------------------------
-- helpers

create function current_org_id() returns uuid
language sql stable as $$
  select nullif(current_setting('app.org_id', true), '')::uuid
$$;

create function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- tenants and people

create table orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  slug citext not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$'),
  custom_domain citext unique,
  currency char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  time_zone text not null default 'UTC',
  locale text not null default 'en',
  logo_url text,
  -- SaaS billing for the org itself (our Stripe account, not theirs)
  plan text not null default 'trial' check (plan in ('trial','start','grow','scale','canceled')),
  trial_ends_at timestamptz,
  billing_customer_id text,
  billing_subscription_id text,
  billing_status text,
  -- the org's own Stripe account for taking rental payments (Stripe Connect)
  stripe_account_id text unique,
  stripe_charges_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Users are owned by the auth library (Better Auth); this is the shape the
-- rest of the schema relies on. Users are global, membership is per org.
create table users (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  name text not null,
  email_verified boolean not null default false,
  two_factor_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  -- fine-grained rights for members, e.g. {cancel_orders, revert_orders, manage_stock, manage_settings}
  permissions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index on memberships (user_id);

create table org_settings (
  org_id uuid primary key references orgs(id) on delete cascade,
  -- what this business calls things ("Bookings", "Clients"...)
  labels jsonb not null default '{}',
  -- pricing
  pricing_enabled boolean not null default true,
  prices_include_tax boolean not null default false,
  deposit_type text not null default 'none'
    check (deposit_type in ('none','percent_of_order','percent_of_product_value','fixed')),
  deposit_value numeric(12,2) not null default 0 check (deposit_value >= 0),
  -- rental period
  period_mode text not null default 'free'
    check (period_mode in ('free','fixed_durations','time_slots')),
  time_selection boolean not null default true,
  time_increment_minutes int not null default 30 check (time_increment_minutes in (15,30,60)),
  default_pickup_time time not null default '09:00',
  default_return_time time not null default '17:00',
  prefill_times text not null default 'off' check (prefill_times in ('off','back_office','both')),
  operating_hours_enabled boolean not null default false,
  min_notice_minutes int not null default 0 check (min_notice_minutes >= 0),
  rules_apply_to_manual_orders boolean not null default false,
  -- storefront
  store_live boolean not null default false,
  availability_enabled boolean not null default true,  -- off = orders arrive as drafts (request mode)
  show_availability_calendar boolean not null default true,
  hide_quantities boolean not null default false,
  show_prices boolean not null default true,
  price_label text not null default 'charge_period'
    check (price_label in ('charge_period','order_period','base_price')),
  brand_color text not null default '#4F46E5' check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  default_pickup_location_id uuid,
  delivery_countries text[] not null default '{}',
  require_address_in_period_picker boolean not null default false,
  -- checkout
  checkout_payment text not null default 'full'
    check (checkout_payment in ('full','down_payment','deposit_only','none')),
  down_payment_percent numeric(5,2) not null default 0 check (down_payment_percent between 0 and 100),
  deposit_at_checkout boolean not null default true,
  pay_later_enabled boolean not null default false,
  pay_later_label text,
  pay_later_terms text,
  terms_enabled boolean not null default false,
  terms_text text,
  back_to_website_url text,
  checkout_form jsonb not null default '[]',  -- ordered list of form items
  -- email
  bcc_emails text[] not null default '{}',
  sender_name text,
  updated_at timestamptz not null default now()
);

create table org_counters (
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null check (name in ('order','customer')),
  value bigint not null default 0,
  primary key (org_id, name)
);

-- ---------------------------------------------------------------------------
-- places and calendars

create table locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  code text not null,
  address jsonb not null default '{}',
  pickup_enabled boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, code)
);

alter table org_settings
  add constraint org_settings_default_location_fk
  foreign key (org_id, default_pickup_location_id) references locations(org_id, id)
  on delete set null (default_pickup_location_id);

create table operating_hours (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  location_id uuid,  -- null = all locations
  weekday smallint not null check (weekday between 0 and 6),  -- 0 = Monday
  opens time not null,
  closes time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closes > opens),
  foreign key (org_id, location_id) references locations(org_id, id) on delete cascade
);
create index on operating_hours (org_id, weekday);

create table away_periods (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index on away_periods (org_id, starts_at);

-- fixed durations ("4 hours", "1 week") and fixed time slots ("09:00-12:00")
create table rental_period_options (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  kind text not null check (kind in ('duration','slot')),
  label text not null,
  duration_minutes int check (duration_minutes > 0),
  slot_start time,
  slot_end time,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'duration' and duration_minutes is not null)
      or (kind = 'slot' and slot_start is not null and slot_end > slot_start))
);
create index on rental_period_options (org_id, kind, position);

-- ---------------------------------------------------------------------------
-- tax

create table tax_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  kind text not null check (kind in ('product','customer')),
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id)
);
create unique index tax_profiles_one_default on tax_profiles (org_id, kind) where is_default;

create table tax_rates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  product_profile_id uuid not null,
  customer_profile_id uuid,  -- null = applies when the customer has no profile
  name text not null,
  rate_bps int not null check (rate_bps between 0 and 100000),  -- 2100 = 21%
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (org_id, product_profile_id) references tax_profiles(org_id, id) on delete cascade,
  foreign key (org_id, customer_profile_id) references tax_profiles(org_id, id) on delete cascade
);
create index on tax_rates (org_id, product_profile_id);

-- ---------------------------------------------------------------------------
-- pricing

create table price_structures (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  is_template boolean not null default true,  -- false = one-off structure of one product
  -- multiplier of the base price for every period past the last tile
  extra_period text check (extra_period in ('hour','day','week','month')),
  extra_multiplier numeric(10,4) check (extra_multiplier >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id)
);

create table price_tiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  structure_id uuid not null,
  label text not null,          -- shown as the charge label ("3 days")
  length_seconds bigint not null check (length_seconds > 0),
  multiplier numeric(10,4) not null check (multiplier >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (org_id, structure_id) references price_structures(org_id, id) on delete cascade,
  unique (structure_id, length_seconds)
);

create table price_rulesets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  stacking text not null default 'off' check (stacking in ('off','sum','compound')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id)
);

create table price_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  ruleset_id uuid not null,
  name text not null,
  kind text not null check (kind in ('date_range','weekdays','free_pickup_day','free_return_day')),
  starts_at timestamptz,                  -- date_range
  ends_at timestamptz,
  weekdays smallint[],                    -- weekdays (0 = Monday)
  from_time time,
  till_time time,
  adjustment_percent numeric(7,2),        -- -20 = 20% off
  apply_when text check (apply_when in ('overlaps','within','spans')),
  free_if_pickup_after time,              -- free_pickup_day
  min_duration_seconds bigint,
  max_duration_seconds bigint,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (org_id, ruleset_id) references price_rulesets(org_id, id) on delete cascade
);
create index on price_rules (org_id, ruleset_id);

-- ---------------------------------------------------------------------------
-- catalogue

create table products (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  slug citext not null,
  sku text,
  description text,                         -- storefront
  document_description text,                -- on documents and packing slips
  product_type text not null check (product_type in ('rental','service','sales_item')),
  tracking text not null check (tracking in ('individual','bulk','none')),
  has_variations boolean not null default false,
  variation_fields text[] not null default '{}',   -- e.g. {colour,size}
  -- pricing
  price_type text not null default 'flat'
    check (price_type in ('flat','fixed','structure','none')),
  price_period text check (price_period in ('minute','hour','day','week','month')),
  price_structure_id uuid,
  price_ruleset_id uuid,
  taxable boolean not null default true,
  tax_profile_id uuid,
  discountable boolean not null default true,
  deposit_value_cents bigint not null default 0 check (deposit_value_cents >= 0),
  default_purchase_cost_cents bigint check (default_purchase_cost_cents >= 0),
  -- availability rules
  buffer_before_seconds int not null default 0 check (buffer_before_seconds >= 0),
  buffer_after_seconds int not null default 0 check (buffer_after_seconds >= 0),
  allow_shortage boolean not null default false,
  shortage_limit int not null default 0 check (shortage_limit >= 0),
  -- storefront
  show_in_store boolean not null default true,
  sorting_weight int not null default 0,
  seo_title text,
  seo_description text,
  tags text[] not null default '{}',
  custom_fields jsonb not null default '{}',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  check (product_type = 'rental' or tracking = 'none'),
  check (product_type <> 'rental' or tracking in ('individual','bulk')),
  check (product_type <> 'sales_item' or price_type in ('fixed','none')),
  check (price_type <> 'flat' or price_period is not null),
  check (price_type <> 'structure' or price_structure_id is not null),
  foreign key (org_id, price_structure_id) references price_structures(org_id, id) on delete restrict,
  foreign key (org_id, price_ruleset_id) references price_rulesets(org_id, id) on delete set null (price_ruleset_id),
  foreign key (org_id, tax_profile_id) references tax_profiles(org_id, id) on delete set null (tax_profile_id)
);
create unique index products_slug on products (org_id, slug) where archived_at is null;
create index on products (org_id, product_type) where archived_at is null;
create index on products (org_id, price_structure_id);
create index on products (org_id, price_ruleset_id);
create index products_tags on products using gin (tags);
create index products_name_search on products using gin (to_tsvector('simple', name || ' ' || coalesce(sku,'')));

-- tracking type and product type cannot change after creation
create function products_immutable_kind() returns trigger
language plpgsql as $$
begin
  if new.product_type <> old.product_type or new.tracking <> old.tracking then
    raise exception 'product_type and tracking cannot be changed after creation';
  end if;
  if old.has_variations and not new.has_variations then
    raise exception 'variations cannot be turned off once enabled';
  end if;
  return new;
end $$;
create trigger products_immutable_kind before update on products
  for each row execute function products_immutable_kind();

create table product_photos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  product_id uuid not null,
  storage_key text not null,
  position smallint not null default 0 check (position between 0 and 2),  -- up to 3
  created_at timestamptz not null default now(),
  foreign key (org_id, product_id) references products(org_id, id) on delete cascade,
  unique (product_id, position)
);

-- Every product has at least one variant; stock and price live on the variant.
create table product_variants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  product_id uuid not null,
  option_values jsonb not null default '{}',     -- {"colour":"red","size":"M"}
  base_price_cents bigint not null default 0 check (base_price_cents >= 0),
  sku text,
  position int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  foreign key (org_id, product_id) references products(org_id, id) on delete cascade
);
create index on product_variants (org_id, product_id);
create unique index product_variants_options on product_variants (product_id, option_values) where archived_at is null;

-- individually tracked units
create table stock_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  variant_id uuid not null,
  location_id uuid,
  identifier text not null,
  kind text not null default 'regular' check (kind in ('regular','temporary')),
  available_from timestamptz,    -- set = expected stock (or temporary start)
  available_till timestamptz,    -- set = temporary stock end
  purchase_cost_cents bigint check (purchase_cost_cents >= 0),
  purchased_on date,
  custom_fields jsonb not null default '{}',
  archived_at timestamptz,       -- decommissioned; history kept
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  check (available_till is null or available_from is null or available_till > available_from),
  check (kind = 'temporary' or available_till is null),
  foreign key (org_id, variant_id) references product_variants(org_id, id) on delete restrict,
  foreign key (org_id, location_id) references locations(org_id, id) on delete restrict
);
create unique index stock_items_identifier on stock_items (org_id, identifier) where archived_at is null;
create index on stock_items (org_id, variant_id) where archived_at is null;
create index on stock_items (org_id, location_id);

-- quantities of bulk products; one row per stock adjustment that adds capacity
create table stock_batches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  variant_id uuid not null,
  location_id uuid,
  quantity int not null check (quantity > 0),
  kind text not null default 'regular' check (kind in ('regular','temporary')),
  available_from timestamptz,
  available_till timestamptz,
  purchase_cost_cents bigint check (purchase_cost_cents >= 0),
  purchased_on date,
  archived_at timestamptz,       -- removed stock
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (available_till is null or available_from is null or available_till > available_from),
  check (kind = 'temporary' or available_till is null),
  foreign key (org_id, variant_id) references product_variants(org_id, id) on delete restrict,
  foreign key (org_id, location_id) references locations(org_id, id) on delete restrict
);
create index on stock_batches (org_id, variant_id) where archived_at is null;
create index on stock_batches (org_id, location_id);

create table bundles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  slug citext not null,
  description text,
  taxable boolean not null default true,
  tax_profile_id uuid,
  discountable boolean not null default true,
  show_in_store boolean not null default true,
  sorting_weight int not null default 0,
  tags text[] not null default '{}',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  foreign key (org_id, tax_profile_id) references tax_profiles(org_id, id) on delete set null (tax_profile_id)
);
create unique index bundles_slug on bundles (org_id, slug) where archived_at is null;

create table bundle_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  bundle_id uuid not null,
  product_id uuid not null,
  variant_id uuid,               -- null = customer picks any variation
  quantity int not null default 1 check (quantity > 0),
  discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  foreign key (org_id, bundle_id) references bundles(org_id, id) on delete cascade,
  foreign key (org_id, product_id) references products(org_id, id) on delete restrict,
  foreign key (org_id, variant_id) references product_variants(org_id, id) on delete restrict
);
create index on bundle_items (org_id, bundle_id);
create index on bundle_items (org_id, product_id);

create table collections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  parent_id uuid,
  name text not null,
  slug citext not null,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, slug),
  foreign key (org_id, parent_id) references collections(org_id, id) on delete cascade
);

create table collection_items (
  org_id uuid not null references orgs(id) on delete cascade,
  collection_id uuid not null,
  product_id uuid,
  bundle_id uuid,
  position int not null default 0,
  check ((product_id is null) <> (bundle_id is null)),
  foreign key (org_id, collection_id) references collections(org_id, id) on delete cascade,
  foreign key (org_id, product_id) references products(org_id, id) on delete cascade,
  foreign key (org_id, bundle_id) references bundles(org_id, id) on delete cascade,
  unique nulls not distinct (collection_id, product_id, bundle_id)
);
create index on collection_items (org_id, product_id);
create index on collection_items (org_id, bundle_id);

create table custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  applies_to text not null check (applies_to in ('order','product','customer','stock_item')),
  key text not null check (key ~ '^[a-z][a-z0-9_]{0,62}$'),
  label text not null,
  field_type text not null
    check (field_type in ('text','multiline','number','date','select','checkbox','phone','address')),
  options text[] not null default '{}',
  required boolean not null default false,
  show_in_checkout boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, applies_to, key)
);

-- ---------------------------------------------------------------------------
-- customers

create table customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  number bigint not null,
  name text not null,
  email citext,
  phone text,
  legal_type text not null default 'person' check (legal_type in ('person','company')),
  discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  deposit_type text check (deposit_type in ('none','percent_of_order','percent_of_product_value','fixed')),
  deposit_value numeric(12,2),
  tax_profile_id uuid,
  marketing_consent boolean not null default false,
  stripe_customer_id text,           -- on the org's connected account
  auth_user_id uuid references users(id) on delete set null,  -- storefront customer account
  merge_suggestion_id uuid,
  tags text[] not null default '{}',
  custom_fields jsonb not null default '{}',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, number),
  foreign key (org_id, tax_profile_id) references tax_profiles(org_id, id) on delete set null (tax_profile_id),
  foreign key (org_id, merge_suggestion_id) references customers(org_id, id) on delete set null (merge_suggestion_id)
);
create index on customers (org_id, email);
create index on customers (org_id, created_at);
create index customers_tags on customers using gin (tags);
create index customers_search on customers using gin (to_tsvector('simple', name || ' ' || coalesce(email::text,'')));

create table customer_addresses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  customer_id uuid not null,
  label text,
  line1 text not null,
  line2 text,
  city text,
  region text,
  postcode text,
  country char(2) not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  foreign key (org_id, customer_id) references customers(org_id, id) on delete cascade
);
create index on customer_addresses (org_id, customer_id);

-- ---------------------------------------------------------------------------
-- coupons

create table coupons (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  code citext not null,
  kind text not null check (kind in ('percent','fixed')),
  value bigint not null check (value > 0),        -- percent x100 or cents
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions int check (max_redemptions > 0),
  min_order_cents bigint check (min_order_cents >= 0),
  one_per_customer boolean not null default false,
  stackable_with_customer_discount boolean not null default true,
  eligible text not null default 'all' check (eligible in ('all','collections','items')),
  eligible_ids uuid[] not null default '{}',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  check (kind <> 'percent' or value <= 10000)
);
create unique index coupons_code on coupons (org_id, code) where archived_at is null;

-- ---------------------------------------------------------------------------
-- orders

create table orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  number bigint,                          -- assigned on first save
  status text not null default 'new'
    check (status in ('new','draft','reserved','started','stopped','archived','canceled')),
  -- partial pickups and returns leave items in different states: 'mixed'
  fulfillment_state text not null default 'none'
    check (fulfillment_state in ('none','partially_started','started','partially_stopped','stopped')),
  source text not null default 'back_office' check (source in ('back_office','store','api')),
  created_by uuid references users(id) on delete set null,
  customer_id uuid,
  starts_at timestamptz,
  stops_at timestamptz,
  fulfillment_type text not null default 'pickup' check (fulfillment_type in ('pickup','delivery')),
  start_location_id uuid,
  stop_location_id uuid,
  delivery_address jsonb,
  billing_address jsonb,
  override_period_rules boolean not null default false,
  -- money (all cents, currency frozen at creation)
  currency char(3) not null,
  discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  coupon_id uuid,
  deposit_type text not null default 'none'
    check (deposit_type in ('none','percent_of_order','percent_of_product_value','fixed')),
  deposit_value numeric(12,2) not null default 0,
  subtotal_cents bigint not null default 0,
  discount_cents bigint not null default 0,
  tax_cents bigint not null default 0,
  total_cents bigint not null default 0,       -- incl. tax, excl. deposit
  deposit_cents bigint not null default 0,
  paid_cents bigint not null default 0,         -- toward total
  deposit_paid_cents bigint not null default 0,
  deposit_held_cents bigint not null default 0, -- authorized, not captured
  deposit_refunded_cents bigint not null default 0,
  deposit_kept_cents bigint not null default 0,
  payment_status text not null default 'payment_due'
    check (payment_status in ('paid','partially_paid','overpaid','payment_due','process_deposit')),
  has_shortage boolean not null default false,
  tags text[] not null default '{}',
  custom_fields jsonb not null default '{}',
  canceled_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  check (stops_at is null or starts_at is null or stops_at > starts_at),
  check (status = 'new' or number is not null),
  check (status in ('new','draft') or (starts_at is not null and stops_at is not null)),
  foreign key (org_id, customer_id) references customers(org_id, id) on delete restrict,
  foreign key (org_id, start_location_id) references locations(org_id, id) on delete restrict,
  foreign key (org_id, stop_location_id) references locations(org_id, id) on delete restrict,
  foreign key (org_id, coupon_id) references coupons(org_id, id) on delete restrict
);
create unique index orders_number on orders (org_id, number) where number is not null;
create index on orders (org_id, status, starts_at);
create index on orders (org_id, status, stops_at);
create index on orders (org_id, customer_id);
create index on orders (org_id, coupon_id);
create index on orders (org_id, payment_status);
create index on orders (org_id, created_at);
create index orders_shortage on orders (org_id) where has_shortage;
create index orders_tags on orders using gin (tags);

create table coupon_redemptions (
  org_id uuid not null references orgs(id) on delete cascade,
  coupon_id uuid not null,
  order_id uuid not null,
  customer_id uuid,
  created_at timestamptz not null default now(),
  primary key (coupon_id, order_id),
  foreign key (org_id, coupon_id) references coupons(org_id, id) on delete cascade,
  foreign key (org_id, order_id) references orders(org_id, id) on delete cascade,
  foreign key (org_id, customer_id) references customers(org_id, id) on delete set null (customer_id)
);
create index on coupon_redemptions (org_id, customer_id);

-- what the customer is charged
create table order_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  order_id uuid not null,
  line_type text not null
    check (line_type in ('item','bundle','custom','deposit_kept','delivery','section')),
  parent_line_id uuid,               -- bundle contents point at the bundle line
  product_id uuid,
  variant_id uuid,
  bundle_id uuid,
  bundle_item_id uuid,
  title text not null,
  quantity int not null default 1 check (quantity >= 0),
  price_each_cents bigint not null default 0,      -- negative allowed on custom lines
  manual_price boolean not null default false,     -- true = never recalculated
  charge_label text,                               -- "3 days"
  charge_seconds bigint,                           -- charged length, may differ from the period
  price_breakdown jsonb,                           -- tiles and rules applied
  discountable boolean not null default true,
  taxable boolean not null default true,
  tax_profile_id uuid,
  tax_cents bigint not null default 0,
  total_cents bigint not null default 0,
  reason text,                                     -- deposit_kept
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  foreign key (org_id, order_id) references orders(org_id, id) on delete cascade,
  foreign key (org_id, parent_line_id) references order_lines(org_id, id) on delete cascade,
  foreign key (org_id, product_id) references products(org_id, id) on delete restrict,
  foreign key (org_id, variant_id) references product_variants(org_id, id) on delete restrict,
  foreign key (org_id, bundle_id) references bundles(org_id, id) on delete restrict,
  foreign key (org_id, bundle_item_id) references bundle_items(org_id, id) on delete set null (bundle_item_id),
  check (line_type not in ('item') or variant_id is not null),
  check (line_type <> 'bundle' or bundle_id is not null),
  check (line_type = 'custom' or price_each_cents >= 0)
);
create index on order_lines (org_id, order_id, position);
create index on order_lines (org_id, parent_line_id);
create index on order_lines (org_id, product_id);
create index on order_lines (org_id, variant_id);
create index on order_lines (org_id, bundle_id);

-- ---------------------------------------------------------------------------
-- availability: every hold on stock is a planning

create table downtimes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  variant_id uuid not null,
  stock_item_id uuid,                 -- tracked: one unit
  quantity int not null default 1 check (quantity > 0),  -- bulk
  location_id uuid,
  reason text not null check (reason in ('maintenance','repair','missing')),
  status text not null default 'scheduled' check (status in ('scheduled','started','ended','canceled')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  check (ends_at > starts_at),
  check (stock_item_id is null or quantity = 1),
  foreign key (org_id, variant_id) references product_variants(org_id, id) on delete restrict,
  foreign key (org_id, stock_item_id) references stock_items(org_id, id) on delete restrict,
  foreign key (org_id, location_id) references locations(org_id, id) on delete restrict
);
create index on downtimes (org_id, status, starts_at);
create index on downtimes (org_id, variant_id);
create index on downtimes (org_id, stock_item_id);

create table plannings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  kind text not null check (kind in ('order','downtime')),
  order_id uuid,
  order_line_id uuid,
  downtime_id uuid,
  parent_planning_id uuid,           -- bundle contents
  variant_id uuid not null,
  location_id uuid,
  quantity int not null check (quantity >= 0),
  started_quantity int not null default 0,
  stopped_quantity int not null default 0,
  starts_at timestamptz not null,
  stops_at timestamptz not null,
  -- period widened by the product's buffers at booking time; changing a
  -- product's buffer later does not move existing plannings
  reserved_from timestamptz not null,
  reserved_till timestamptz not null,
  reserved_range tstzrange generated always as (tstzrange(reserved_from, reserved_till, '[)')) stored,
  -- true while this planning takes stock: order reserved/started, downtime scheduled/started
  holds_stock boolean not null default false,
  shortage_quantity int not null default 0 check (shortage_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  check (stops_at > starts_at),
  check (reserved_from <= starts_at and reserved_till >= stops_at),
  check (started_quantity between 0 and quantity),
  check (stopped_quantity between 0 and started_quantity),
  check ((kind = 'order' and order_id is not null and downtime_id is null)
      or (kind = 'downtime' and downtime_id is not null and order_id is null)),
  foreign key (org_id, order_id) references orders(org_id, id) on delete cascade,
  foreign key (org_id, order_line_id) references order_lines(org_id, id) on delete cascade,
  foreign key (org_id, downtime_id) references downtimes(org_id, id) on delete cascade,
  foreign key (org_id, parent_planning_id) references plannings(org_id, id) on delete cascade,
  foreign key (org_id, variant_id) references product_variants(org_id, id) on delete restrict,
  foreign key (org_id, location_id) references locations(org_id, id) on delete restrict
);
create index on plannings (org_id, order_id);
create index on plannings (org_id, order_line_id);
create index on plannings (org_id, downtime_id);
create index on plannings (org_id, parent_planning_id);
create index on plannings (org_id, location_id);
create index plannings_holding on plannings using gist (variant_id, reserved_range) where holds_stock;
create index plannings_pickups on plannings (org_id, starts_at) where kind = 'order' and holds_stock;
create index plannings_returns on plannings (org_id, stops_at) where kind = 'order' and holds_stock;

-- which exact unit fills a planning (tracked products only)
create table stock_item_plannings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  planning_id uuid not null,
  stock_item_id uuid not null,
  reserved_from timestamptz not null,
  reserved_till timestamptz not null,
  reserved_range tstzrange generated always as (tstzrange(reserved_from, reserved_till, '[)')) stored,
  holds_stock boolean not null default false,
  started boolean not null default false,
  stopped boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reserved_till > reserved_from),
  check (not stopped or started),
  foreign key (org_id, planning_id) references plannings(org_id, id) on delete cascade,
  foreign key (org_id, stock_item_id) references stock_items(org_id, id) on delete restrict,
  unique (planning_id, stock_item_id),
  -- THE hard rule: one unit can never be held twice over overlapping time
  constraint stock_item_no_double_booking
    exclude using gist (stock_item_id with =, reserved_range with &&)
    where (holds_stock and not stopped)
);
create index on stock_item_plannings (org_id, stock_item_id);

-- Free units of a variant over [p_from, p_till): capacity minus holds, at the
-- tightest moment. Capacity counts regular stock plus expected / temporary
-- stock whose window covers the moment. Shortage limits are added by the
-- caller. p_exclude_order lets an order re-check its own new dates.
create function variant_free_quantity(
  p_variant uuid,
  p_location uuid,
  p_from timestamptz,
  p_till timestamptz,
  p_exclude_order uuid default null
) returns int
language sql stable as $$
  with stock as (
    select coalesce(s.available_from, '-infinity') as f,
           coalesce(s.available_till, 'infinity') as t,
           1 as qty
    from stock_items s
    where s.variant_id = p_variant and s.archived_at is null
      and (p_location is null or s.location_id = p_location)
    union all
    select coalesce(b.available_from, '-infinity'),
           coalesce(b.available_till, 'infinity'),
           b.quantity
    from stock_batches b
    where b.variant_id = p_variant and b.archived_at is null
      and (p_location is null or b.location_id = p_location)
  ),
  busy as (
    select p.reserved_from as f, p.reserved_till as t,
           p.quantity - p.stopped_quantity as qty
    from plannings p
    where p.variant_id = p_variant and p.holds_stock
      and (p_location is null or p.location_id = p_location)
      and p.reserved_range && tstzrange(p_from, p_till, '[)')
      and (p_exclude_order is null or p.order_id is distinct from p_exclude_order)
  ),
  points as (
    select p_from as t
    union select f from stock where f > p_from and f < p_till
    union select t from stock where t > p_from and t < p_till
    union select f from busy where f > p_from and f < p_till
    union select t from busy where t > p_from and t < p_till
  )
  select coalesce(min(
           (select coalesce(sum(s.qty), 0) from stock s where s.f <= pt.t and s.t > pt.t)
         - (select coalesce(sum(b.qty), 0) from busy b where b.f <= pt.t and b.t > pt.t)
         ), 0)::int
  from points pt
$$;

-- ---------------------------------------------------------------------------
-- payments

create table payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  order_id uuid,
  customer_id uuid,
  kind text not null check (kind in ('charge','authorization','manual','refund')),
  method text not null
    check (method in ('card','payment_link','checkout','cash','bank','cheque','other','pay_later')),
  status text not null default 'pending'
    check (status in ('pending','requires_action','succeeded','failed','canceled','expired','captured','partially_captured')),
  currency char(3) not null,
  amount_cents bigint not null default 0 check (amount_cents >= 0),     -- toward the order total
  deposit_cents bigint not null default 0 check (deposit_cents >= 0),
  captured_cents bigint not null default 0 check (captured_cents >= 0), -- authorizations
  refund_of_payment_id uuid,
  stripe_payment_intent_id text unique,
  stripe_refund_id text unique,
  capture_before timestamptz,
  note text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  check (kind <> 'refund' or refund_of_payment_id is not null),
  foreign key (org_id, order_id) references orders(org_id, id) on delete restrict,
  foreign key (org_id, customer_id) references customers(org_id, id) on delete set null (customer_id),
  foreign key (org_id, refund_of_payment_id) references payments(org_id, id) on delete restrict
);
create index on payments (org_id, order_id);
create index on payments (org_id, customer_id);
create index on payments (org_id, refund_of_payment_id);
create index payments_holds_expiring on payments (capture_before) where kind = 'authorization' and status = 'succeeded';

create table payment_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  order_id uuid not null,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  deposit_cents bigint not null default 0 check (deposit_cents >= 0),
  authorize_only boolean not null default false,
  status text not null default 'open' check (status in ('open','paid','canceled')),
  payment_id uuid,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount_cents + deposit_cents > 0),
  foreign key (org_id, order_id) references orders(org_id, id) on delete cascade,
  foreign key (org_id, payment_id) references payments(org_id, id) on delete set null (payment_id)
);
create index on payment_requests (org_id, order_id);

-- Stripe webhook events already handled (both our billing and connected accounts)
create table stripe_events (
  id text primary key,               -- evt_...
  account text,                      -- connected account, null for platform
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

-- ---------------------------------------------------------------------------
-- storefront carts

create table carts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  customer_id uuid,
  starts_at timestamptz,
  stops_at timestamptz,
  fulfillment_type text not null default 'pickup' check (fulfillment_type in ('pickup','delivery')),
  location_id uuid,
  delivery_address jsonb,
  coupon_id uuid,
  order_id uuid,                     -- set once checked out
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  check (stops_at is null or starts_at is null or stops_at > starts_at),
  foreign key (org_id, customer_id) references customers(org_id, id) on delete set null (customer_id),
  foreign key (org_id, location_id) references locations(org_id, id) on delete set null (location_id),
  foreign key (org_id, coupon_id) references coupons(org_id, id) on delete set null (coupon_id),
  foreign key (org_id, order_id) references orders(org_id, id) on delete set null (order_id)
);
create index on carts (expires_at) where order_id is null;
create index on carts (org_id, order_id);

create table cart_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  cart_id uuid not null,
  variant_id uuid,
  bundle_id uuid,
  bundle_choices jsonb not null default '{}',   -- bundle_item_id -> variant_id
  quantity int not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((variant_id is null) <> (bundle_id is null)),
  foreign key (org_id, cart_id) references carts(org_id, id) on delete cascade,
  foreign key (org_id, variant_id) references product_variants(org_id, id) on delete cascade,
  foreign key (org_id, bundle_id) references bundles(org_id, id) on delete cascade
);
create index on cart_lines (org_id, cart_id);

-- ---------------------------------------------------------------------------
-- email, notes, activity, background work

create table email_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  system_key text check (system_key in ('store_confirmation','customer_account','payment_action_required','payment_request')),
  name text not null,
  context text not null default 'order' check (context in ('order','customer','all')),
  subject text not null,
  body_markdown text not null,       -- {{order.number}} style variables
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id)
);
create unique index email_templates_system on email_templates (org_id, system_key) where system_key is not null;

create table email_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  order_id uuid,
  customer_id uuid,
  template_id uuid,
  to_address citext not null,
  subject text not null,
  provider_message_id text unique,
  status text not null default 'queued' check (status in ('queued','sent','delivered','bounced','failed')),
  sent_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (org_id, order_id) references orders(org_id, id) on delete set null (order_id),
  foreign key (org_id, customer_id) references customers(org_id, id) on delete set null (customer_id),
  foreign key (org_id, template_id) references email_templates(org_id, id) on delete set null (template_id)
);
create index on email_messages (org_id, order_id);
create index on email_messages (org_id, customer_id);
create index on email_messages (org_id, template_id);

create table notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  subject_type text not null check (subject_type in ('order','product','customer','day')),
  subject_id uuid,                   -- null for day notes
  day date,                          -- dashboard notes
  body text not null,
  author_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((subject_type = 'day') = (day is not null and subject_id is null))
);
create index on notes (org_id, subject_type, subject_id);
create index on notes (org_id, day) where day is not null;

create table activity_events (
  id bigint generated always as identity primary key,
  org_id uuid not null references orgs(id) on delete cascade,
  actor_id uuid references users(id) on delete set null,
  subject_type text not null,
  subject_id uuid not null,
  action text not null,              -- 'order.reserved', 'stock_item.created'...
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on activity_events (org_id, subject_type, subject_id, created_at);
create index on activity_events (org_id, created_at);

create table background_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  kind text not null,                -- 'export.orders', 'bulk.edit_products'...
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed')),
  params jsonb not null default '{}',
  result jsonb,
  file_key text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on background_tasks (org_id, created_at);

-- ---------------------------------------------------------------------------
-- updated_at triggers

do $$
declare t text;
begin
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables tb using (table_schema, table_name)
    where c.table_schema = 'public' and c.column_name = 'updated_at' and tb.table_type = 'BASE TABLE'
  loop
    execute format('create trigger %I before update on %I for each row execute function set_updated_at()',
                   t || '_updated_at', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- row level security
--
-- The app connects as `app_user` (no BYPASSRLS). Every request opens a
-- transaction and runs `select set_config('app.org_id', $org, true)` first.
-- Back office: $org comes from the signed-in member's active org.
-- Storefront: $org comes from the request host (slug or custom domain).
-- Webhooks and jobs: $org comes from the event (connected account id, task row).

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user nologin;
  end if;
end $$;

grant usage on schema public to app_user;
grant select, insert, update, delete on all tables in schema public to app_user;
grant usage on all sequences in schema public to app_user;
grant execute on all functions in schema public to app_user;

do $$
declare t text;
begin
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables tb using (table_schema, table_name)
    where c.table_schema = 'public' and c.column_name = 'org_id' and tb.table_type = 'BASE TABLE'
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy tenant_isolation on %I using (org_id = current_org_id()) with check (org_id = current_org_id())', t);
  end loop;
end $$;

-- orgs: a request sees only its own org row
alter table orgs enable row level security;
alter table orgs force row level security;
create policy tenant_isolation on orgs using (id = current_org_id()) with check (id = current_org_id());

-- Tables without org_id (users, stripe_events) are reached only through
-- server code with explicit checks; the auth library owns users.
