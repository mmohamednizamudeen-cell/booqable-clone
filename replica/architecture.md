# Architecture: rental platform (a rebuild of Booqable's core rental loop)

Working name until /replica-brand: **the rental platform**. Multi-tenant SaaS:
each rental business is an org with a back office and a hosted booking page.

Reads `recon.md` and `features.csv`. Schema in `schema.sql` (first migration),
loaded and tested against Postgres 16 on 2026-11-03 (results at the end).

## Stack

| layer | choice | why |
| --- | --- | --- |
| web | Next.js 15 (App Router) + TypeScript, one app | back office, storefront and pay pages share the pricing and availability code; host-based routing picks which one renders |
| styling | Tailwind + shadcn/ui (Radix), tokens from replica-design | accessible primitives for the dialogs, comboboxes and date pickers this app is full of |
| database | Postgres 16 on Neon | needs `btree_gist` (exclusion constraint), `citext`, `pgcrypto`; branch per pull request for previews |
| ORM | Drizzle (SQL-first: `schema.sql` is migration 0000) | typed queries without hiding SQL; the availability function stays in SQL |
| auth | Better Auth (email + password, verification, magic link, 2FA, organizations) | users live in our database, no per-seat fee on a product we resell, covers staff and storefront customers |
| payments for rentals | Stripe Connect, Standard accounts, direct charges | each business takes money into its own Stripe account; we never hold funds |
| payments for our plans | Stripe Billing (Checkout + Customer Portal) | Start / Grow / Scale subscriptions, one-click cancel |
| email | Resend + React Email for system mail; merchant templates in Markdown with `{{variables}}` | deliverability and webhooks for the delivery log; merchants edit text, not HTML |
| jobs | Inngest | event-driven functions with retries plus cron, no worker to run |
| files | Cloudflare R2 (S3 API), presigned uploads | product photos and exports; no egress fees |
| rate limits | Upstash Redis | sign-in, sign-up, checkout, payment link pages |
| hosting | Vercel, wildcard storefront domain + Vercel Domains API for custom domains | merchants connect their own domain from settings |
| monitoring | Sentry + Vercel logs | errors per org, alert on webhook failures |
| tests | Vitest (pricing, availability), Playwright (flows) | the two engines get unit tests before any screen |

One database, one app, no microservices.

> **Swap note:** RadicalStart's RentALLScript runs on its own stack. If the
> team would rather reuse that code base, nothing in the schema or the build
> order depends on Next.js. The availability engine, the tenancy model and
> the payment flows carry over to any Node stack with Postgres.

### Hosts

| host | renders |
| --- | --- |
| `app.{domain}` | back office (signed-in members) |
| `{slug}.{store-domain}` and verified custom domains | storefront of that org |
| `app.{domain}/pay/{token}` | payment request page |
| `app.{domain}/api/*` | webhooks, Inngest, auth |

`middleware.ts` resolves the host to an org (cached 60 s in Redis), then
rewrites to `/(store)/[org]/...`. Unknown hosts get a 404, never a fallback org.

## Schema

Tables: **44**. Access rules: **Postgres row level security on every org
table, plus data-layer checks for roles and permissions.**

The app connects as `app_user` (no `BYPASSRLS`). Every request runs inside one
transaction that first calls `set_config('app.org_id', $org, true)`:

