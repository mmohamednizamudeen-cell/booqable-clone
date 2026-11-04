# Lovable build prompts: rental platform

How to use this file

1. Paste **Prompt 0 (master brief)** first, on its own. Wait until Lovable finishes.
2. Then paste Prompts 1 to 12 **one at a time, in order**. After each one, click
   through what it built and fix anything off before moving on (paste the
   "Acceptance checks" list back to Lovable if something is missing).
3. Connect Supabase when Lovable asks (Prompt 1). Connect Stripe only at Prompt 9.
4. Never paste two prompts in one message. Lovable builds far better one area at a time.
5. Replace `RentDesk` with your own product name everywhere before pasting.

Everything below describes behaviour and design written fresh for this product.
Do not ask Lovable to copy any existing product's name, logo, text or look.

---

## PROMPT 0: MASTER BRIEF (paste first)

```
You are building "RentDesk", a multi-tenant SaaS for rental businesses (event and party rentals, camera and AV, tools, bikes, boats, trailers). Each rental business is an "organization" with:
1. a BACK OFFICE web app for staff (inventory, bookings, customers, calendar, settings), and
2. a public ONLINE STORE where their customers pick dates, see live availability, add items to a cart, check out and pay.

The core promise: availability you can trust for any date range. The system must never double-book an item.

TECH (use exactly this):
- React + Vite + TypeScript, Tailwind CSS, shadcn/ui (Radix based), lucide-react icons, react-router.
- Supabase: Postgres, Auth, Row Level Security, Storage (product photos), Edge Functions (Stripe, emails, scheduled jobs).
- Stripe Connect (each rental business connects its OWN Stripe account; we never hold their money) for rental payments. Stripe Billing for our own subscription plans (later prompt).
- TanStack Query for data fetching, react-hook-form + zod for forms, date-fns + date-fns-tz for dates.

NON-NEGOTIABLE RULES (apply to every prompt that follows):
- Money is always integer cents (bigint) plus a currency code. Never floats for money.
- Times are stored as timestamptz (real UTC). Each organization has an IANA time zone; convert only when displaying or reading form inputs.
- Every business table has organization_id; Row Level Security on every table so a user only ever sees their own organization's rows.
- Availability is computed from bookings, never stored as a counter.
- All writes that hold stock (reserve, checkout, change dates, add items) go through Postgres functions (RPC) that lock and re-check availability inside one transaction.
- Every screen has: loading state (skeletons), empty state (icon, title, one sentence, action), error state (message + Try again), and works at 390px phone width and 1440px desktop. No horizontal scrolling on phones.
- Accessibility: real buttons and links, every input has a visible label, visible focus ring, dialogs trap focus and close on Escape, colour is never the only signal (status pills always have text).
- All copy is written fresh, in plain sentence case. Buttons are verbs ("Reserve", "Hand out", "Take back", "Record payment").

DESIGN SYSTEM (set this up now as CSS variables + Tailwind theme, and use only these tokens, never raw hex in components):
Colours:
  bg #eef1f4 (page canvas behind cards)
  surface #ffffff (cards, sidebar, header)
  surface-muted #f7f8fa (hover rows, read-only fields)
  border #d9dde1 (card borders, dividers)
  border-input #78818a (input and checkbox borders, must stay 3:1 on white)
  text #16181b (headings), text-body #3e4a52 (body, nav), text-muted #5a666e (hints, counts)
  accent #2f3b48 (primary buttons, links, selected nav, active tab underline), accent-hover #1f2832, accent-subtle #e3e8ee (selected nav background, selected rows), on-accent #ffffff
  danger #c42b1c, danger-subtle #fde8e6
  success #1d7a45 (success text), success-pill #7ddc95
  warning #8a5300 (warning text), warning-pill #f7c35c
  neutral-pill #d9dde1, on-pill #16181b (text on all pills)
  tooltip #26292c with white text
Type: Inter. Scale: xs 12/16 (500), sm 14/20 (400, body default), base 16/24 (500), lg 18/24 (600, card titles), xl 22/28 (600, section headings), display 28/34 (500, page titles and big numbers).
Spacing on a 4px grid. Radius: sm 4, md 6 (buttons, inputs, cards), lg 10 (dialogs), pill 999. Cards have a 1px border, no shadow. Popovers shadow "0 8px 24px rgba(22,24,27,.14)". Dialog shadow "0 24px 48px rgba(22,24,27,.20)".
Layout: left sidebar 200px (collapsible to 64px icons only; below 1024px it becomes a slide-in drawer opened from a menu button in the header). Page header 60px tall, white, bottom border: menu button (mobile), page title or breadcrumb ("Inventory > Folding chair", last part bold), centred search (hidden below 768px), actions on the right. Content max width 1200px, 24px padding (16px on phones), 32px between cards. Right-hand detail panels 220px. List filter panels 220px.
Controls 40px tall (32px small). Status pills 24px (20px small), text xs.

COMPONENTS to build once in src/components/ui and reuse everywhere:
Button (primary, secondary [white with border], ghost, danger, link; sizes sm/md/icon; loading state shows a spinner and keeps the label; disabled 50% opacity), SplitButton (main action + chevron menu), StatusPill (tones success, warning, neutral, accent, danger), StockDot (coloured dot + label: available, out, arriving, in maintenance, short), Avatar (initials on a calm colour picked from the name), Input, SearchInput (icon inside), Textarea, Select (native), MoneyInput (currency code inside left, digits right aligned, stores cents), Field (label + control + hint or error, wires aria-describedby), Checkbox, Switch, RadioGroup with hint lines, CheckboxRow (label + count in brackets for filter panels), Card (header with title, optional description and actions; body; footer with right-aligned buttons), MetricCard (label + big number + optional info tooltip), EmptyState, Tabs (underline style: active tab ink colour with 2px accent underline), DataTable (select-all checkbox, sortable headers with aria-sort, row checkboxes, selected rows tinted accent-subtle, skeleton rows while loading, empty state inside the card, horizontal scroll inside the card on phones, column picker menu), FilterPanel + FilterGroup (collapsible sections with chevron, Import/Export buttons pinned at the bottom), BulkBar ("Actions" menu disabled until rows are selected, "n selected", "Select all N" link), Dialog (sizes 420/560/720; title, description, scrolling body, footer), Popover, DropdownMenu (destructive items in danger colour), Tooltip, Toast (bottom right, success auto-hides after 5s, errors stay), AsideSection (collapsible section with grip icon, title, optional pill, chevron), LinkList (rows with icon, label, hint, chevron), SettingsSection (two columns on desktop: left third heading + explanation + "Read the guide" link; right two thirds a card of controls with its own Save button in the card footer, disabled until something changed).

APP SHELL now:
- Sidebar top: organization name + collapse button. Under it a setup progress row: small ring chart + "Finish setting up" + "3 of 11 steps done" (links to /setup). Then a "+ New booking" row in accent colour. Then nav groups separated by dividers:
  Group 1: Today (/dashboard), Calendar (/calendar)
  Group 2: Bookings (/bookings), Customers (/customers), Inventory (/inventory), Coupons (/coupons), Documents (/documents)
  Group 3: Online store (/settings/store), Reports (/reports), Settings (/settings)
  Bottom: avatar + user name, opens a menu (Profile, Switch organization, Sign out).
  Active item: accent-subtle background, accent text, aria-current="page".
- Optional full-width notice strip above everything (used later for "Your trial ends in N days" with a "See plans" button).
- Create every route now with a placeholder card ("Coming in a later step") so navigation works: /dashboard, /calendar, /bookings, /bookings/new, /bookings/:id, /customers, /customers/:id, /inventory, /inventory/new, /inventory/:id, /inventory/bundles, /inventory/bundles/:id, /inventory/collections, /inventory/downtime, /coupons, /documents, /reports, /setup, /settings and its sub pages (general, pricing, taxes, rental-period, payments, custom-fields, locations, emails, documents, labels, security, team, billing, store, store/booking-page, store/preferences, store/checkout, store/pickup-delivery). Public store routes: /s/:orgSlug, /s/:orgSlug/c/:collectionSlug, /s/:orgSlug/p/:productSlug, /s/:orgSlug/cart, /s/:orgSlug/checkout, /s/:orgSlug/order/:token, and /pay/:token. Auth routes: /login, /signup, /forgot-password, /reset-password, /onboarding.
- A /design route that shows every component in every state on one page (this is our design system check).

Do not build features yet beyond the shell, the components and the /design page. I will send the feature prompts one by one.
```

