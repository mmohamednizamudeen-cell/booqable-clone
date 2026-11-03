# Build log

One line per screen. Status is against the definition of done in the
replica-build skill. Screenshots for every built screen are in
`replica/clone-screens/` at 1440 and 390 wide.

Data layer: in memory with seed data (`src/lib/data/store.ts`), behind the
async functions the Postgres layer will implement. **Nothing persists across a
server restart yet.** `/replica-backend` swaps in Postgres (`replica/schema.sql`).

## M1 vertical slice, 2026-11-03

| ID | screen | status | missing | harder than expected |
| --- | --- | --- | --- | --- |
| shell | sidebar, header, drawer under 1024, skip link, loading and error states, stub page for every other screen | done | | |
| S03 | Today (going out, coming back, late) | done | day notes, Run report | |
| S04 | Bookings list | partial | filter panel, archived filter, column picker | |
| S05 | Booking editor | partial | assigning units before pickup in the UI, discount and coupon, payments, documents, tags, notes, duplicate | date fields overlapped at 1440 in a half-width card; now stacked |
| S07 | Hand out dialog | done | barcode scanning (out of slice) | a unit due back from another booking must stay bookable for later dates but must not be handed out until it is back: two separate rules |
| S08 | Take back dialog, deposit kept with reason | done | | |
| S11 | Inventory list | partial | bulk actions, column picker, pricing filters | |
| S12 | New product | partial | photos, variations, purchase cost | |
| S13 | Product stock (units with state, regular / arriving / temporary stock) | partial | downtime, edit a unit, stock history | |
| S14-S16 | Product settings and price (buffers, overbooking limit, store visibility) | partial | pricing structures, tax category, variations tab | |
| S19 | Customers list | partial | filters, column picker, import / export | |
| S20 | Customer detail | partial | addresses, defaults (discount, deposit, tax), revenue stats | |
| S28 | Store catalogue | partial | collections, photos, branding | a 60-character name stretched the grid at 390; fixed with an explicit column |
| S29 | Store product with availability calendar | partial | photos, variations, partial-day times | |
| S30 | Period picker | partial | pickup or delivery, location, fixed durations, time slots, operating hours, away mode | |
| S31 | Cart | partial | service toggles, coupon, cart calendar | |
| S32 | Checkout | partial | custom fields, terms, payment | after losing the race the form still offered Book now; it now refreshes and shows the item as booked out |
| S33 | Confirmation | done | confirmation email | |

Not built (stubs that say so and name the milestone): S02, S06 popover
wiring in the editor, S09, S10, S17, S18, S21-S27, S34-S37.

## Checks, 2026-11-03

- Unit tests: 32 passed (`npm test`): availability (same fixtures as
  `schema_test.sql`), pricing incl. both DST changes, booking rules, and the
  checkout race.
- End to end (`node e2e/slice.cjs` against `next start`): create a product,
  book it, reserve, hand out, take back with deposit kept; two customers race
  for the only unit: one booking, the other told it was just taken; the
  winner appears in Bookings. No console errors.
- Screens (`node e2e/screens.cjs`): 13 screens at 1440 and 390, no console
  errors, no horizontal overflow at 390, 60-character product name included.
- Keyboard: every action in the slice is a real button, link or input;
  dialogs trap focus and close on Escape; the store calendar works with arrow
  keys. Not yet run through a screen reader.
- Copy: all labels written fresh; none taken from the original.

## Known gaps worth saying out loud

- Payments are the biggest missing must-have block (Stripe Connect, links,
  holds, refunds). The booking shows what is due but cannot take money.
- Settings screens are stubs, so tax rate, deposit method and default times
  are fixed in the seed for now.
- The store is served at `/shop/{slug}`; host-based routing and custom domains
  come with deployment.
