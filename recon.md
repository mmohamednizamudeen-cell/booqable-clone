# Recon map: Booqable (web)

Scope: the core rental loop. Inventory with date-based availability, the hosted
booking page where customers book and pay, and the back-office order lifecycle
(draft, reserved, picked up, returned). Web only. Documents, barcodes, the
website builder, mobile POS and the app store are out of this slice.
For: a product to sell (rental software for other businesses, RadicalStart).
Date: 2026-10-31

Method: public pages only. Marketing site, pricing page, 43 help center
articles, the public API reference, and the terms of service. No account was
used, no app code or network calls were read. Every screen below is inferred
from documentation. **No screen has been seen yet**, so the "states" column
lists what the docs describe, not what was observed. Five screens have since
been seen in the user's trial: see "Observed in the user's trial account".

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | marketing site | https://booqable.com/ | positioning, 8,500+ businesses, 12+ industries |
| 2 | pricing page | https://booqable.com/pricing/ | 3 plans, full feature comparison, read 2026-10-31 |
| 3 | help center | https://help.booqable.com/en/ | 20 collections; 43 articles read, listed below |
| 4 | public API reference | https://developers.booqable.com/ | JSON:API v4; best source for the data model |
| 5 | terms of service | https://booqable.com/agreement/ | 12.3: no reverse engineering or decompiling. No non-compete clause found |
| 6 | changelog | https://booqable.com/whats-new/ | not read yet |
| 7 | roadmap | https://roadmap.booqable.com/ | not read yet; useful for /replica-entrepreneur |
| 8 | the user's own account | (14-day free trial, no card) | not used yet; needed for screenshots |