---

## PROMPT 1: DATABASE, AUTH, ORGANIZATIONS, ONBOARDING

```
Connect Supabase. Create the database in one migration with the tables, constraints, indexes and Row Level Security below. Then build sign up, login and onboarding.

GENERAL: every table has id uuid primary key default gen_random_uuid(), created_at, updated_at (trigger keeps it current). Every business table has organization_id uuid not null references organizations(id) on delete cascade. Enable extensions btree_gist, citext, pgcrypto.

TENANCY AND RLS:
- organizations(id, name, slug citext unique [lowercase letters, digits, hyphens], currency char(3) default 'USD', time_zone text default 'UTC', locale text default 'en', logo_path, plan text default 'trial', trial_ends_at, stripe_account_id, stripe_charges_enabled bool default false, billing_customer_id, billing_subscription_id, billing_status).
- memberships(organization_id, user_id references auth.users, role text check in ('owner','admin','member'), permissions text[] default '{}', unique(organization_id,user_id)).
- Helper SQL function is_member(org uuid) returns boolean (security definer, checks memberships for auth.uid()). Helper has_permission(org uuid, perm text): owners and admins have everything; members need the permission in their permissions array. Permissions used: manage_inventory, manage_settings, manage_payments, cancel_bookings, revert_bookings, view_reports.
- RLS policy on every business table: using (is_member(organization_id)) with check (is_member(organization_id)). Storefront reads go through security definer RPC functions that only return what is published (prompt 7), never through open table policies.
- Child tables reference parents with composite foreign keys (organization_id, parent_id) -> parent(organization_id, id) so a row can never point at another organization's row. Add unique(organization_id, id) on every parent table to allow this.
- organization_settings (1:1 with organizations, primary key organization_id): labels jsonb default '{}' (custom nouns, e.g. {"booking":"Order","customer":"Client"}), pricing_enabled bool true, prices_include_tax bool false, deposit_type text default 'none' check in ('none','percent_of_order','percent_of_product_value','fixed'), deposit_value numeric default 0, period_mode text default 'free' check in ('free','fixed_durations','time_slots'), time_selection bool true, time_increment_minutes int default 30 check in (15,30,60), default_pickup_time time default '09:00', default_return_time time default '17:00', prefill_times text default 'off' check in ('off','back_office','both'), operating_hours_enabled bool false, min_notice_minutes int default 0, rules_apply_to_manual_bookings bool false, store_live bool false, availability_enabled bool true, show_availability_calendar bool true, hide_quantities bool false, show_prices bool true, price_label text default 'charge_period' check in ('charge_period','booking_period','from_price'), brand_color text default '#2f3b48', default_pickup_location_id uuid null, delivery_countries text[] default '{}', checkout_payment text default 'full' check in ('full','down_payment','deposit_only','none'), down_payment_percent numeric default 0, deposit_at_checkout bool true, pay_later_enabled bool false, pay_later_label text, pay_later_terms text, terms_enabled bool false, terms_text text, back_to_website_url text, checkout_form jsonb default '[]', bcc_emails text[] default '{}', require_2fa bool false, new_device_email bool true.
- organization_counters(organization_id, name in ('booking','customer','invoice','quote','contract'), value bigint) used to hand out sequential numbers per organization inside transactions (update ... returning).

AUTH:
- /signup: name, work email, password (min 10 chars, show strength), "Create account". Email verification required (Supabase email confirm). Show "Check your inbox" screen with resend link (rate limited).
- /login: email + password, "Forgot password?" link, magic link option ("Email me a sign-in link"). Errors: wrong password, unverified email (offer resend), too many attempts.
- /forgot-password and /reset-password standard flow.
- Optional 2FA (TOTP) using Supabase MFA: users can enable it in their profile; if organization_settings.require_2fa is true, users without it are forced to set it up after login.
- /onboarding (first login with no membership): step 1 business name, store address slug (auto-filled from the name, live check it is free, shows the future store URL), currency (searchable select), time zone (default from browser), what you rent (industry chips: events, cameras and AV, tools and equipment, bikes, water sports, vehicles and trailers, other). Step 2 "How do you want to start?": empty account, or load sample data (5 products, 3 customers, 3 bookings) so they can explore. Creates organization, settings row, owner membership, default tax profile, one location "Main location", the system email templates, then lands on /dashboard.
- Organization switcher in the user menu if the user belongs to several organizations; the active organization id is kept in local storage and in every query.

LOCATIONS table now: locations(organization_id, name, code (unique per org, uppercase), address jsonb {line1,line2,city,region,postcode,country}, pickup_enabled bool true, archived_at).

Acceptance checks:
- A second test user in another organization sees zero rows from the first organization in every table (write a SQL test script that proves it).
- Sign up, verify, onboard, land on /dashboard with the sidebar showing the new organization name.
- Slug collisions are rejected with a clear message and a suggestion.
```

---

## PROMPT 2: INVENTORY (PRODUCTS, VARIATIONS, STOCK)

