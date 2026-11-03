# Components

Specs for every component in the recon list. Built once in `src/components/ui`
and shown together on the `/design` route. Tokens only: no raw hex or pixel
values in components (Tailwind classes map to `tokens.json`).

Measured from the reference screenshots (`replica/screens`), values chosen
fresh. Icons: Lucide (ISC licence). Font: Inter (OFL), not the original's.
Copy on every component is our own.

Status of each: **built** = in code on `/design` now; **spec** = specified
here, built during `/replica-build` with the screen that needs it.

## Layout patterns (seen on every screen)

```
App shell                                                     built
  regions   top banner (optional, 40) / sidebar 200 (collapsible to 64) / main
  main      page header 60 (panel toggle, title or breadcrumb, centred search,
            actions right) / content on bg with 24 gutter
  tokens    sidebar bg surface, border-r line; main bg bg; header bg surface, border-b line
  a11y      <nav aria-label="Main">, <main>, skip link to main, header is <header>
  mobile    under 1024 the sidebar becomes a drawer opened from a menu button in the
            header (built); under 768 the header search and filter panel hide
  used on   every back-office screen

List page                                                      built
  regions   header (title, search, primary action) / filter panel 220 (collapsible
            groups, Import / Export pinned at the bottom) / content: tabs, optional
            metric cards (Hide metrics), bulk bar, data table, result count
  used on   S04 bookings, S11 inventory, S19 clients, S35 documents

Settings page                                                  built
  regions   breadcrumb header / settings nav 220 (two groups, sub-items indent)
            / sections: left column 1/3 heading, explanation, Learn more;
            right column a card of controls with its own Save in a footer
  rule      each card saves on its own; Save stays disabled until something changed
  used on   S21-S27, S24, S36

Editor page (order)                                            spec
  regions   breadcrumb + status pill + Save as draft + overflow / grid of cards
            (customer, custom fields, period) / full-width lines card with search
            and totals / right aside 220 of collapsible sections
  used on   S05
```

## Primitives

```
Button                                                         built
  variants  primary, secondary, ghost, danger, link
  sizes     sm 32, md 40; icon-only square of the same heights
  states    default, hover, active, focus-visible (2px ring focus, 2px offset),
            disabled (50% opacity, no pointer), loading (spinner replaces icon,
            label kept, aria-busy)
  tokens    primary bg accent / text on-accent / hover accent-hover;
            secondary bg surface / border line-input / text ink;
            ghost transparent / hover accent-subtle; danger bg danger / text on-accent;
            radius md; text sm, weight 500
  a11y      real <button>; icon-only needs aria-label; loading sets aria-busy
  used on   everywhere

Split button                                                   built
  parts     primary action + chevron opening a menu (Add product / Add bundle)
  a11y      chevron is its own button with aria-label "More add options"
  used on   S11

Status pill                                                    built
  variants  success (Live, Paid, Returned), warning (Payment due, Late),
            neutral (Draft, Offline, New), accent (Reserved, Picked up), danger (Canceled, Shortage)
  sizes     sm 20, md 24
  tokens    success-pill / warning-pill / neutral-pill with on-pill; accent-subtle with accent;
            danger-subtle with danger; radius pill; text xs
  a11y      text always present; colour is never the only signal
  used on   S04, S05, S24, S35

New marker                                                     built
  dark tag pinned to a corner ("New" on new features)
  tokens    tooltip / on-tooltip, radius sm, text xs
  used on   S11, S19 column pickers, settings nav

Stock dot                                                      built
  variants  available (success), out (warning), expected (accent), in downtime (neutral), short (danger)
  a11y      paired with a text label or sr-only text
  used on   S13, S07, S05

Avatar                                                         built
  initials on a colour picked from the name (6 calm hues), sizes 24 / 32 / 40
  used on   S05, S19, sidebar user

Text input / Search input / Textarea                           built
  sizes     md 40 (sm 32 in dense tables)
  states    default, hover, focus (ring), invalid (border danger + message),
            disabled (surface-muted), read-only
  tokens    bg surface, border line-input, text ink, placeholder muted, radius md
  a11y      always a <label> (visible or sr-only); errors via aria-describedby
  used on   everywhere

Select                                                         built
  native <select> styled like the input (works with keyboard, screen readers
  and mobile pickers); a searchable combobox is a separate component
  used on   filters, settings

Checkbox, Switch, Radio group                                  built
  states    unchecked, checked, indeterminate (checkbox), focus, disabled
  tokens    border line-input, checked bg accent / on-accent, radius sm (checkbox)
  a11y      Radix primitives; Switch announces on / off
  used on   tables, filters, settings (S36 toggles)

Field                                                          built
  label (sm, 500, ink) + control + hint (xs, muted) or error (xs, danger)
  used on   all forms

Money input                                                    built
  currency symbol or code inside the field, right-aligned digits, stores cents
  used on   S09, S14, custom lines

Date and time fields                                           built (native)
  From / Until rows of date + time with a Clear action; native pickers now,
  replaced by the custom period picker below when it is built
  used on   S05

Card                                                           built
  parts     header (title lg, optional actions), body, footer (right-aligned actions)
  tokens    bg surface, border line, radius md, no shadow, padding 24 (header 20/24)
  used on   everywhere

Metric card                                                    built
  label (base, 600) + value (display) + optional info tooltip
  used on   S04, S35, reports

Tabs                                                           built
  underline style: active tab ink with 2px accent underline, others muted
  a11y      Radix Tabs (arrow keys, roving focus); or links when tabs are routes
  used on   S04, S11, S35, product editor

Data table                                                     built
  parts     select-all checkbox, sortable headers (button with aria-sort),
            rows with checkbox, row link on the name cell, column picker,
            horizontal scroll inside the card on narrow screens
  states    loading (skeleton rows), empty (empty state in the card), filtered empty,
            selected rows (accent-subtle)
  tokens    header text muted xs/500 uppercase off, row height 56, border-b line
  a11y      real <table>; the checkbox column has labelled checkboxes
  used on   S04, S11, S19, S35

Filter group                                                   built
  collapsible section with heading and chevron; contents: checkbox list with
  counts, a select, or a date range button
  used on   S04, S11, S19, S35

Bulk bar                                                       built
  Actions menu (disabled until rows are selected) + "n selected" + select all link
  used on   S11, S19

Empty state                                                    built
  icon (muted), title (base), one sentence (sm, muted), optional action
  used on   S03 panels, lists, settings cards

Dialog                                                         built
  sizes     sm 420, md 560, lg 720
  parts     title, description, body, footer (secondary left of primary)
  a11y      Radix Dialog: focus trap, Esc closes, returns focus, aria-labelledby
  used on   S07 pickup, S08 return, S09 payment, add stock, downtime, confirm

Popover                                                        built
  shadow pop, radius md, padding 16; closes on Esc and outside click
  used on   S06 availability breakdown, date range presets

Dropdown menu                                                  built
  items, separators, destructive item in danger
  used on   overflow menus, Actions, split button

Tooltip                                                        built
  dark (tooltip / on-tooltip), xs; on hover and focus; never holds the only copy
  used on   metric info icons, icon buttons

Toast                                                          built
  success / error, bottom-right, auto-dismiss 5 s (errors stay), aria-live polite
  used on   after every action

Sidebar nav                                                    built
  parts     logo slot, collapse toggle, setup progress (ring + "n/11"),
            primary action row (+ New booking), grouped items with dividers, user row
  states    default, hover (surface-muted), active (accent-subtle bg, accent text),
            collapsed (icons only, tooltips)
  a11y      aria-current="page" on the active item
  used on   all back-office screens

Banner                                                         built
  full-width strip above the app (trial notice) with one action
  tokens    bg accent, text on-accent; action secondary on accent
  used on   all screens during a trial

Link list                                                      built
  rows with icon, label, chevron; whole row is the link
  used on   S24 overview, S24a customize list, setup guide

Aside section                                                  built
  collapsible section with a drag handle icon slot, title, chevron, body
  used on   S05 aside (email, documents, payments, tags)
```