```ts
// lib/db/with-org.ts
export async function withOrg<T>(orgId: string, fn: (tx: Tx) => Promise<T>) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.org_id', ${orgId}, true)`);
    return fn(tx);
  });
}
```

Where `$org` comes from: the member's active org (back office), the request
host (storefront), the connected account id (Stripe webhooks), the task row
(jobs). Roles and `permissions[]` (cancel_orders, revert_orders, manage_stock,
manage_settings, manage_payments) are checked in one function,
`can(member, action)`, called at the top of every action.

Child rows reference parents by `(org_id, id)`. Foreign key checks bypass row
level security, so this is what stops a forged id from linking one tenant's
order to another tenant's customer (tested, T14 below).

| group | tables |
| --- | --- |
| tenants and people (6) | orgs, users, memberships, org_settings, org_counters, locations |
| calendars (3) | operating_hours, away_periods, rental_period_options |
| tax and pricing (6) | tax_profiles, tax_rates, price_structures, price_tiles, price_rulesets, price_rules |
| catalogue (11) | products, product_photos, product_variants, stock_items, stock_batches, bundles, bundle_items, collections, collection_items, custom_field_definitions, coupons |
| customers (2) | customers, customer_addresses |
| orders and availability (6) | orders, order_lines, plannings, stock_item_plannings, downtimes, coupon_redemptions |
| payments (3) | payments, payment_requests, stripe_events |
| storefront (2) | carts, cart_lines |
| comms and ops (5) | email_templates, email_messages, notes, activity_events, background_tasks |

### Decisions that shape everything

1. **Every product has at least one variant.** Stock, price and plannings
   hang off `product_variants`. A product without variations has exactly one.
   No "is this a variant or a product" branches anywhere else.
2. **Two kinds of stock.** `stock_items` are tracked units (identifier, one
   each). `stock_batches` are bulk quantities. Both carry an optional
   `available_from` / `available_till` window, which is how expected stock and
   temporary (sub-rented) stock work without special cases.
3. **A planning is every hold on stock.** Orders and downtimes both create
   `plannings` rows. `holds_stock` is true while an order is reserved or
   picked up, or a downtime is scheduled or started. Drafts have plannings
   with `holds_stock = false`, so a draft shows prices and warnings but takes
   nothing.
4. **Buffers are baked in at booking time.** `reserved_from` / `reserved_till`
   are the period widened by the product's buffers when the line was booked.
   Changing a buffer later does not move existing bookings (the original
   behaves the same way).
5. **The database forbids double-booking a unit.** `stock_item_plannings`
   has an exclusion constraint: one stock item, overlapping `reserved_range`,
   both holding stock, is impossible. Bulk quantities cannot be expressed as
   a constraint, so they are protected by a lock (see "races").
6. **Availability is computed, never stored.** `variant_free_quantity(variant,
   location, from, till, exclude_order)` evaluates capacity minus holds at
   every point where either changes and returns the minimum. Shortage limits
   are added in code.
7. **Order statuses** are `new, draft, reserved, started, stopped, archived,
   canceled`. The UI says "picked up" for started and "returned" for stopped.
   Partial pickup and return live in `fulfillment_state` and in the
   per-planning `started_quantity` / `stopped_quantity`.
8. **Real UTC instants everywhere.** The original stores local wall-clock time
   with a Z; we do not. `starts_at` is a true instant; the org's IANA zone
   converts at the edges. Operating hours and default times are local `time`.

## Engines (pure TypeScript, unit tested, used by back office and storefront)

**`lib/availability`**

- `freeQuantity(tx, variant, location, period, excludeOrder?)` wraps the SQL
  function and adds `shortage_limit` when `allow_shortage`.
- `bundleFree` = min over contents of `floor(free(content) / qty)`.
- `breakdown()` for the S06 popover: available, expected, on this order, other
  orders, within / over shortage, downtime.
- `monthStatuses(item, month)` for storefront calendars: per day available /
  partial / unavailable / closed, using operating hours and away periods.
- `reserve(tx, orderId, { confirmShortage })`: the only code path that sets
  `holds_stock = true`. Steps in "races".

**`lib/pricing`**: `priceLine(product, variant, period, rules, org) ->
{ priceEach, chargeLabel, chargeSeconds, breakdown }`

- flat: `ceil(chargedSeconds / periodSeconds) * base`. Days are counted in
  the org's zone, so a DST night is still one day.
- fixed: base once.
- structure: first tile whose length >= charged length, else the last tile
  plus extra periods times the extra multiplier.
- rulesets: free pickup / return day shorten the charged length; date-range
  and weekday rules adjust the price per `apply_when` and `stacking`.
- order totals: line totals, then customer discount and coupon on
  discountable lines, then tax per line from (product profile, customer
  profile) rates, then deposit by method. Inclusive tax backs out the rate.
  Rounding: per line, half-even, documented in the tests.

## API

Back office mutations are Next.js server actions (`ACTION`); reads are server
components with typed query functions (`QUERY`). Storefront, payments,
webhooks and feeds are route handlers. Every ACTION runs `requireMember()`,
`can()`, `withOrg()`, validates input with zod, and writes an
`activity_events` row.

### Onboarding and team

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| `POST /api/auth/*` | sign up, sign in, verify email, magic link, 2FA, reset, new-device code | public | Better Auth | session | F12 |
| `ACTION org.create` | create org, settings, default tax profile, main location, system email templates | signed-in user | name, slug, currency, time zone | org | F12 |
| `ACTION org.switch` | set active org | member | org id | session | |
| `ACTION members.invite / update / remove` | team and permissions | owner, admin | email, role, permissions | member | |
| `QUERY setup.checklist` | the 11 setup steps and their state | member | | steps | S02 |

### Catalogue and stock

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| `QUERY products.list` | inventory table, filters, search | member | type, structure, ruleset, tags, q, page | rows, count | S11 |
| `ACTION products.create` | product + first variant | manage_stock | name, type, tracking, price type / period / base | product | F06, F07 |
| `ACTION products.update` | settings, pricing, store, buffers, shortage | manage_stock | patch | product | F06 |
| `ACTION products.archive` | hide, keep history | manage_stock | id | | |
| `ACTION products.bulkEdit` | pricing method, ruleset, tax, visibility on many | manage_stock | ids, patch | background task | |
| `ACTION variants.enable / upsert / archive` | variations (irreversible enable) | manage_stock | fields, option values, price | variants | F06 |
| `ACTION stock.addItems` | tracked units, regular / expected / temporary | manage_stock | variant, location, identifiers[], window, cost | items | F06, F08 |
| `ACTION stock.addBatch` | bulk quantity, same windows | manage_stock | variant, location, qty, window, cost | batch | F07, F08 |
| `ACTION stock.updateItem / archiveItem` | edit or decommission a unit; refused while held | manage_stock | id, patch | item | |
| `GET /api/uploads/sign` | presigned R2 upload for photos | member | content type, size | url, key | |
| `ACTION bundles.create / update / archive` | bundle and contents with discounts | manage_stock | contents[] | bundle | F07 |
| `ACTION collections.upsert / reorder` | storefront grouping | manage_stock | name, items | collection | |
| `ACTION priceStructures.upsert` | tiles and extra-period rate | manage_settings | tiles[] | structure | |
| `ACTION priceRulesets.upsert` | rules and stacking | manage_settings | rules[] | ruleset | |
| `ACTION imports.products / customers` | CSV import as a background task | manage_stock | file key | task | |

### Orders, availability and the calendar

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| `QUERY dashboard` | going out / coming back for a range, late flags, day notes | member | range | panels | F04, F05, S03 |
| `QUERY orders.list` | tabs all / upcoming / late / with shortage, payment status, search, metrics | member | filters | rows, metrics | S04 |
| `ACTION orders.new` | the member's single unsaved order (reused, like the original's + button) | member | | order (status new) | F03 |
| `ACTION orders.update` | customer, period, fulfillment, locations, discount, coupon, deposit, custom fields, tags; reprices; re-checks stock if holding | member | patch, confirmShortage | order, warnings | F03, F10 |
| `ACTION orders.addItem` | book a variant, specific stock items, or a bundle with choices | member | variant / stockItemIds / bundle, qty | lines, plannings, warnings | F03 |
| `ACTION orders.updateLine / removeLine` | quantity, manual price | member | line, patch | order | F03 |
| `ACTION orders.addCustomLine` | one-off charge or discount line | member | title, qty, price | line | F03 |
| `ACTION orders.specifyStockItems` | assign or swap units on a planning | member | planning, add[], remove[] | plannings | F04 |
| `ACTION orders.transition` | save draft, reserve, archive, cancel, revert | member; cancel_orders / revert_orders | to, revert, confirmShortage | order, warnings or blocking errors | F03, F08, F11 |
| `ACTION orders.pickup` | start all or some items | member | per planning qty or stock items | order | F04 |
| `ACTION orders.return` | stop all or some items, keep deposit with reason | member | per planning qty or stock items, depositKept, reason | order | F05 |
| `ACTION orders.duplicate` | copy to a new draft | member | id, options | order | |
| `QUERY availability.breakdown` | the "x left / short" popover | member | variant, period, order | breakdown | S06, F08 |
| `QUERY calendar` | rows per product / unit with bars by status, buffers, downtime, check-range counts | member | range, view, location, q | rows | S10 |
| `GET /api/calendar/{token}.ics` | iCal feed of plannings | secret token | | ics | |
| `ACTION downtimes.schedule / update / start / end / undoEnd / cancel` | maintenance holds | manage_stock | variant or unit, qty, reason, period | downtime, conflicts | F09 |
| `ACTION notes.upsert / delete` | order, product, customer and day notes | member | subject, body | note | S03 |

### Customers

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| `QUERY customers.list` | filters with counts, columns, search | member | filters | rows | S19 |
| `QUERY customers.get` | detail, addresses, orders, revenue | member | id | customer | S20 |
| `ACTION customers.create / update / archive` | record and defaults (discount, deposit, tax profile, consent) | member | fields | customer | F03 |
| `ACTION customers.merge` | merge a suggested duplicate | member | keep, merge | customer | |

### Payments

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| `ACTION stripe.connect` | Account Link to onboard the org's Stripe account | owner | | url | F12 |
| `GET /api/stripe/connect/return` | finish onboarding, refresh capabilities | owner | | redirect | F12 |
| `ACTION payments.recordManual / deleteManual` | cash, bank, cheque, other | manage_payments | order, amount, deposit, method | payment | F05 |
| `ACTION payments.card` | charge or authorize a stored or new card (PaymentIntent on the connected account) | manage_payments | order, amount, deposit, authorize, pm | client secret / payment | F05 |
| `ACTION payments.capture` | capture an authorization once, release the rest | manage_payments | payment, amount | payment | F05 |
| `ACTION payments.release` | cancel an authorization | manage_payments | payment | payment | F05 |
| `ACTION payments.refund` | refund order money and / or deposit | manage_payments | payment, amount, deposit | refund | F05, F11 |
| `ACTION paymentRequests.create / cancel` | payment link with amounts, charge or authorize | manage_payments | order, amount, deposit, authorize | url | F05 |
| `GET /pay/{token}` | payment request page | public, token | | page | S34 |
| `POST /api/pay/{token}/intent` | create the PaymentIntent for that request | public, token, rate limited | | client secret | S34 |

### Settings

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| `ACTION settings.update` | one section of org_settings at a time | manage_settings | section, patch | settings | F12, S21-S27 |
| `ACTION operatingHours.set / awayPeriods.upsert / periodOptions.upsert` | booking calendar rules | manage_settings | rows | rows | F12 |
| `ACTION locations.upsert / archive` | locations | manage_settings | fields | location | |
| `ACTION tax.upsertProfile / upsertRate` | tax setup | manage_settings | fields | profile | F12 |
| `ACTION customFields.upsert / reorder` | definitions, checkout visibility | manage_settings | fields | definition | |
| `ACTION checkoutForm.save` | ordered form items | manage_settings | items[] | form | F12 |
| `ACTION emailTemplates.upsert / sendTest` | templates | manage_settings | subject, body | template | |
| `ACTION emails.send` | send a template from an order or customer | member | template, subject id | message | |
| `ACTION domains.connect / remove` | custom storefront domain (Vercel Domains API) | owner | hostname | DNS records to set | F12 |
| `GET /api/domains/verify` | poll verification | owner | hostname | status | F12 |
| `ACTION security.update` | require 2FA for all, new-device email | owner | flags | settings | S36 |
| `ACTION billing.checkout / portal` | our plan, via Stripe Billing | owner | plan | url | |

### Storefront (public, org from host, rate limited)

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| `GET /` `GET /c/{slug}` `GET /p/{slug}` | catalogue, collection, product (server rendered) | public | | pages | F01, S28, S29 |
| `GET /api/store/config` | period mode, hours, slots, durations, away, notice, price label, brand | public | | config | S30 |
| `GET /api/store/availability` | month statuses and counts for an item or the cart | public | item or cart, month, location | days | S29, S30, S31 |
| `POST /api/store/cart` | create cart (token in an http-only cookie) | public | | cart | F01 |
| `PATCH /api/store/cart` | period, pickup / delivery, location, address, coupon | cart token | patch | cart with prices and per-line availability | F01 |
| `POST /api/store/cart/lines` | add variant or bundle with choices | cart token | item, qty | cart | F01 |
| `PATCH / DELETE /api/store/cart/lines/{id}` | change or remove | cart token | qty | cart | F01 |
| `POST /api/store/checkout` | validate, create customer and order, reserve (or draft in request mode), create PaymentIntent for the configured amount | cart token, idempotency key | details, custom fields, terms, payment option | order token, client secret | F01, F02 |
| `GET /order/{token}` | confirmation page | token | | page | S33 |

**Route count: 76 entries**: 56 server actions and queries (some rows group create / update / archive of one thing) and 20 HTTP routes including the 4 webhook and job endpoints below.

### Webhooks in

| endpoint | events | effect |
| --- | --- | --- |
| `POST /api/webhooks/stripe-connect` | `payment_intent.succeeded`, `.payment_failed`, `.canceled`, `.requires_action`, `.amount_capturable_updated`, `charge.refunded`, `account.updated` | payments and order paid / deposit totals, payment_status, confirmation email; account capabilities |
| `POST /api/webhooks/stripe-billing` | `checkout.session.completed`, `customer.subscription.updated`, `.deleted`, `invoice.payment_failed` | org plan and billing status |
| `POST /api/webhooks/resend` | `email.delivered`, `email.bounced` | email_messages status |
| `POST /api/inngest` | Inngest functions | jobs below |

All Stripe handlers: verify the signature, insert `stripe_events(id)` first
(conflict = already handled, return 200), then apply in one transaction.

**Webhooks out:** none in the first release. A merchant-facing webhook and
REST API is a could-have (Grow plan on the original).

### Jobs (Inngest)

| job | schedule | does |
| --- | --- | --- |
| `checkout.abandon` | event + 30 min delay | a store order whose payment never succeeded is canceled and its stock released |
| `carts.expire` | hourly | delete carts past `expires_at` with no order |
| `payments.holdExpiring` | hourly | authorizations whose `capture_before` is within 24 h: notify staff on the order and dashboard |
| `orders.lateDigest` | every 15 min | late pickups and returns for the dashboard badge and an optional email |
| `email.send` | on event | render template, send via Resend, log, retry 3 times |
| `tasks.run` | on event | imports, exports, bulk edits; writes background_tasks results and file |
| `stripe.reconcile` | nightly | compare open PaymentIntents and refunds with Stripe, fix drift, alert |
| `orgs.trialEnding` | daily | trial reminder emails for our own plans |

## The parts that bite

- **Time zones and DST.** True UTC instants in the database, org zone at the
  edges. A flat "per day" price counts calendar days in the org's zone, so a
  rental across a DST change is not charged an extra day. Operating hours and
  slots are local times resolved per date. Test fixtures cover the spring
  and autumn change in at least two zones.
- **Races.** Two checkouts for the last unit. `reserve()` does: begin; take
  `pg_advisory_xact_lock(hashtext(variant_id))` for every variant on the
  order, in sorted order (no deadlocks); recompute free quantity excluding
  this order; compare with the shortage limit; write plannings with
  `holds_stock = true`; commit. Tracked units are additionally guarded by the
  exclusion constraint, so even a bug in the lock path cannot double-book a
  unit. The checkout reserves *before* taking payment and the abandon job
  releases stock if payment never completes.
- **Idempotency.** Stripe retries webhooks; `stripe_events` dedupes. The
  checkout endpoint takes an `Idempotency-Key` header so a double-click makes
  one order. Stripe calls pass idempotency keys derived from our payment id.
- **Card holds.** One capture per authorization (Stripe's rule too). Hold
  life differs by card brand; store `capture_before` from Stripe and warn
  before it lapses. Re-authorize for long rentals.
- **Money.** Integer cents, one currency per org, frozen onto each order and
  payment. Rounding rules live in one function with tests. Kept deposits are
  entered tax-inclusive (matches the original's documented behaviour).
- **Late returns.** A unit still out past its return time is not free for
  the next pickup even though its reserved range has ended. Pickup checks the
  unit's live state; the dashboard and the next order show the conflict.
- **Multi-tenancy.** Row level security with FORCE, composite foreign keys,
  a CI test that runs every query with two orgs, and a lint rule that bans
  the raw `db` client outside `withOrg`.
- **Rate limits.** Sign-in, sign-up, checkout, cart writes, payment link
  intents and availability per IP and per org (Upstash).
- **Search.** Postgres full text on names, SKU, identifiers, emails, plus
  exact order number. No search service until it hurts.
- **Realtime.** Not needed. Lists revalidate after actions; the calendar
  polls every 60 s while open.
- **Files.** Photos max 10 MB, images only, 3 per product, resized on
  upload. Imports max 5 MB CSV.
- **Email deliverability.** Send from our verified domain with the org's name
  and reply-to; custom sender domains (SPF, DKIM) are a should-have.
- **Storefront customers and GDPR.** The merchant is the controller, we are
  the processor: data processing agreement, per-customer export and erase
  (erase anonymises customers rows but keeps orders for tax law).
- **Payments compliance.** Card data only in Stripe Elements; we never see
  card numbers. SCA handled by Stripe's `requires_action` flow.
- **Clean room.** Nothing is called from Booqable's domains or APIs; the
  public API docs were read for the shape of the problem only.

## Build order

Sizes assume one full-stack developer; double the team, roughly halve it.

### M0 Foundations (1 week)

- Repo, Next.js, Neon, Drizzle with `schema.sql` as migration 0000, Better
  Auth, `withOrg`, `can()`, zod, Sentry, Vitest, Playwright, CI with the
  two-org isolation test.
- Sign up, create org (seeds settings, tax profile, location, templates),
  app shell with the sidebar from the trial screenshots.
- Screens: S01, S02 (shell only). Tables: orgs, users, memberships,
  org_settings, org_counters, locations, tax_profiles, email_templates.

### M1 Vertical slice (2 weeks): book a thing, hand it out, take it back

Ugly is fine. Proves availability, tenancy, host routing and the order state
machine end to end.

- Back office: create a tracked product and a bulk product with flat daily
  price and stock (S11, S12, S13 minimal); manual order with customer,
  period, items, Reserve with the availability check, Pick up, Return
  (S05, S07, S08); dashboard going out / coming back (S03).
- Storefront: catalogue, product, period picker (free dates and times only),
  cart, checkout with payment option "none", confirmation (S28-S33). The
  order arrives reserved.
- Engines: `variant_free_quantity` wired, `reserve()` with locks, flat
  pricing, totals without tax.
- Tables: products, product_variants, stock_items, stock_batches, customers,
  orders, order_lines, plannings, stock_item_plannings, carts, cart_lines.
- Routes: products.create/update, stock.addItems/addBatch, orders.new/
  update/addItem/transition/pickup/return, dashboard, the storefront group.
- Done when: two browsers racing for the last unit produce one order and
  one clear "no longer available" message, covered by a Playwright test.

### M2 Must-haves (5 to 6 weeks)

| area | features | screens | tables / routes |
| --- | --- | --- | --- |
| orders | full status machine incl. cancel, revert, archive; extend / change dates with re-check; orders list with tabs and search | S04, S05 | orders.* , orders.list |
| availability | buffers, stock status, calendar with bars | S10, S13 | calendar, availability.breakdown |
| pricing | fixed price, taxes (inclusive / exclusive, customer profiles), deposits by four methods | S14, S22 | tax_*, pricing engine |
| customers | list, detail, create from order and checkout | S19, S20 | customers.* |
| payments | Stripe Connect onboarding, card at checkout (full, down payment, deposit only, none), payment links and page, manual payments, refunds, deposit kept at return, payment status | S09, S26, S34 | payments, payment_requests, stripe_events, webhooks |
| storefront | rental period modes (free, fixed durations, time slots), operating hours, availability calendars, checkout form with custom fields basics, brand colour and logo, store live toggle, confirmation email | S23-S25, S28-S33 | rental_period_options, operating_hours, store routes, email.send |
| custom lines | one-off charges and negative lines | S05 | orders.addCustomLine |

Exit: all 50 must rows in `features.csv` at yes, `parity.py` says must-haves
done.

### M3 Should-haves (5 to 6 weeks)

Variations; bundles; service and sales items; pricing structures and
templates; shortages with confirm and the "with shortage" tab; expected and
temporary stock; downtime (S18); coupons; customer discount and deposit
overrides; card holds and capture; pay later; request mode (availability
off = drafts); account labels and translations; custom fields everywhere;
checkout form builder; custom domains; staff users and permissions; 2FA and
new-device email (S36); email templates and manual send; CSV imports;
bookings list metrics; away mode and minimum notice; terms at checkout.

### M4 Could-haves (as needed)

Price rulesets; reports hub (S37) and exports; activity log; background
tasks page; iCal feed; multiple locations and default pickup location;
cross-sell; storefront customer accounts; website embed script; public API
and webhooks out; IP allowlist and SSO; packing slips; dashboard notes.

### M5 Fixes from /replica-entrepreneur

Not run yet. Its fix rows land in `features.csv` with `original = no` and are
slotted ahead of the could-haves.

## Schema test results (2026-11-03, Postgres 16.15)

`schema.sql` loads cleanly: 44 tables, 42 row level security policies.
Behaviour checked with a two-org fixture, running as `app_user`:

| # | check | result |
| --- | --- | --- |
| T1 | camera free inside the previous rental's 1 h after-buffer | 1 of 2 (correct) |
| T2 | camera free once the buffer ends | 2 of 2 |
| T3 | chairs: 10 regular + 5 temporary, 12 held | 3 free |
| T4 | chairs over a window starting before the temporary stock | 3 free (minimum over the window) |
| T5 | chairs after the temporary stock ends | 10 free |
| T6 | same check excluding the order itself (rescheduling) | 15 |
| T7 | book the same unit inside its buffer | rejected by `stock_item_no_double_booking` |
| T8 | same unit back to back after the buffer | allowed |
| T9 | a draft overlapping a held unit | allowed (drafts take nothing) |
| T10 | change a product's tracking type | rejected by trigger |
| T11 | org B lists org A's products | 0 rows |
| T12 | org B lists orgs | only itself |
| T13 | org B writes a row tagged as org A | rejected by row level security |
| T14 | org B order pointing at org A's customer id | rejected by the composite foreign key |
| T15 | request with no org set | 0 rows |
| T16 | reserved order without dates | rejected by check constraint |