```
Build the inventory: products, variations, tracked units and bulk stock, photos, collections, tags and custom fields.

TABLES:
- products(organization_id, name (1-200 chars), slug citext (unique per org among non-archived), sku, description (shown in store), document_description (shown on documents), product_type text check in ('rental','service','sales_item'), tracking text check in ('individual','bulk','none'), has_variations bool default false, variation_fields text[] default '{}', price_type text check in ('flat','fixed','structure','none'), price_period text check in ('minute','hour','day','week','month'), price_structure_id uuid null, price_ruleset_id uuid null, taxable bool true, tax_profile_id uuid null, discountable bool true, deposit_value_cents bigint default 0 (replacement value used for deposits), default_purchase_cost_cents bigint null, buffer_before_minutes int default 0, buffer_after_minutes int default 0, allow_shortage bool false, shortage_limit int default 0, show_in_store bool true, sorting_weight int default 0, seo_title, seo_description, tags text[] default '{}', custom_fields jsonb default '{}', archived_at).
  Constraints: rental products must have tracking individual or bulk; services and sales items must have tracking none; sales items only fixed or none pricing; flat pricing requires price_period. A trigger blocks changing product_type or tracking after creation, and blocks turning variations off once on.
- product_variants(organization_id, product_id, option_values jsonb (e.g. {"colour":"red","size":"M"}), base_price_cents bigint default 0, sku, position, archived_at). EVERY product has at least one variant; products without variations have exactly one default variant created automatically. Stock, prices and bookings always point at a variant.
- product_photos(organization_id, product_id, storage_path, position 0-2) max 3 per product, Supabase Storage bucket "product-photos", images only, max 10 MB, resized client side to 1600px.
- stock_units (tracked items): organization_id, variant_id, location_id, identifier text (unique per org among non-archived, e.g. "CAM-01"), kind text check in ('regular','temporary'), available_from timestamptz null (set = arriving later), available_till timestamptz null (only for temporary), purchase_cost_cents, purchased_on date, custom_fields jsonb, archived_at (decommissioned; history kept).
- stock_batches (bulk quantities): organization_id, variant_id, location_id, quantity int > 0, kind, available_from, available_till, purchase_cost_cents, purchased_on, archived_at.
- collections(organization_id, parent_id null, name, slug, position) and collection_items(collection_id, product_id or bundle_id, position).
- custom_field_definitions(organization_id, applies_to in ('booking','product','customer','stock_unit'), key, label, field_type in ('text','multiline','number','date','select','checkbox','phone','address'), options text[], required bool, show_in_checkout bool, position).

SCREENS:
1. /inventory (list page): header "Inventory", search (name or SKU), primary split button "Add product" with menu (Add bundle, Import from a file). Tabs: Products | Bundles | Collections | Downtime. Left filter panel: Product type (Rental / Service / For sale with counts), Pricing method, Tags, Shown in store (yes/no); Import and Export buttons at the bottom. Table columns: checkbox, photo thumbnail + name (link, truncates with full name on hover), Type ("Rental, each unit" / "Rental, by quantity" / "Service" / "For sale"), Price ("$45.00 / day", "$75.00 fixed", "Free", "From $20.00" for structures), Stock (regular units or quantity), Online (pill Shown/Hidden, clickable toggle), SKU (monospace), Tags; column picker. Bulk actions: Show in store, Hide from store, Apply pricing structure, Apply price ruleset, Set tax profile, Add tag, Archive. Footer "12 of 40 products". Empty states: no products yet (button "Add your first product"), no matches (clear filters).
2. /inventory/new (form in cards):
   Card "What is it?": Name; Kind of product select (Rental: goes out and comes back / Service: an extra like delivery or setup / For sale: sold, not returned); if Rental, a required radio "How do you keep track of it? You cannot change this later": "Each unit has its own ID" (cameras, vehicles, anything with a serial number) or "By quantity" (chairs, cutlery, cables); Description.
   Card "Price": How you charge (Per period of time / One price per booking / Free / Tiered structure); Period (hour/day/week/month, hint "Partial periods are charged as a full one"); Price; Replacement value (for deposits).
   Card "Stock": tracked: Unit IDs textarea (one per line or comma separated, hint "Short and easy to read, like CAM-01"); bulk: Quantity.
   Card with switch "Offer it in the online store", footer Cancel / Save product.
3. /inventory/:id product page with tabs:
   - Stock tab: three metric cards (In stock, Out right now, Arriving or temporary). Tracked: list of units with identifier (monospace), state dot + word (In stock, With a customer + link to the booking, Overdue back, Arriving later, Temporary ended, In maintenance), Temporary pill, row menu (Edit, Schedule maintenance, Remove). Bulk: totals (total, out, in maintenance) and a list of stock additions. "Add stock" dialog: radio Regular / Arriving later (needs arrival date) / Temporary (sub-rented; needs end date, optional start); identifiers or quantity; location; optional purchase cost and date. Temporary unit identifiers get a "TMP-" prefix automatically. Removing a unit that is on a current or future booking is refused: "This unit is on a current or upcoming booking. Swap it out first."
   - Pricing tab: charge toggle, method, period, price per variation, structure picker (prompt 5), ruleset picker, taxable + tax profile, discountable, replacement value, default purchase cost.
   - Variations tab: "Enable variations" (warning: cannot be undone), add properties (e.g. Colour, Size), table of variations with values, price, SKU, stock per variation; cannot delete a variation used by stock, bookings or bundles.
   - Settings tab: name, SKU (auto from name, editable), description, document description, photos (drag to reorder, max 3), Prep time before each booking (hours), Turnaround after each booking (hours) with hint "Cleaning, charging, checks. Changing this does not move existing bookings.", Allow overbooking switch + limit ("Take more bookings than you have, up to a limit, when you can rent in extra"), store visibility, collections, tags, custom fields, SEO title and description, Archive product.
   - History tab: every booking line and stock change for this product (date, booking number, quantity, user).
4. /inventory/collections: list with drag ordering, nested one level, add/edit dialog, assign products.
5. CSV import (background): upload CSV, map columns (name, type, tracking, price, period, quantity or identifiers, sku, description, tags), preview first 10 rows with errors per row, import; result summary. Export products and stock as CSV.

Acceptance checks:
- Creating "Folding chair, by quantity, 80" and "Camera kit, each unit, CAM-01, CAM-02" works and the list shows stock 80 and 2.
- The tracking type cannot be changed after save (UI hides it, DB trigger blocks it).
- A 60-character name truncates in the table and never causes horizontal scroll at 390px.
```

---

## PROMPT 3: AVAILABILITY ENGINE, CALENDAR, DOWNTIME