Help articles read (all under https://help.booqable.com/en/articles/):
3845244 order workflow, 1253980 save or reserve, 1221154 pickups and returns,
100343 manual orders, 99552 add products to an order, 8206016 getting started
with orders, 3871387 product types, 1209362 track individually, 6820234 track
in quantities, 90053 product settings, 90773 variations, 3797998 bundles,
12505664 downtime, 3684264 shortages, 1209981 product availability, 4103695
calendar, 5603615 dashboard, 84968 ways of pricing, 99366 pricing structure
templates, 3799838 general pricing settings, 3701999 advanced pricing rulesets,
101604 security deposits, 681854 taxes, 798239 booking page, 2003151 rental
period settings, 15944232 period picker, 1710991 operating hours and away mode,
14785650 checkout settings, 9286611 checkout form, 5485891 show or hide
availability, 2752430 online payments, 1664955 payment methods, 10704191
charging payments, 1539073 card holds, 1539117 payment requests, 7978695
deposits and damage, 100457 customers, 3832164 email templates, 9127272
wishlist and order requests, 4665950 customer accounts, 3461344 glossary,
84961 introduction, 8205435 getting started with products.

## Core loop

A rental business lists products with real stock, a customer picks dates and
books online (or staff books for them), the items are reserved so nothing
double-books, and staff hand them out and take them back, collecting payment
and a deposit along the way.

The one promise everything hangs on: **availability you can trust for any date
range**, across tracked items, bulk quantities, bundles, buffer times,
downtime and shortages.

## Screens

Back office (B) and storefront (F). IDs are stable.

| ID | screen | route / how to reach | purpose | key components | states (from docs) |
| --- | --- | --- | --- | --- | --- |
| S01 | Sign up | marketing site, Start free trial | create account and company | form, plan trial banner | empty, error |
| S02 | Setup checklist | first login | guide to first product, store live, payments | checklist, progress | partial, complete |
| S03 | Dashboard | B: Dashboard (home) | today's pickups and returns, late ones, notes | date range picker, two order panels, notes, Run report | empty day, filled, late flagged |
| S04 | Orders list | B: Orders | find and triage orders | status tabs incl. With shortage and Archived, search, filters, table, columns | empty, filled, filtered, no results |
| S05 | Order editor | B: + button or an order row | build and run one order | customer picker, period picker, pickup/delivery, product search, lines table, availability labels "x left / short", totals (discount, coupon, deposit, tax), status action bar (Save, Reserve, Pick up, Return, Archive, more: revert, duplicate, cancel), payment sidebar, notes | new (unsaved, no number), draft, reserved, mixed, picked up, returned, archived, canceled, with shortage, payment due / paid / process deposit |
| S06 | Availability breakdown | S05: click "x left" label | why is this short | bar, counts: available, expected, on this order, other orders, within / over shortage limit, downtime; Add stock, Show on calendar | available, shortage |
| S07 | Pick up dialog | S05: Pick up | hand items out | item list, quantity inputs (bulk), stock item selector (tracked), recommended stock items | all selected, partial, missing stock item |
| S08 | Return dialog | S05: Return | take items back, keep deposit | item list, deposit kept amount + reason | full, partial, with deposit kept |
| S09 | Payment dialog | S05: New payment / Payment due | take money | order amount + deposit fields, method (manual, card, payment link), charge vs authorize, stored cards | manual, card, link created, authorized, error |
| S10 | Calendar | B: Calendar | see what is where and when | day/week/month toggle, product rows expandable to stock items, order bars coloured by status, buffer extensions, hover card, Check availability range, location filter, search, iCal subscribe | empty, filled, shortage (negative numbers), downtime |
| S11 | Inventory list | B: Inventory (Products, Bundles, Downtime tabs) | manage catalogue | table with pricing column, tags, bulk actions (edit, apply pricing), Add product, New bundle | empty, filled, bulk selected |
| S12 | New product | S11: Add product | create a product | name, type (rental, service, sales item), tracking (individual, quantities), flat fee or other pricing, enable variations | validation error |
| S13 | Product: Inventory tab | S11: product | stock | stock list with status dots (tracked) or totals (bulk: total, out, downtime), Add stock dialog (quantity, location, identifiers, regular / temporary, available from / till, purchase cost and date), edit, delete, schedule downtime | no stock, in stock, out, expected, temporary, in downtime |
| S14 | Product: Pricing tab | product | how it is charged | charge toggle, method (flat fee + period, fixed, structure one-off or template + base price), ruleset, taxable + tax category, discountable, deposit value, default purchase cost | each method |
| S15 | Product: Variations tab | product | size, colour etc. | properties, variation rows with values and price | not enabled, enabled (irreversible) |
| S16 | Product: Settings tab | product | details and availability rules | name, SKU, description on documents, images (3), allow shortage + limit, buffer before / after, online store visibility, custom fields | |
| S17 | Bundle editor | S11: New bundle | packages | contents search, quantity, specific or "any" variation, discount % or discounted price, pricing (taxable, discountable), images, store settings | empty, filled |
| S18 | Downtime dialog and list | S13 or Inventory > Downtime | maintenance | reason, period, quantity (bulk), start now or later; list with Start, Stop, Undo end, Cancel | scheduled, started, ended, cancelled, conflict with orders |
| S19 | Customers list | B: Customers | CRM | filters (type, marketing, tax profile, created, latest order, tag), configurable columns | empty, filled |
| S20 | Customer detail | S19: row | customer record | contact, addresses, person/company, discount %, tax profile, deposit override, marketing consent, order history, revenue | |
| S21 | Settings: General | B: Settings | company | name, logo, currency, locale, time zone | |
| S22 | Settings: Pricing | Settings > Pricing | money rules | enable pricing, currency format, deposit method, structure templates (tiers with multipliers + extra period), rulesets, taxes | |
| S23 | Settings: Rental period | Settings > Rental period | booking rules | default order times + pre-fill, mode (dates and times, fixed durations, time slots), time selection, operating hours slots, increments, away periods, apply to manual orders, minimum notice | |
| S24 | Settings: Online store | Settings > Online bookings | storefront behaviour | booking page Set live, availability on/off, calendars, hide quantities, show prices + label mode, brand colour, translations | |
| S25 | Settings: Checkout | Online bookings > Checkout | checkout rules | form builder (fields, headings, text, images, drag order), payment in checkout (full, down payment %, deposit only, none), add deposit, pay later label + terms, terms and conditions, back-to-website URL | |
| S26 | Settings: Payments | Settings > Payment providers | connect Stripe | connect button, status | not connected, connected |
| S27 | Settings: Emails | Settings > Emails | templates | system and manual templates, subject, Markdown body with variables, BCC | |
| S35 | Documents list (out of slice, reference) | B: Documents | invoices, waivers, proposals | tabs Invoices / Waivers / Proposals, metric cards (count, paid, revenue, due) with Hide metrics, filters (Finalized, Sent, Payment status with counts, Date range, Due date), Export, table with payment status pill | seen: one pro forma, payment due |
| S36 | Settings: Security | Settings > Back office > Security | account protection | require 2FA for all users, email confirmation on new devices (on by default), IP allowlist, SAML single sign-on (ACS URL, entity ID, IdP URL + certificate, test link) | seen: defaults |
| S37 | Reports hub | B: Reports | pick a report | sections with explanation left and report cards right: Company performance, Product performance, Availability, Product fulfillment, Customer report, Coupons, Activity logs, Background tasks; each card Run report | seen |
| S28 | Store: catalogue | F: {company}.booqableshop.com (seen in trial) | browse | logo, collections sidebar, product cards with price label and availability, cart button | empty store, filled |
| S29 | Store: product | F: product card | decide | images, description, price label, variation dropdown, quantity, Check availability calendar, Add to cart | available, partially available, unavailable |
| S30 | Store: period picker | F: select dates / add to cart | choose rental period | pickup or delivery, location, address form, month calendar with availability colours, time picker | free dates, fixed durations, time slots, closed days, away period |
| S31 | Store: cart | F: cart | review | lines, quantity, service toggles, cross-sell, coupon, totals, deposit, cart availability calendar | empty, filled, item unavailable (checkout blocked) |
| S32 | Store: checkout | F: cart > checkout | pay | personal details (name, email fixed first), custom fields, address validation, terms checkbox, payment options (card etc., pay later) | validation error, payment error, SCA |
| S33 | Store: confirmation | F: after checkout | done | order summary, pay later terms if chosen; email with QR code | reserved, request (draft) |
| S34 | Payment request page | F: link from S09 | pay a link | amount, deposit, methods | open, paid, cancelled |

## Flows

```
F01 Customer books and pays online (availability on)
    S28 -> S29 -> S30 -> S29 add to cart -> S31 -> S32 -> S33
    happy path clicks: about 8 plus typing (open product, pick start, pick end,
      apply, add to cart, checkout, terms, pay). Estimate, not counted on the real app.
    result: order created as reserved, customer created, confirmation email.
    edge: item partly available on the end date, closed day, away period,
      minimum notice, two customers checking out the last unit at once,
      card needs SCA, payment fails after the order is built, down payment only.

F02 Customer sends an order request (availability off, "wishlist")
    S28 -> S29 -> S31 -> S32 -> S33 -> back office S05 draft -> Reserve
    result: draft order, staff reviews, sends quote (out of slice), reserves.
    edge: requested items no longer available by the time staff reserve.

F03 Staff takes a phone order
    S04 + -> S05 customer search or create -> period -> add products -> Reserve
      -> S09 payment link or manual payment
    happy path clicks: about 7 plus typing.
    edge: shortage warning within limit (confirm), over limit (blocked),
      unsaved New order is reopened by the + button, customer duplicate.

F04 Pick up
    S03 today's pickups -> S05 -> S07 assign stock items -> Pick up items
    edge: partial pickup (Mixed), stock item already planned elsewhere,
      tracked item never specified, late pickup flagged on dashboard.

F05 Return and settle the deposit
    S03 today's returns -> S05 -> S08 keep part of deposit with reason -> Return items
      -> S09 refund or Process deposit -> Archive
    edge: partial return, late return blocks the next order's pickup,
      card hold expired before capture, deposit kept larger than paid.

F06 Set up a tracked rental product
    S11 Add product -> S12 rental, track individually -> S13 add stock items
      with identifiers -> S14 flat fee per day -> S16 buffer, shortage -> store visible
    edge: tracking type chosen wrong (cannot change), variations enabled
      (cannot undo), temporary stock with till date.

F07 Set up a bulk product and a bundle
    S11 -> S12 track quantities -> S13 add quantity -> S17 bundle with contents and discount
    edge: bundle availability limited by its scarcest content, "any variation" content.

F08 Resolve a shortage
    S04 With shortage -> S05 -> S06 -> Add stock (temporary, available till) -> shortage clears
    edge: expected stock arrives late, shortage limit shown as extra stock in the store.

F09 Schedule maintenance
    S13 stock item ... -> S18 reason, period -> Start -> Stop
    edge: item is on a future order (conflict listed), undo end.

F10 Reschedule or extend an order
    S05 change period -> availability re-check -> totals and payment status update
    edge: new dates short, price tier changes, already paid (now partially paid / overpaid).

F11 Cancel an order
    S05 more -> Cancel -> stock released
    edge: payments to refund, cannot be restored (duplicate instead).

F12 Configure and launch the store
    S21 -> S22 deposits and tax -> S23 rental period, hours -> S26 connect Stripe
      -> S25 checkout payments -> S24 Set live
    edge: Stripe not connected but card payments chosen, no operating hours (24/7).
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary, secondary, ghost, danger | default, hover, focus, disabled, loading | all |
| Status badge (order) | new, draft, reserved, mixed, picked up, returned, archived, canceled | | S04, S05, S10 |
| Status badge (payment) | paid, partially paid, overpaid, payment due, process deposit | | S04, S05 |
| Stock status dot | available (green), out (orange), plus expected, temporary, downtime | | S13, S07, S05 |
| Period picker | back office, storefront modal | dates only, dates + times, fixed duration, time slots, closed, away | S05, S30 |
| Availability calendar (month) | product, cart | available, partial (diagonal), closed (strikethrough), unavailable; with or without quantities | S29, S30, S31 |
| Availability label + breakdown popover | | x left, x short | S05, S06 |
| Product / customer search combobox | | empty, results, no results, create new | S05, S17 |
| Lines table | order, bundle contents, cart | editable qty, nested bundle rows, custom line, removed (greyed) | S05, S17, S31 |
| Totals block | order, cart | discount, coupon, deposit, tax, paid, due | S05, S31, S32 |
| Modal dialog | pick up, return, payment, add stock, downtime, confirm | | S07, S08, S09, S13, S18 |
| Data table | orders, inventory, customers, downtime | sortable, selectable rows, column picker, empty | S04, S11, S19, S18 |
| Tabs | status tabs, product tabs, settings sections | | S04, S11-S17 |
| Filter sidebar | | | S04, S19 |
| Timeline / resource calendar | day, week, month | bars by status, buffer extension, hover card, check-range highlight | S10 |
| Form controls | text, number, money, percent, select, toggle, checkbox, date, time, address | error, disabled | everywhere |
| Form builder (drag list) | field, heading, text, text with background, image | | S25 |
| Toast | success, error | | all |
| Empty state | per list | | S03, S04, S11, S19, S28, S31 |

## Inferred data model

From the public API reference unless noted. Money is integer cents throughout.

```
Company      name, logo, currency, time zone, locale, settings (pricing, deposit
             method, rental period mode, operating hours, away periods, checkout
             payment mode, availability display...)
             evidence: S21-S27, help 2003151, 3799838     confidence: high (settings shape: medium)

Employee     name, email, permissions (cancel_orders, revert_orders, manage stock...), 2FA
             evidence: API Employees, Permissions        confidence: high

Location     name, code, address, location_type (rental | internal), pickup_enabled
             evidence: API Locations                     confidence: high

ProductGroup (the "product") name, slug, sku, description, photos, product_type
             (rental | sales_item | service), tracking_type (none | bulk | trackable;
             immutable), has_variations, variation_fields[], price_type (simple |
             fixed | structure | private_structure | none), price_period (minute |
             hour | day | week | month), base / flat_fee / structure price, price_structure_id,
             price_ruleset_id, deposit_in_cents, taxable, tax_category_id, discountable,
             allow_shortage, shortage_limit, buffer_time_before, buffer_time_after (seconds),
             show_in_store, sorting_weight, default_purchase_cost, tag_list
             evidence: API Product groups + Items filters, S12-S16   confidence: high

Product      (a variation of a group; groups without variations have one) group_id,
             variation_values, own price
             evidence: API Products, help 90773          confidence: high

StockItem    product_id, identifier, location_id, stock_item_type (regular | temporary),
             from, till (expected / temporary windows), purchase_cost, purchased_at,
             status (expected | in_stock | started | overdue | expired | in_downtime | archived)
             evidence: API Stock items, help 1209362     confidence: high
             (bulk stock: quantities per product per location; API Stock adjustments
              and Inventory levels. confidence: medium)

Bundle       name, photos, taxable, discountable, show_in_store
BundleItem   bundle_id, product_group_id, product_id (null = any variation), quantity,
             discount_percentage, position
             evidence: API Bundles, Bundle items          confidence: high

PriceStructure  name, type (reusable | private), product_group_id (private),
                extra-period multipliers: hour, day, week, month, year
PriceTile       structure_id, name (charge label), quantity, period, length (seconds), multiplier
PriceRuleset / PriceRule  date-range or weekday adjustments %, free pickup / return day,
                apply-when overlap rules, min/max duration, stacking
             evidence: API Price structures, tiles, rules, rulesets; help 99366, 3701999
             confidence: high (rule semantics: medium)

Customer     number, name, email, legal_type (person | commercial), addresses (Properties),
             discount_percentage, deposit_type + value, tax profile, email_marketing_consented,
             tag_list, stripe_id, merge_suggestion_customer_id, stats (revenue, AOV, balance)
             evidence: API Customers, S20                 confidence: high

Order        number (assigned on save), status (new | draft | reserved | started | stopped |
             archived | canceled), statuses[] (mixed), customer_id, starts_at, stops_at
             (local wall-clock time stored with a Z), fulfillment_type (pickup | delivery),
             start_location_id, stop_location_id, delivery / billing address,
             coupon_id, discount, deposit_type + value, price / tax / total / paid / to-be-paid
             (cents), deposit paid / held / refunded, payment_status (paid | partially_paid |
             overpaid | payment_due | process_deposit), location_shortage, tag_list, properties
             evidence: API Orders, Order status transitions; help 3845244   confidence: high

Line         order_id, line_type (charge | section | deposit_charge | proration | delivery_rate),
             item_id, planning_id, parent_line_id (bundle child), title, quantity,
             price_each, charge_label, charge_length (seconds; can differ from the period),
             price_tile_id, price_structure_id, price_rule_values, taxable, discountable, position
             evidence: API Lines                          confidence: high

Planning     the availability record. order_id or downtime_id, item_id, quantity,
             reserved (bool), reserved_from / reserved_till (period plus buffers),
             starts_at, stops_at, started (count), stopped (count), shortage amount,
             parent_planning_id (bundles), planning_type (order | downtime)
StockItemPlanning  planning_id, stock_item_id, reserved, started, stopped, starts_at, stops_at
             evidence: API Plannings, Stock item plannings, Order fulfillments   confidence: high

Downtime     product_id, stock_item_id (tracked) or quantity (bulk), location_id,
             reason (maintenance | repair | missing), starts_at, stops_at,
             status (reserved | started | stopped | canceled; UI calls them scheduled /
             started / ended / cancelled)
             evidence: API Downtimes, help 12505664      confidence: high

Payment      order_id, customer_id, amount + deposit (cents), currency, mode (checkout |
             request | off_session | terminal), provider (stripe | app | none),
             provider_method, status (created | started | action_required | succeeded |
             failed | canceled | expired | captured); authorizations with capture_before
             and captured / released amounts; charges; refunds; manual payments with method
             evidence: API Payments, authorizations, charges, refunds   confidence: high

Coupon       identifier (code), coupon_type (percentage | cents), value, active, starts_at,
             ends_at, max_redemptions, minimum_order_amount, one_per_customer, stackable,
             eligible_item_type (all | collection | item)
             evidence: API Coupons                        confidence: high

Collection   name, items (products, bundles), tree        confidence: high
Property     custom field definitions (Default properties) and values on order, product,
             customer, stock item; addresses are properties of type address   confidence: high
TaxCategory / TaxRate / TaxValue                         confidence: medium (not read in detail)
Cart         storefront basket that becomes an order at checkout   confidence: medium
EmailTemplate  name, context, subject, markdown body with {{variables}}   confidence: high
```

Relationships: Company 1-n Location, Employee, ProductGroup, Customer, Order.
ProductGroup 1-n Product 1-n StockItem. Bundle 1-n BundleItem n-1 ProductGroup.
Order 1-n Line, 1-n Planning; Planning 1-n StockItemPlanning n-1 StockItem.
Downtime 1-n Planning. Order 1-n Payment. Customer 1-n Order.

Two things in the model matter more than the rest:

1. **Availability is computed from Plannings**, not stored as a count. A product
   is available for [a, b) if regular stock (plus expected / temporary stock
   whose window covers it) minus reserved plannings overlapping [a - buffer
   before, b + buffer after) minus downtime is at least the requested quantity,
   plus the shortage limit when shortage is allowed. Bundles take the minimum
   over contents. *The exact formula is a guess from the docs.*
2. **Rental times are wall-clock local times**, stored with a Z suffix and never
   converted. Record timestamps are real UTC. The clone should keep the same
   split, deliberately.

## Feature matrix

See `features.csv`. Must: 50, should: 50, could: 38, skip: 9.

## Out of scope (cannot or should not be cloned)

- Quotes, contracts, invoices and e-signatures. These could be cloned, but
  they are outside the slice you chose, so they are marked `skip` with that reason.
- Barcodes, the website builder (80+ templates), mobile POS and Tap to Pay,
  the deliveries app, the Bo AI assistant: outside the slice or the platform.
- The app store and its partner integrations (Zapier, Xero, Mailchimp, GA4,
  Meta Pixel...): their partner network, not a feature.
- Booqable's name, logo, templates, help content, customer stories and the
  "booqableshop.com" subdomain pattern: theirs. Your storefront needs your own domain.
- The 8,500-business installed base and 1,000+ reviews: theirs.

## Size

Screens 37 (30 back office incl. 1 reference-only, 7 storefront), flows 12, entities about 20.

Hard parts:
1. **The availability engine.** Overlap queries across tracked items, bulk
   quantities, bundles, buffers, expected / temporary stock, downtime and
   shortage limits, correct under concurrent checkouts, and fast enough to
   render a month calendar per product. This is the product.
2. **Pricing.** Flat fee with round-up, tiered structures and templates,
   rulesets with date and weekday adjustments and stacking, variations,
   coupons, customer discounts, deposits by four methods, and taxes inclusive
   or exclusive, all recalculated live in the cart and the order editor.
3. **Payments.** Stripe Connect per merchant, down payments, deposit-only,
   pay later, payment links, authorize-and-capture holds with per-brand
   expiry, refunds and deposit retention, SCA.

Also non-trivial: the period picker's three modes with operating hours and
away mode; the order status machine with partial pickup / return and reverts;
a multi-tenant storefront on custom domains.

Size: **L** (about a quarter for a small team to reach the must-haves, with the
availability engine first). Not XL, because the slice excludes documents,
barcodes, the builder and mobile.

## Observed in the user's trial account (2026-11-03)

Screenshots from the user's own 14-day trial, 1440px wide, in
`replica/screens/`. Reference only, never shipped.

| file | screen | what it confirms or adds |
| --- | --- | --- |
| S02-setup-home.png | S02 | Home is an onboarding page: AI assistant prompt with 4 suggestion chips, then a 4-step guide in tabs (Add your products 0/4: tax profile, rental product, pricing, security deposits; Set up your online store; Connect apps; Accept payments), each step expandable with a CTA and a video, then mobile app promo and help links. Sidebar shows "Continue setup 0/11 completed". |
| S03-dashboard-empty.png | S03 | Two cards side by side, "Going out" and "Coming back", each with a date button (Today), Run report on the first, "No results" empty state, footer links View late / View all. Right side panel "Latest notes", toggled by a header button. |
| S05-order-editor-new.png | S05 | Breadcrumb "Bookings > New booking", status pill "new", Save as draft + overflow menu (no Reserve until a period is set, matching the docs). Cards: Client (avatar initials, name, email, remove), Information (custom fields with empty state and Add field), Pickup (billing address, From / Until date + time, Clear). Product search with inline results and per-row Add product, barcode button, Add custom line. Totals: Subtotal, Add a discount, Add a coupon, Total discount, Total incl. taxes, Security deposit with method note. Footer count "1 product / 1 item". Right sidebar of collapsible sections: Email (send, history), Documents (waiver, proposal, pull sheet), Invoices (pro forma auto-created), Payments (Payment due badge, Paid, Due, New payment), Tags. |
| S11-inventory-list.png | S11 | Tabs Products / Bundles / Collections / Downtime. Split button Add product with a dropdown. Left filter panel: Product type, Pricing structure template, Price ruleset; Import and Export at its foot. Table: checkbox, Name with thumbnail, Product type, Pricing ("Flat fee 50.00 per day"), Online store visibility button, SKU, Tags, column picker. Bulk Actions menu with "Select all". |
| S19-customers-list.png | S19 | Same list pattern as S11: search in header, primary Add button, left filters with counts (Client type, Marketing emails, Customer created, Latest order), Import / Export, Actions, table columns #, Name, Email, Created at, Latest order, Balance due, column picker. |

New findings:

- **Navigation** (left sidebar, collapsible): Continue setup, New booking,
  Dashboard, Calendar, Bookings, Clients, Inventory, Coupons, Documents,
  Online store, Apps, Reports, Ask Bo, Scan a barcode, Help, Settings, user.
- **The account uses renamed labels** ("Bookings", "Clients") where the help
  center says Orders and Customers. That is the "personalize account labels"
  setting (help 6501376): the business picks its own nouns. Added to the
  feature matrix.
- **One list pattern** serves Inventory, Clients and probably Bookings:
  header search + primary button, filter panel with Import/Export, bulk
  Actions, sortable table, column picker. Build it once.
- **The order editor is one page of cards plus a sidebar**, not a wizard.
  The sidebar is where documents and payments live.
- A pro forma invoice is created automatically with the order. Documents
  stay out of the slice, but the clone's order page needs room for them.

Second batch (2026-11-03):

| file | screen | what it confirms or adds |
| --- | --- | --- |
| S24-online-bookings-overview.png | S24 | Online bookings has three channels as cards with status pills: Booking page (Live, at `{slug}.booqableshop.com`, Connect a domain, View online store), Website builder (Offline), Website integration. Below: a 3-step "get started" list (selectable rental period, product availability, customize checkout) and link lists for branding, preview, custom domain. |
| S24a-booking-page-settings.png | S24 | Booking page settings: Status card (Live pill, URL, View online store, Actions menu) and a Customize list: link your booking page, branding, store preferences, checkout. |
| S24b-website-builder-out-of-slice.png | (skip) | Website builder: status Offline, themes (none installed), menus, pages, blog posts. Out of slice; kept for reference. |
| S35-documents-invoices-list.png | S35 | Documents list (out of slice). Same list pattern as S11 / S19 plus metric cards. |
| S36-settings-security.png | S36 | Security goes beyond 2FA: email confirmation on new devices, IP allowlist and SAML SSO (the last two marked as premium). |

Settings navigation, as seen (two groups in a second sidebar):
- Back office: General, Pricing, Taxes, Rental period, Payment providers,
  Custom fields, Locations, Emails, Documents, Translations, Security,
  Account and billing.
- Online bookings: Overview, Booking page (Status, Customize), Website
  builder, Website integration, Cross-sell, Preferences, Pickup and delivery,
  Checkout.

Settings pages share one layout: breadcrumb title, left column with a heading,
explanation and "Learn more", right column with a card of controls. Build it once.

Third and final batch (2026-11-03). The user marked the screenshot set as final.

| file | screen | what it confirms or adds |
| --- | --- | --- |
| S04-bookings-list-empty.png | S04 | Tabs All / Upcoming / Late / With shortage (default Upcoming). Metric cards Bookings, Items ordered, Revenue, Due (Hide metrics). Filters: Activity (select), Payment status with counts. Export. Primary "Add booking". Empty state "No results found for the selected filters". |
| S24c-pickup-and-delivery-settings.png | S24 | Default pickup location (Automatic or a location); delivery upsell card (deliveries app); Delivery countries multi-select (empty = all); "Require delivery address when selecting a rental period" (forced on with multiple locations, so availability is shown for the location closest to the address). |
| S37-reports-hub.png | S37 | Reports are a hub of cards grouped Business, Inventory, Customer, Coupon, Activity, Background tasks. Background tasks show results of bulk operations and generated files. |

New findings: bookings are triaged by time (Upcoming, Late) rather than by
status tabs; list metrics recompute with the filters; bulk operations and
exports run as background tasks with a results page.

## Gaps to close before /replica-design

- **More screenshots.** Captured (final set): S02, S03, S04, S05 (new), S11, S19, S24, S35, S36, S37.
  The user has closed the screenshot pass; the screens below stay documented
  from the help center only, and replica-design will design them from the
  patterns already seen (list page, settings page, card + sidebar editor).
  Not captured:
  Still needed, at 1440 wide (and 390 for the storefront): S04 bookings list,
  S05 in reserved / picked up states, S06 availability popover, S07 pickup,
  S08 return, S09 payment dialog, S10 calendar, S12-S18 product and bundle
  screens, S20 client detail, S22, S23, S25, S26, S27 settings, and the storefront S28-S34
  (open View online store; the public booking page is fine to capture).
  Save as `replica/screens/S04-....png`.
- The happy-path click counts are estimates from the docs. Count them in the
  trial.
- Not read yet: the changelog, the roadmap, the tax articles, the API sections
  on carts and inventory availabilities.