## Domain components

```
Availability label + breakdown                                 built
  label "3 left" (success text) or "2 short" (danger text) as a button that
  opens a popover: stacked bar + rows (available, expected, this order,
  other orders, within shortage limit, over limit, downtime)
  used on   S05, S06

Totals block                                                   built
  rows: subtotal, add discount (link), add coupon (link), discount, total incl. tax
  (bold, top border), deposit with its method under it
  used on   S05, S31, S32

Month calendar (availability)                                  built
  7-column month grid, keyboard navigable (arrow keys, Home/End, PageUp/Down)
  day states  available, partial (diagonal half), closed (struck number),
              unavailable (muted, not selectable), selected start / end / in-range,
              today ring
  tokens    success-pill for available, warning-pill for partial, neutral-pill
            for unavailable; accent for selection
  a11y      role=grid, aria-selected, each day labelled with date and status
  used on   S29, S30, S31

Product search results                                         spec
  combobox: input with results panel, each row thumbnail + name + availability
  + Add button; scanning a barcode fills the input
  used on   S05, bundle editor

Customer picker                                                spec
  combobox with "Create new" as the last option; selected state shows avatar,
  name, email and a remove button
  used on   S05

Order lines table                                              spec
  nested bundle rows, editable quantity, price (manual override flag),
  remove; custom line row
  used on   S05

Period picker (back office and storefront)                     spec
  steps: pickup or delivery, location, address, dates on the month calendar,
  times in increments; respects operating hours, away periods, minimum notice,
  fixed durations and time slots
  used on   S05, S30

Timeline calendar                                              spec
  resource rows (product, expandable to units) x time (day / week / month),
  bars coloured by status, buffer extensions, hover card, check-range overlay
  used on   S10

Checkout form builder                                          spec
  sortable list of fields, headings, text and images with drag handles
  used on   S25

Setup guide                                                    spec
  tabbed steps with progress, each step expandable with a CTA
  used on   S02
```

## Copy rules

- Write every label fresh. Matching what a control does is parity; matching
  its sentence is copying.
- Sentence case everywhere. Buttons are verbs ("Reserve", "Record payment").
- Empty states say what will appear and how to make it appear.