```
Build the availability engine in Postgres, the maintenance (downtime) feature and the back-office calendar.

CONCEPT: every hold on stock is a "planning" row. Bookings and downtimes both create plannings. Availability for a variant over a period = capacity minus holds, at the tightest moment in that period.

TABLES:
- plannings(organization_id, kind in ('booking','downtime'), booking_id null, booking_line_id null, downtime_id null, parent_planning_id null (bundle contents), variant_id, location_id, quantity int >= 0, started_quantity int default 0, stopped_quantity int default 0, starts_at, stops_at, reserved_from, reserved_till (the period widened by the product's buffers AT BOOKING TIME; changing a product's buffer later never moves existing plannings), reserved_range tstzrange generated always as (tstzrange(reserved_from, reserved_till, '[)')) stored, holds_stock bool default false (true while a booking is reserved or out, or a downtime is scheduled or started), shortage_quantity int default 0).
  Checks: stops_at > starts_at, reserved_from <= starts_at, reserved_till >= stops_at, 0 <= started_quantity <= quantity, 0 <= stopped_quantity <= started_quantity, exactly one of booking_id / downtime_id according to kind.
  Indexes: gist (variant_id, reserved_range) where holds_stock; (organization_id, starts_at) where kind='booking' and holds_stock; same for stops_at.
- unit_plannings(organization_id, planning_id, unit_id, reserved_from, reserved_till, reserved_range generated, holds_stock bool, started bool, stopped bool, unique(planning_id, unit_id)) and THE hard rule as an exclusion constraint:
  exclude using gist (unit_id with =, reserved_range with &&) where (holds_stock and not stopped)
  so one physical unit can never be held twice for overlapping time, even if application code has a bug.
- downtimes(organization_id, variant_id, unit_id null (tracked) or quantity (bulk), location_id, reason in ('maintenance','repair','missing'), status in ('scheduled','started','ended','canceled'), starts_at, ends_at, note, created_by).

SQL FUNCTIONS (security invoker, respect RLS):
1. variant_free_quantity(variant uuid, location uuid null, from timestamptz, till timestamptz, exclude_booking uuid null) returns int:
   stock = regular units/batches (window -infinity..infinity) plus arriving units/batches (from available_from) plus temporary ones (available_from..available_till), excluding archived.
   holds = plannings where holds_stock, same variant (and location if given), overlapping [from, till), excluding exclude_booking, counting quantity - stopped_quantity.
   Evaluate capacity minus holds at every boundary point inside [from, till) (from itself and every start or end of a stock window or hold that falls inside) and return the MINIMUM. Half-open ranges: a hold ending at 10:00 does not block a booking starting at 10:00.
2. availability_breakdown(variant, from, till, booking_id) returns json {free, available, arriving, on_this_booking, on_other_bookings, within_shortage_limit, over_shortage_limit, in_maintenance}.
3. month_availability(variant, year, month, quantity, location) returns per day 'available' | 'partial' | 'unavailable' (partial = free for some hours of that day in the org's time zone but not all of it) for storefront calendars.
4. free_units(variant, from, till, exclude_booking) returns the tracked units not held by any other booking in that range.
5. Shortage rule (used by every reserve): need = quantity on this booking for the variant; free = variant_free_quantity(... exclude this booking); short = need - free. If short > 0 and product.allow_shortage and short <= shortage_limit: return a WARNING the user can confirm. Otherwise if short > 0: BLOCK with a message naming the item and how many are short.
6. Bundles: free bundles = minimum over bundle contents of floor(free(content) / content quantity).

CONCURRENCY (critical): the reserve/checkout/change-dates functions must, inside one transaction, first take pg_advisory_xact_lock(hashtext(variant_id::text)) for every variant involved, in sorted order (prevents deadlocks), then re-check availability, then write plannings with holds_stock = true. The exclusion constraint is the second line of defence for tracked units.

DOWNTIME:
- /inventory/downtime tab: table of all downtimes (product, unit or quantity, reason, from, to, status pill: Scheduled neutral, In progress warning, Ended success, Canceled danger) with actions Start, End, Undo end, Cancel, Edit.
- "Schedule maintenance" dialog from a unit row or a bulk product: reason, start, end, quantity (bulk), "Start now" or "Schedule". If the unit or quantity is on a booking in that period, list the conflicting bookings and block.
- Dashboard shows downtimes starting, ending and overdue.

CALENDAR (/calendar):
- Toolbar: "Check availability" button (pick a date range with presets: today, tomorrow, this weekend, next 7 days, next 30 days), Day / Week / Month toggle, today and prev/next arrows, location filter, search (product name, unit ID, tag), legend.
- Resource timeline: one row per product (expandable to one row per unit for tracked products); time across the top. Booking bars span pickup to return, coloured by status: draft grey, reserved accent, out warning-pill, returned success-pill, maintenance dark grey (tooltip colour). Bars show quantity, customer name and booking number; buffer time is a lighter extension at the bar ends. Unassigned tracked bookings show on the product row but not on a unit row.
- Hover a bar: card with booking number, status, customer, dates and times, pickup or delivery, all items on the booking, link "Open booking".
- With a check-availability range set: the range is highlighted and each product row shows "free / total" for that range, negative numbers in danger colour for shortages.
- Phones: show an agenda list grouped by day instead of the timeline.
- "Subscribe" button gives a private iCal feed URL (token per organization, regenerate link) of pickups and returns.

Acceptance checks (write them as SQL tests):
- 2 cameras, one booked 10:00 day 1 to 10:00 day 2 with 1 hour turnaround: free from 10:30 day 2 = 1, free from 11:00 day 2 = 2.
- 10 regular chairs + 5 temporary chairs on days 10 to 12, 12 held on day 10: free on day 10 = 3; free on day 13 = 10.
- Inserting a second held unit_planning for the same unit overlapping in time fails with the exclusion constraint.
- Two simultaneous checkouts for the last unit: exactly one succeeds.
```

---

## PROMPT 4: BOOKINGS (THE CORE)

```
Build bookings end to end: the booking editor, statuses, hand out (pickup), take back (return), deposits kept, the bookings list and the Today dashboard.

TABLES:
- bookings(organization_id, number bigint null (assigned on first save, unique per org, from organization_counters), token text unique (random 24 bytes hex, for the customer's links), status in ('new','draft','reserved','started','stopped','archived','canceled'), fulfillment_state in ('none','partially_started','started','partially_stopped','stopped'), source in ('back_office','store','api'), created_by, customer_id null, starts_at, stops_at, fulfillment_type in ('pickup','delivery'), start_location_id, stop_location_id, delivery_address jsonb, billing_address jsonb, override_period_rules bool, currency, discount_percent, coupon_id, deposit_type, deposit_value, subtotal_cents, discount_cents, tax_cents, total_cents (incl. tax, excl. deposit), deposit_cents, paid_cents, deposit_paid_cents, deposit_held_cents, deposit_refunded_cents, deposit_kept_cents, deposit_kept_reason, payment_status in ('paid','partially_paid','overpaid','payment_due','process_deposit'), has_shortage bool, tags text[], custom_fields jsonb, notes, canceled_at, archived_at).
  Checks: stops_at > starts_at; status 'new' may have no number, all others must; reserved/started/stopped/archived need dates.
- booking_lines(organization_id, booking_id, line_type in ('item','bundle','custom','deposit_kept','delivery','section'), parent_line_id (bundle contents), product_id, variant_id, bundle_id, title, quantity, price_each_cents (custom lines may be negative), manual_price bool (true = never recalculated), charge_label ("3 days"), charge_minutes, price_breakdown jsonb, discountable, taxable, tax_profile_id, tax_cents, total_cents, reason, position).
- Status words shown to users: new "New", draft "Draft", reserved "Reserved", started "Out" (or "Partly out"), stopped "Returned" (or "Partly back"), archived "Archived", canceled "Canceled". Pill tones: neutral, neutral, accent, warning, success, neutral, danger.

STATE MACHINE (implement as Postgres functions, each one transaction, each one checks has_permission):
- new -> draft: "Save as draft". Assigns the number. Drafts hold NO stock (plannings exist with holds_stock false) so prices and warnings still show.
- new/draft -> reserved: "Reserve". Requires dates and at least one line. Runs the shortage rule with locks (prompt 3). Warning = confirm dialog "Book with a shortage?" listing items and amounts, buttons "Go back" / "Book anyway". Block = toast with the message. On success plannings get holds_stock true.
- reserved -> draft: "Back to draft (release the items)" (needs revert_bookings).
- reserved/started -> started: "Hand out" (pickup). Partial allowed: fulfillment_state partially_started.
- started -> stopped: "Take back" (return). When everything is back, status stopped and holds_stock false.
- stopped -> archived: "Archive". archived -> stopped: "Unarchive".
- any open status -> canceled: "Cancel booking" (needs cancel_bookings; refused while items are out: "Items are still out. Take them back before canceling."). Canceled bookings cannot be restored; offer "Duplicate".
- Changing dates on a reserved or out booking re-runs the shortage rule excluding itself; if blocked, the dates are NOT changed. Once items are out, only the return date can move.
- Adding items or raising quantities on a reserved/out booking re-checks too.
- Changing a product's buffer never changes existing plannings; changing the booking's dates recalculates its plannings with current buffers.
- A unit that is out with another customer and due back before this booking's dates is still bookable (planning), but "Hand out" refuses it until it has come back: "CAM-02 has not come back from another booking yet."

BOOKING EDITOR (/bookings/:id; /bookings/new opens the user's single unsaved "new" booking, reusing it if one exists):
- Header: breadcrumb "Bookings > Booking #123" (or "New booking"), status pill on the right.
- Action row (right aligned): context buttons by status (Save as draft, Reserve, Hand out, Take back, Archive) + "More" menu (Back to draft, Duplicate, Print packing list, Cancel booking / Discard).
- Alerts at top: amber "This booking should have been picked up already" / "This booking is overdue back"; red "Short on stock: Folding chair (2). Add stock or change the booking." with a link to add temporary stock.
- Two cards side by side (stack on phones):
  Customer card: search existing customers by name or email (results with avatar, name, email), "New customer" inline form (name, email, phone); selected state shows avatar, name, email, phone and a remove button; selecting a customer applies their default discount, deposit rule and tax profile.
  Rental period card: Pickup (date + time) and Return (date + time), stacked; respects time increments and, if rules_apply_to_manual_bookings, operating hours (with an "Override" checkbox for permitted users). Pickup or delivery toggle, location select, delivery address form. Button "Set dates" / "Change dates" (primary only when changed). Hint when out: "Items are out, so only the return can move."
- Custom fields card (booking custom fields, empty state with "Set up custom fields" link).
- Items card: "Add items" search (products and bundles; each result shows "3 free" in success colour or "none free" in danger for the booking's dates, and an Add button); barcode scan button (focus the search and accept scanner input). Lines: name (truncates), sub-line "3 days at $45.00 each · CAM-01, CAM-02 · 1 out, 0 back", availability label ("2 left" success / "2 short" danger) that opens the availability breakdown popover (stacked bar + rows: free, arriving, on this booking, on other bookings, short within limit, short over limit, in maintenance; button "Add stock"), quantity input, line total, remove button. For tracked items an "Assign units" button opens a picker of free units (assigning late is recommended; tooltip explains why). Bundle lines show their contents indented with quantities and per-item discounts; "any variation" contents need a choice. "+ Add a one-off charge" (description + amount, negative for a discount). Footer: "2 lines, 41 items" and the totals block: Subtotal, "Give a discount" link (percent), "Apply a coupon code" link, Discounts, Tax (or "incl. tax"), Total (bold, top border), Security deposit with its method under it ("Based on the items' replacement value").
- Right aside (220px, collapsible sections): Payment (pill Paid/Due/Partly paid/Overpaid/Process deposit; Paid, Due, Deposit paid/held/refunded/kept; buttons "Record payment", "Send payment link" (prompt 9)); Documents (prompt 11); Emails (send template, history); Tags; Notes (internal, with author and time); History (activity log: who did what when).

HAND OUT dialog ("Hand out items", description "Choose what leaves now. Anything left over can go out later."): per tracked line a checklist of free units preselected (assigned units first), limited to the remaining quantity; per bulk line a number input defaulting to the remaining quantity; scanning a barcode ticks the unit. Button "Hand out 3 items". Validates everything before changing anything.

TAKE BACK dialog ("Take items back", "Check off what came back. Missing items stay on the booking."): per tracked line checkboxes of units that are out; per bulk line a number defaulting to what is out; "Keep from the deposit" money input (hint shows the deposit) and a required "Why" field when kept > 0. Kept amount becomes a deposit_kept line including tax.

BOOKINGS LIST (/bookings): header search (number exact, customer name, email, tags, custom field values), primary "New booking". Tabs: Coming up (default), Overdue, Short on stock, Drafts, All, Archived. Filter panel: Payment status (with counts), Status, Pickup date range, Source (back office / online), Location, Tags. Metric cards (hideable): Bookings, Items, Revenue, Still to collect (info tooltip explains drafts are left out). Table: #, Customer, Pickup, Return, Status pills (status + Late + Short), Payment pill, Total; bulk actions (Archive, Add tag, Export). Export CSV.

TODAY DASHBOARD (/dashboard): period picker (Today, Tomorrow, Next 7 days, custom range). Two cards: "Going out" (reserved bookings starting in the period plus any overdue pickups) and "Coming back" (bookings out that are due back in the period plus overdue returns). Each row: booking number, customer, items summary ("1 × Camera kit, 40 × Folding chair"), time, Late pill; clicking opens the booking. Card footers: "Show overdue", "Open bookings". "Print pull list" button (fulfillment list of every item going out in the period, grouped by booking, printable). Right panel "Day notes" (add and edit notes for the day). Maintenance starting/ending/overdue section.

Acceptance checks:
- Book the only speaker for days 10-12; a second booking for days 11-13 cannot be reserved (blocked with the item named).
- 80 chairs with overbooking limit 10: booking 85 asks to confirm; booking 10 more after that is blocked.
- Partial hand out of 12 of 20 shows "Partly out"; trying to hand out 9 more says "enter 0 to 8".
- Canceling a reserved booking frees the stock immediately.
- Moving a reserved booking onto dates without stock leaves the original dates untouched.
```

---

## PROMPT 5: PRICING, TAXES, DEPOSITS, COUPONS

```
Build the pricing engine as one shared TypeScript module (used by the back office, the store and edge functions) plus a Postgres mirror for server-side totals, and the settings screens for pricing, taxes, deposits and coupons. Write unit tests (Vitest) for every rule below.

PRICING METHODS (per product, prices per variation):
1. Flat per period: price per minute/hour/day/week/month, ROUNDED UP: $10/day charges $10 for up to 24h, $20 for up to 48h. Days, weeks and months are counted on the organization's local calendar, so a rental across a daylight saving change is not charged an extra day (09:00 to 09:00 local is one day even when it is 23 or 25 real hours).
2. Fixed: one price per booking regardless of duration (sales items only allow fixed or free).
3. Tiered structure: tiles like 1 day = 1.0x, 2 days = 1.5x, 3 days = 2.5x of the base price, then an extra rate per additional hour/day/week/month (e.g. 0.5x per extra day). A rental uses the first tile whose length covers it (rounded up), else the last tile plus extra periods.
   - price_structures(organization_id, name, is_template bool, extra_period, extra_multiplier) and price_tiles(structure_id, label, length_minutes, multiplier). Templates are reusable: each product sets its own base price and picks the template; "one-off" structures belong to a single product.
   - Template editor: example base price field, rows of tiles (quantity + unit + multiplier + resulting price; typing a resulting price fills the multiplier), extra-period row, live preview table for 1 to 14 days.
   - Bulk apply to selected products with option "Use each product's current price as its base".
4. Free (pricing off for this product). Organization-wide "Enable pricing" off hides all prices, quotes and invoices.

PRICE RULESETS (seasonal and weekday rules):
- price_rulesets(name, stacking in ('off','sum','compound')) and price_rules(kind in ('date_range','weekdays','free_pickup_day','free_return_day'), starts_at, ends_at, weekdays smallint[], from_time, till_time, adjustment_percent (e.g. +20, -15), apply_when in ('overlaps','within','spans'), free_if_pickup_after time, min_duration_minutes, max_duration_minutes, position).
- Charge-period rules shorten what is charged: "Do not charge the pickup day" (optionally only if pickup is after a time), "Do not charge the return day", each optionally only when the booking is longer/shorter than a duration.
- Price rules adjust the price by percent for a date range or weekdays; apply when the rule overlaps the booking, fits within it, or spans it. Stacking off = only the strongest rule, sum = add percentages, compound = multiply.
- The line keeps original price, adjusted price and a breakdown of applied rules (shown in a tooltip on the line).

TOTALS (in this order): line totals -> booking discount percent and customer discount on discountable lines -> coupon on eligible lines -> tax per line by (product tax profile, customer tax profile) -> deposit.
- Rounding: per line, half-to-even, to whole cents.
- Inclusive tax: prices already include tax; tax is backed out (price - price / (1 + rate)) and the total does not grow. Exclusive: tax is added.
- Tax: tax_profiles(kind in ('product','customer'), name, is_default) and tax_rates(product_profile_id, customer_profile_id null, name, rate_bps e.g. 2100 = 21%, position). The rate used is the one for the line's product profile and the customer's profile, falling back to rates with no customer profile. Customers can be tax exempt via a customer profile with 0%.
- Deposit methods: None; Percent of order (rental lines only, services and sales items and custom lines excluded); Percent of each product's replacement value; Fixed amount. Per-customer override (e.g. trusted regulars pay none). Per-booking override from the totals block.

COUPONS (/coupons): code (case insensitive, unique), percent or fixed amount, active switch, start and end dates, maximum redemptions, minimum order amount, one per customer, can combine with customer discount, eligible for all items / chosen collections / chosen products. List with uses and discount given; coupon_redemptions table. In the booking and the cart: "Apply a coupon code" field with clear errors (expired, not active yet, minimum not reached, already used, not valid for these items).

SETTINGS SCREENS (use SettingsSection layout):
- /settings/pricing: Enable pricing; currency display (symbol or code, before or after); price label in store (charge period "2 days: $20.00", booking period "3 days: $20.00", from price "From $10.00 / day"); deposit method + value; pricing structure templates list; price rulesets list.
- /settings/taxes: prices include tax or not; product tax profiles; customer tax profiles; rates table per combination; preview example ("Product $100 + 21% = $121" or "incl. $17.36 tax").

Acceptance checks (unit tests):
- 3 days at $45/day = $135 with label "3 days"; 3 days and 1 minute = 4 days.
- 09:00 to 09:00 across the spring and autumn DST change in America/New_York = 1 day.
- Subtotal $150 (a $100 rental + $50 service), 10% discount, 20% exclusive tax, 50% order deposit = discount $15, tax $27, total $162, deposit $50.
- $120 with 20% inclusive tax = tax $20, total $120.
- Structure 1d 1.0x, 2d 1.5x, 3d 2.5x, extra 0.5x/day, base $20: 2 days $30, 3 days $50, 5 days $70.
```

---

## PROMPT 6: CUSTOMERS

```
Build customers.

TABLES: customers(organization_id, number (per org counter), name, email citext, phone, legal_type in ('person','company'), discount_percent, deposit_type null, deposit_value null, tax_profile_id null, marketing_consent bool, stripe_customer_id (on the organization's connected account), auth_user_id null (store login), merge_suggestion_id null, tags, custom_fields, archived_at) and customer_addresses(customer_id, label, line1, line2, city, region, postcode, country char(2), is_default).

/customers list: search (name, email, phone), "New customer". Filter panel: Type (Person / Company with counts), Marketing emails (Subscribed / Not subscribed), Customer since (date range), Latest booking (date range), Tags, Tax profile; Import and Export at the bottom. Table: #, avatar + name, email, phone, bookings count, latest booking date, revenue, balance due; column picker; bulk: add tag, export, archive. Duplicate badge on rows with a merge suggestion.

/customers/:id: header card (avatar, name, type, email, phone, customer since, number), metrics (revenue, bookings, average booking value, balance due), tabs: Bookings (same table as the bookings list), Details (contact, addresses with default, type, tags, custom fields, marketing consent), Defaults (discount percent, deposit rule override, tax profile; hint "Applied automatically to new bookings for this customer"), Notes, History. Actions: New booking for this customer, Merge with... (pick the duplicate, choose which values to keep, moves bookings and payments), Archive. A customer with bookings cannot be deleted, only archived. GDPR: "Export data" (JSON) and "Erase personal data" (anonymises the customer but keeps bookings for tax records; requires typing the name to confirm).

Online bookings create a customer automatically, or attach to an existing one with the same email; if two look like duplicates, set merge_suggestion_id.

Acceptance checks: search finds by partial email; defaults apply when the customer is chosen on a booking; erase removes name, email, phone and addresses but the bookings remain with "Erased customer".
```

---

## PROMPT 7: ONLINE STORE (STOREFRONT)

```
Build the public store at /s/:orgSlug (later also on the organization's custom domain). It must be fast, mobile first and accessible. Use the organization's brand colour for the primary button, selected dates and links (computed text colour for contrast). All storefront data comes from security definer RPC functions that only return published products of a live store.

STORE SETTINGS (/settings/store and sub pages, SettingsSection layout):
- Overview: three channel cards with status pills: Booking page (Live/Offline, its URL, "View store", "Use your own domain"), Embed on your website (copy-paste script, later), Website builder (out of scope, show "Coming later"). Below: a getting-started checklist (rental period rules, availability display, checkout).
- Booking page: Go live / Take offline, logo, brand colour picker with contrast warning, store name, intro text, back-to-website URL.
- Preferences: availability on/off (off = "request mode": customers can add anything and orders arrive as drafts for you to confirm, with wording changed to "Request" everywhere), show availability calendar on product and cart, hide quantities (show available/unavailable only), show prices, price label style, product sort order, cross-sell on/off.
- Rental period (/settings/rental-period): mode Free dates and times / Fixed durations (list like 4 hours, 1 day, 1 week) / Time slots (list like 09:00-12:00, 13:00-17:00); time selection on/off (off = customers pick dates only and default pickup and return times apply); time increments 15/30/60; default pickup and return times + "pre-fill times" (back office only / back office and store); operating hours (per weekday time slots; pickups and returns only inside them; closed days); away mode (date ranges when the whole store takes no bookings); minimum notice (e.g. no same-day bookings: 24 hours); apply these rules to back-office bookings (with an override permission).
- Pickup and delivery: default pickup location (automatic or a location), delivery countries, require delivery address while picking dates (forced on with several locations so availability uses the location nearest the address).

STORE PAGES:
1. Catalogue /s/:orgSlug: header (logo or name, cart button with item count), optional intro, collections as a left sidebar on desktop / horizontal chips on phones, search, product grid (photo, name truncating, short description 2 lines, price label, "Booked out for your dates" badge when a period is chosen). One column on phones, explicit grid columns so long names never widen the page.
2. Product page /s/:orgSlug/p/:productSlug: photo gallery (up to 3, swipeable on phones), name, price label, description, variation selects, quantity stepper, availability calendar, "Add to cart". Cross-sell row ("Often rented with").
3. Period picker (dialog on phones, inline card on desktop), steps depend on settings: Pickup or delivery -> location (if several) -> delivery address (if required) -> dates -> times (if time selection on). Fixed durations: pick a start date and a duration, the end is calculated. Time slots: pick a date then a slot.
   Month calendar (keyboard: arrows move a day/week, Home/End week edges, PageUp/PageDown months, Enter selects; role=grid; each day labelled "Tuesday 12 March, available"):
   available = green tint; partially available = diagonal split green/amber ("part of the day"); closed for pickup and return = struck-through number; booked out = dashed outline, muted, not selectable; selected start/end = brand colour; in range = light brand tint; today = ring. Legend under the calendar. Quantities shown inside days unless hidden. Partially available days open an hour grid showing which times are free.
   The cart keeps ONE rental period for all items; once set, product pages say "Your cart is for Fri 12 Mar 9:00 AM to Sun 14 Mar 5:00 PM. You can change the dates in the cart."
4. Cart /s/:orgSlug/cart: dates card (change dates re-checks everything), lines (photo, name, charge label "2 days, $18.00 each", quantity stepper, line total, remove; red note "Only 1 free for these dates" or "Booked out for these dates"), service extras as toggles at the bottom ("Delivery and setup +$75.00"), coupon field, cross-sell, summary card with totals and refundable deposit, "Continue to checkout" disabled with the reasons listed when anything is unavailable. Empty cart state with "Browse items".
5. Checkout /s/:orgSlug/checkout: personal details (full name, email, phone), then the organization's checkout form items in their order (custom fields, headings, text, text on a background, images), billing address, delivery address if delivery, terms checkbox (required if enabled, terms open in a dialog), payment step (prompt 9), "Book now" (or "Send request" in request mode). Order summary sidebar (dates, lines, total, deposit, payment note). Double clicks create one booking (idempotency key per checkout attempt).
   Checkout RPC (one transaction, with the advisory locks from prompt 3): validate details, re-check every line, create or match the customer, create the booking with lines and plannings, reserve (availability on) or draft (request mode), assign the number, return the booking token. If someone just took the last unit: return a clear error "Sorry, someone just booked Camera kit for these dates. Your cart is unchanged; try other dates or fewer items." and refresh the cart so it shows what is no longer free.
6. Confirmation /s/:orgSlug/order/:token: "You are booked" (or "Request received"), booking number, pickup and return with location or delivery address, items, totals, deposit and what was paid, what to bring, a QR code of the booking number for fast pickup, "Add to calendar" (ICS), link back to the store. Also sends the confirmation email (prompt 10).
7. Customer accounts (optional switch): customers can sign in at checkout with a magic link; logged-in customers get their discounts, tax profile and deposit rules, see past bookings and can re-book.

Acceptance checks:
- Two browsers race for the only unit, same dates, same second: one booking, the other sees the "just booked" message.
- Every store page has no horizontal scroll at 390px with a 60-character product name.
- Store offline shows a friendly "This store is not taking bookings right now" page.
- Keyboard only: choose dates, add to cart, check out.
```

---

## PROMPT 8: BUNDLES, SERVICES, SALES ITEMS, VARIATIONS IN BOOKINGS

```
Finish the product types inside bookings and the store.

BUNDLES (/inventory/bundles): bundles(name, slug, description, photos, taxable, tax_profile_id, discountable, show_in_store, sorting_weight, tags, archived_at) and bundle_items(bundle_id, product_id, variant_id null = "any variation, chosen at booking", quantity, discount_percent, position).
- Editor: Contents tab (search products to add; quantity; discount % or discounted price, the other is calculated, "~" shown for rounded percentages; specific variation or "Any variation"), Pricing tab (taxable, tax profile, can be further discounted by coupons and booking discounts), Store tab (visibility, collections, SEO), Settings (name, photos shown before the contents' photos, delete).
- Price = sum of contents at their own pricing minus per-content discounts. Availability = the scarcest content.
- In bookings: one bundle line with nested content lines; content quantities can be changed (original shown like "3/4"), a content can be removed (greyed, quantity 0) and re-added. Hand out and take back work per content.
- Bulk edit bundles: taxable, tax profile, visibility, discountable.

SERVICES: not tracked, no stock. In the store they appear as toggles at the bottom of the cart, not as product cards. Priced flat per period or fixed.
SALES ITEMS: sold, not returned; fixed price; they leave stock when handed out and never come back (stock decreases permanently; no take back step for them).
VARIATIONS in bookings and store: choosing a product with variations asks for the variation; availability and price are per variation.

Acceptance checks: a "Camera starter kit" bundle (1 camera any colour, 2 batteries at 50% off, 1 tripod) shows the right price, availability limited by the scarcest content, and asks for the camera colour when booked.
```

---

## PROMPT 9: PAYMENTS (STRIPE CONNECT)

```
Add payments with Stripe Connect. Each organization connects its own Stripe account (Standard accounts, direct charges on the connected account). We never hold their money and never see card numbers (Stripe Elements only). All Stripe calls run in Supabase Edge Functions with idempotency keys derived from our payment id.

TABLES: payments(organization_id, booking_id, customer_id, kind in ('charge','authorization','manual','refund'), method in ('card','payment_link','checkout','cash','bank_transfer','cheque','other','pay_later'), status in ('pending','requires_action','succeeded','failed','canceled','expired','captured','partially_captured'), currency, amount_cents (toward the booking total), deposit_cents, captured_cents, refund_of_payment_id, stripe_payment_intent_id unique, stripe_refund_id unique, capture_before timestamptz, note, created_by) ; payment_requests(booking_id, token unique, amount_cents, deposit_cents, authorize_only bool, status in ('open','paid','canceled'), payment_id) ; stripe_events(id text primary key, account, type, received_at, processed_at).

CONNECT: /settings/payments: "Connect Stripe" (Account Link onboarding), status (Not connected / Needs more information / Ready to take payments), link to the Stripe dashboard, payment methods note, "Disconnect". Webhook account.updated keeps stripe_charges_enabled current.

CHECKOUT PAYMENTS (store), from /settings/store/checkout "Payment at checkout": Full amount / Down payment (percent) / Deposit only / No payment at checkout; "Add the security deposit at checkout" switch with an explanation text shown to customers; "Pay later" option with its own label and terms (appears last; confirmation page shows the terms). Payment Element on the checkout page; 3-D Secure / SCA handled by Stripe (requires_action flow). The booking is reserved before payment; if payment never completes within 30 minutes a scheduled job cancels it and releases the stock.

BACK OFFICE PAYMENT DIALOG ("Record payment" in the booking aside): amounts split into "Booking amount" and "Security deposit" (prefilled with what is due); method tabs:
- Card: new card (Payment Element) or a saved card of this customer; "Charge now" or "Authorize only" (a hold, captured later).
- Payment link: creates a payment_request and shows a copyable link + "Email it to the customer"; option to authorize only; can be canceled (the page then says the request was canceled).
- Manual: cash, bank transfer, cheque, other, with a note. Manual payments can be deleted; card payments cannot.
HOLDS: show "Hold expires in 3 days" (capture_before from Stripe per card brand; warn 24h before via the Today page and email). Capture once (partial capture releases the rest; Stripe allows one capture). Release a hold. Re-authorize for long rentals.
REFUNDS: refund part or all of the booking amount and/or deposit from a payment's menu. After a return, if a deposit is held or paid, the payment pill shows "Process deposit" and the button opens refund with the deposit prefilled minus anything kept.
PAYMENT STATUS on the booking is recalculated after every payment event: paid, partially_paid, overpaid, payment_due, process_deposit.
PAY PAGE /pay/:token: organization name and logo, booking number and dates, amounts, Payment Element, success and canceled states.

WEBHOOKS (Edge Function, verify signature, insert stripe_events first and skip duplicates, then apply in one transaction): payment_intent.succeeded, payment_intent.payment_failed, payment_intent.canceled, payment_intent.requires_action, payment_intent.amount_capturable_updated, charge.refunded, account.updated. Nightly reconciliation job compares open intents with Stripe.

Acceptance checks (Stripe test mode): full payment at checkout marks the booking Paid; 20% down payment shows Partly paid; authorize the deposit at pickup, take back with $25 kept, capture $25 and release the rest; a declined card (4000 0000 0000 0002) shows a clear error and keeps the booking unpaid; webhooks sent twice change nothing the second time.
```

---

## PROMPT 10: EMAILS AND NOTIFICATIONS

```
Add email with Resend from an Edge Function (sender name = organization name, reply-to = organization email; optional custom sender domain later).

email_templates(organization_id, system_key in ('booking_confirmation','request_received','payment_request','payment_receipt','pickup_reminder','return_reminder','customer_magic_link') or null for manual templates, name, context in ('booking','customer','all'), subject, body_markdown) and email_messages(booking_id, customer_id, template_id, to_address, subject, provider_message_id, status in ('queued','sent','delivered','bounced','failed'), sent_by).

/settings/emails: list of system emails (each with on/off, edit) and manual templates (create, edit, duplicate, delete). Editor: name, available when (booking, customer, all), subject, Markdown body with a variables menu that inserts {{booking.number}}, {{booking.pickup}}, {{booking.return}}, {{booking.total}}, {{booking.deposit}}, {{customer.name}}, {{organization.name}}, {{booking.link}}, and a block {{#booking.lines}}{{quantity}} x {{title}} {{total}}{{/booking.lines}}; live preview with a sample booking; "Send test to me". Header and footer templates. BCC addresses.
Booking aside "Emails": send a template (preview, edit before sending), history with delivery status from Resend webhooks.
Automatic: confirmation (with the QR code and calendar file) on store bookings; request received in request mode; payment receipts; reminders N hours before pickup and return (scheduled job, settings per organization).
In-app: browser notification and a badge on Bookings for new online bookings.

Acceptance checks: a store booking sends one confirmation (not two on retries); variables render; a bounced email shows Bounced on the booking.
```

---

## PROMPT 11: SETTINGS, TEAM, SECURITY, DOCUMENTS, REPORTS

```
Build the remaining settings and the secondary areas. Settings use a second-level sidebar with two groups: "Back office" (General, Pricing, Taxes, Rental period, Payments, Custom fields, Locations, Emails, Documents, Labels and translations, Security, Team, Plan and billing) and "Online store" (Overview, Booking page, Preferences, Checkout, Pickup and delivery).

- General: business name, logo, address, email, phone, currency (changing it only affects new bookings), time zone, language, date and number format.
- Custom fields: per entity (booking, product, customer, stock unit), drag to reorder, field types, required, show in checkout.
- Locations: list, add/edit (name, code, address, pickup enabled), assign stock to locations; booking pickup and return locations; availability per location.
- Labels and translations: rename nouns used everywhere ("Booking" -> "Order", "Customer" -> "Client"), and edit every customer-facing text in the store, emails and documents per language.
- Checkout form builder (/settings/store/checkout): sortable list of items (custom field, heading, text, text with background, image) under the fixed name and email fields; drag handles, keyboard reordering (Alt+Up/Down), preview.
- Security: require two-step sign-in for everyone, email confirmation on new devices (on by default), sessions list with "Sign out everywhere"; IP allowlist and SAML single sign-on as "premium" options (can be stubs with an upgrade note).
- Team: invite by email (role owner/admin/member + permission checkboxes), pending invites, change role, remove; activity log of important actions (who reserved, canceled, refunded, changed prices) filterable by user and date.
- Plan and billing: our own plans via Stripe Billing Checkout and Customer Portal (Start, Grow, Scale; monthly or yearly with 2 months free), trial banner, one-click cancel, invoices list. Gate premium features with a friendly upgrade card (never hide data the user already created).
- Documents (/documents, can be built last): quotes, contracts with e-signature, invoices (with revisions) generated from bookings with sequential numbers and prefixes, PDF output, editable header/footer/body text per type, "Request signature" link page where the customer signs by drawing or typing, signed PDF stored. Booking aside "Documents": New quote, New contract, New invoice, Packing list. List page with tabs Invoices / Contracts / Quotes, metrics, filters (finalized, sent, payment status, date range, due date).
- Reports (/reports): a hub of report cards grouped Business (company performance: revenue, bookings, average value over time), Inventory (product performance: times rented, revenue, utilisation, ROI vs purchase cost, maintenance count and duration; availability for a period; fulfillment pull list for a period), Customers (revenue, bookings, balance due), Coupons (uses, discount given), Activity log, Background tasks (results of imports, exports and bulk edits with downloadable files). Every report: date range, filters, chart + table, CSV export.
- Setup guide (/setup): checklist of 11 steps with progress (add a tax profile, add a rental product, set pricing, set deposits, set rental period rules, connect payments, customise the store, go live, make a test booking, invite the team, connect a domain), each expandable with a short explanation and a button to the right screen; the sidebar progress ring reads from it.

Acceptance checks: renaming "Booking" to "Order" changes the sidebar, page titles, buttons and emails; a member without cancel_bookings does not see Cancel and the RPC refuses it too.
```

---

## PROMPT 12: QUALITY PASS AND TESTS

```
Do a full quality pass and add automated tests.

1. Playwright end-to-end tests:
   - Back office: create a tracked product with one unit, create a customer, new booking with dates, add the product, reserve, hand out, take back keeping $25 with a reason, archive.
   - Shortage: 80 chairs with limit 10: 85 asks to confirm, a further 10 is blocked.
   - Store: choose dates on the calendar, add to cart, check out, see the confirmation, the booking appears in Bookings and on Today.
   - Race: two browser contexts check out the only unit for the same dates at the same moment; assert exactly one booking and that the other customer sees the "just booked" message.
   - Payments (Stripe test mode): full payment, down payment, declined card, refund.
   - Every test fails on any console error or any 5xx response.
2. Accessibility: run axe on every page (no serious or critical issues), tab through every flow, check focus is visible and returns to the trigger after closing dialogs.
3. Responsiveness: screenshot every page at 390x844 and 1440x900; assert no horizontal overflow; test with a 60-character product name and customer name.
4. Security: RLS test with two organizations for every table; storefront RPCs return nothing for offline stores or hidden products; rate limits on sign in, sign up, checkout, payment link pages; no secrets in the client bundle; webhook signatures verified.
5. Time: tests in America/New_York and Europe/London around both daylight saving changes for pricing, calendars and the Today page.
6. Performance: the store catalogue and product page load under 2s on a mid phone; availability month queries under 300ms with 50k plannings (add indexes if not).
Report every failure you find with steps to reproduce, fix them, and list anything you could not fix.
```

---

## Notes for you (not for Lovable)

- **Order matters.** Prompts 1 to 4 are the product. If credits are limited,
  stop after Prompt 7 and you have a sellable core: inventory, availability,
  bookings, pricing, customers and the store.
- **If Lovable cuts corners** on availability, paste the acceptance checks of
  Prompt 3 again and ask it to write and run the SQL tests. That engine is
  what customers pay for; everything else is screens.
- **Your existing Next.js code** (this repo) already has a tested schema
  (`replica/schema.sql`), availability and pricing engines with 32 unit tests,
  and the slice screens. Lovable will build its own; you can paste
  `replica/schema.sql` into Lovable with Prompt 1 to keep the two aligned.
- **Rebrand before launch.** Run `/replica-brand` for a name, palette and the
  checks to run, then update the colour values in Prompt 0.
