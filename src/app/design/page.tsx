"use client";

import { useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Download,
  FileText,
  Gauge,
  Globe,
  Inbox,
  LayoutGrid,
  Package,
  Palette,
  Settings,
  Ticket,
  Upload,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill, NewMarker, StockDot, Avatar } from "@/components/ui/pill";
import { Input, Textarea, Select, SearchInput, MoneyInput, Field, Checkbox, Switch, RadioGroup, CheckboxRow } from "@/components/ui/form";
import { Card, CardHeader, CardBody, CardFooter, MetricCard, EmptyState } from "@/components/ui/card";
import { Dialog, DialogClose, Menu, SplitButton, Tooltip, ToastProvider, useToast } from "@/components/ui/overlay";
import { Tabs, DataTable, FilterGroup, FilterPanel, BulkBar, ColumnPicker, type Column } from "@/components/ui/data";
import { Banner, Sidebar, PageHeader, SettingsSection, LinkList, AsideSection } from "@/components/ui/shell";
import { AvailabilityLabel, TotalsBlock, MonthCalendar, formatMoney, type DayStatus } from "@/components/ui/domain";

type Product = { id: string; name: string; type: string; price: number; visible: boolean; sku: string };

const products: Product[] = [
  { id: "p1", name: "Mirrorless camera body", type: "Rental, tracked", price: 4500, visible: true, sku: "CAM-BODY" },
  { id: "p2", name: "Folding chair", type: "Rental, bulk", price: 300, visible: true, sku: "CHAIR-FOLD" },
  { id: "p3", name: "Delivery and setup", type: "Service", price: 7500, visible: false, sku: "SVC-DELIVER" },
];

const nav = [
  [
    { href: "/dashboard", label: "Today", icon: Gauge },
    { href: "/calendar", label: "Calendar", icon: CalendarDays },
  ],
  [
    { href: "/bookings", label: "Bookings", icon: Inbox },
    { href: "/customers", label: "Customers", icon: Users },
    { href: "/inventory", label: "Inventory", icon: Package },
    { href: "/coupons", label: "Coupons", icon: Ticket },
    { href: "/documents", label: "Documents", icon: FileText },
  ],
  [
    { href: "/store", label: "Online store", icon: Globe },
    { href: "/reports", label: "Reports", icon: BarChart3 },
    { href: "/settings", label: "Settings", icon: Settings },
  ],
];

// Fixed demo month so the page renders the same every time (and in screenshots).
const demoMonth = new Date(2027, 0, 1);
const demoStatus = (d: string): DayStatus => {
  const day = Number(d.slice(8));
  const date = new Date(d);
  if (date.getDay() === 0) return "closed";
  if ([12, 13, 14].includes(day)) return "unavailable";
  if ([11, 15].includes(day)) return "partial";
  return "available";
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="grid gap-4">
      <h2 id={`${id}-h`} className="text-xl text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Demo() {
  const toast = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(["p2"]));
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>({ key: "name", dir: "asc" });
  const [visibleCols, setVisibleCols] = useState(new Set(["type", "price", "visible", "sku"]));
  const [range, setRange] = useState<{ start?: string; end?: string }>({ start: "2027-01-05", end: "2027-01-08" });
  const [tableState, setTableState] = useState<"filled" | "loading" | "empty">("filled");

  const allColumns: Column<Product>[] = [
    { key: "name", header: "Name", sortable: true, cell: (r) => <a href={`#${r.id}`} className="font-medium text-ink hover:underline">{r.name}</a> },
    { key: "type", header: "Type", sortable: true, cell: (r) => r.type },
    { key: "price", header: "Price", align: "right", cell: (r) => `${formatMoney(r.price, "USD")} / day` },
    { key: "visible", header: "In store", cell: (r) => <StatusPill tone={r.visible ? "success" : "neutral"} size="sm">{r.visible ? "Shown" : "Hidden"}</StatusPill> },
    { key: "sku", header: "SKU", cell: (r) => <span className="font-mono text-xs">{r.sku}</span> },
  ];
  const columns = allColumns.filter((c) => c.key === "name" || visibleCols.has(c.key));
  const sorted = [...products].sort((a, b) => {
    if (!sort) return 0;
    const k = sort.key as keyof Product;
    const r = String(a[k]).localeCompare(String(b[k]));
    return sort.dir === "asc" ? r : -r;
  });

  return (
    <div className="flex h-screen flex-col">
      <Banner action={<Button size="sm" className="border-on-accent/40 bg-transparent text-on-accent hover:bg-on-accent/10">See plans</Button>}>
        Your free trial has 11 days left.
      </Banner>
      <div className="flex min-h-0 flex-1">
        <Sidebar
          groups={nav}
          current="/inventory"
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          mobileOpen={menuOpen}
          onMobileOpenChange={setMenuOpen}
          setup={{ done: 3, total: 11, href: "#setup" }}
          primary={{ href: "#new", label: "New booking" }}
          user={{ name: "Sam Rivera" }}
          logo={<span className="text-base font-semibold text-ink">Rental platform</span>}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <PageHeader
            title="Design system"
            onOpenMenu={() => setMenuOpen(true)}
            breadcrumb={["Settings"]}
            search={<SearchInput placeholder="Search components" />}
            actions={
              <SplitButton menuLabel="More add options" items={[{ label: "Add bundle" }, { label: "Import from a file" }]}>
                Add product
              </SplitButton>
            }
          />
          <main id="main" className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto grid max-w-[var(--layout-content-max)] gap-12 p-4 md:p-6">
              <p className="max-w-2xl text-sm text-body">
                Every component, in every state, built from <code className="font-mono text-xs">replica/design/tokens.json</code>. The colour
                accent is a neutral placeholder until the rebrand.
              </p>

              <Section id="colour" title="Colour roles">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                  {[
                    ["bg", "bg-bg"], ["surface", "bg-surface"], ["surface-muted", "bg-surface-muted"], ["border", "bg-line"],
                    ["border-input", "bg-line-input"], ["text", "bg-ink"], ["text-body", "bg-body"], ["text-muted", "bg-muted"],
                    ["accent", "bg-accent"], ["accent-subtle", "bg-accent-subtle"], ["danger", "bg-danger"], ["success", "bg-success"],
                    ["success-pill", "bg-success-pill"], ["warning-pill", "bg-warning-pill"], ["neutral-pill", "bg-neutral-pill"], ["tooltip", "bg-tooltip"],
                  ].map(([name, cls]) => (
                    <div key={name} className="overflow-hidden rounded-md border border-line bg-surface">
                      <div className={`h-12 ${cls}`} />
                      <p className="px-3 py-2 font-mono text-xs text-ink">{name}</p>
                    </div>
                  ))}
                </div>
              </Section>

              <Section id="type" title="Type">
                <Card>
                  <CardBody className="grid gap-3">
                    <p className="text-display text-ink">Display 28, page titles and metrics</p>
                    <p className="text-xl text-ink">Extra large 22, section headings</p>
                    <p className="text-lg text-ink">Large 18, card titles</p>
                    <p className="text-base text-ink">Base 16, emphasis and empty state titles</p>
                    <p className="text-sm text-body">Small 14, body text, navigation, tables and form controls</p>
                    <p className="text-xs text-muted">Extra small 12, hints, counts and pill labels</p>
                  </CardBody>
                </Card>
              </Section>

              <Section id="buttons" title="Buttons and pills">
                <Card>
                  <CardBody className="grid gap-6">
                    <div className="flex flex-wrap items-center gap-3">
                      <Button variant="primary">Reserve</Button>
                      <Button>Save as draft</Button>
                      <Button variant="ghost">Cancel</Button>
                      <Button variant="danger">Cancel booking</Button>
                      <Button variant="link">Read the guide</Button>
                      <Button variant="primary" loading>Saving</Button>
                      <Button variant="primary" disabled>Disabled</Button>
                      <Button size="sm">Small</Button>
                      <Tooltip content="Export as CSV">
                        <Button size="icon" aria-label="Export as CSV"><Download /></Button>
                      </Tooltip>
                      <Menu trigger={<Button>More actions</Button>} items={[{ label: "Duplicate" }, { label: "Revert to draft" }, "separator", { label: "Cancel booking", danger: true }]} />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <StatusPill tone="neutral">Draft</StatusPill>
                      <StatusPill tone="accent">Reserved</StatusPill>
                      <StatusPill tone="accent">Picked up</StatusPill>
                      <StatusPill tone="success">Returned</StatusPill>
                      <StatusPill tone="warning">Payment due</StatusPill>
                      <StatusPill tone="success">Paid</StatusPill>
                      <StatusPill tone="danger">2 short</StatusPill>
                      <StatusPill tone="success" size="sm">Live</StatusPill>
                      <StatusPill tone="neutral" size="sm">Offline</StatusPill>
                      <NewMarker />
                    </div>
                    <div className="flex flex-wrap items-center gap-6">
                      <StockDot state="available" />
                      <StockDot state="out" />
                      <StockDot state="expected" />
                      <StockDot state="downtime" />
                      <StockDot state="short" />
                      <span className="flex items-center gap-2"><Avatar name="Sam Rivera" /><Avatar name="Lee Okafor" size={40} /><Avatar name="Ana" size={24} /></span>
                    </div>
                  </CardBody>
                </Card>
              </Section>

              <Section id="forms" title="Form controls">
                <Card>
                  <CardBody className="grid gap-6 md:grid-cols-2">
                    <Field label="Product name" hint="Shown in the store and on documents.">
                      {(p) => <Input placeholder="e.g. Folding chair" {...p} />}
                    </Field>
                    <Field label="Identifier" error="This identifier is already used by another unit.">
                      {(p) => <Input defaultValue="CAM-1" {...p} />}
                    </Field>
                    <Field label="Charge per">
                      {(p) => (
                        <Select defaultValue="day" {...p}>
                          <option value="hour">Hour</option>
                          <option value="day">Day</option>
                          <option value="week">Week</option>
                        </Select>
                      )}
                    </Field>
                    <Field label="Price">{(p) => <MoneyInput valueCents={4500} currency="USD" {...p} />}</Field>
                    <Field label="Pickup date">{(p) => <Input type="date" defaultValue="2027-01-05" {...p} />}</Field>
                    <Field label="Pickup time">{(p) => <Input type="time" step={1800} defaultValue="09:00" {...p} />}</Field>
                    <Field label="Disabled">{(p) => <Input disabled value="Not editable" readOnly {...p} />}</Field>
                    <Field label="Notes for the team">{(p) => <Textarea placeholder="Anything the warehouse should know" {...p} />}</Field>
                    <div className="grid gap-3">
                      <label className="flex items-center gap-3 text-sm text-ink"><Checkbox defaultChecked /> Charge for this product</label>
                      <label className="flex items-center gap-3 text-sm text-ink"><Checkbox checked="indeterminate" /> Some rows selected</label>
                      <label className="flex items-center gap-3 text-sm text-ink"><Switch defaultChecked /> Require two-step sign-in for everyone</label>
                      <label className="flex items-center gap-3 text-sm text-muted"><Switch disabled /> Disabled switch</label>
                    </div>
                    <RadioGroup
                      defaultValue="individual"
                      aria-label="How do you track this product?"
                      options={[
                        { value: "individual", label: "Each unit separately", hint: "Serial numbers, cameras, vehicles" },
                        { value: "bulk", label: "By quantity", hint: "Chairs, cutlery, cables" },
                      ]}
                    />
                  </CardBody>
                </Card>
              </Section>

              <Section id="cards" title="Cards, metrics and empty states">
                <div className="grid gap-4 md:grid-cols-2">
                  <MetricCard label="Bookings" value="24" />
                  <MetricCard label="Still to collect" value={formatMoney(128000, "USD")} info="Unpaid amounts on bookings in this view, deposits excluded." />
                </div>
                <div className="grid gap-8 md:grid-cols-2">
                  <Card>
                    <CardHeader title="Going out" actions={<Button size="sm">This week</Button>} />
                    <EmptyState icon={Inbox} title="Nothing goes out today">Reserved bookings starting in this period show up here.</EmptyState>
                    <CardFooter className="justify-between">
                      <Button variant="link">Show overdue</Button>
                      <Button variant="link">Open bookings</Button>
                    </CardFooter>
                  </Card>
                  <Card>
                    <CardHeader title="Booking page" description="A hosted store your customers can book from." actions={<StatusPill tone="success" size="sm">Live</StatusPill>} />
                    <LinkList
                      items={[
                        { href: "#brand", label: "Logo and colours", icon: Palette },
                        { href: "#domain", label: "Use your own domain", icon: Globe },
                        { href: "#layout", label: "Store preferences", icon: LayoutGrid },
                      ]}
                    />
                  </Card>
                </div>
              </Section>

              <Section id="list" title="List page: filters, tabs, bulk actions, table">
                <div className="flex overflow-hidden rounded-md border border-line">
                  <FilterPanel
                    footer={
                      <>
                        <Button className="w-full"><Upload /> Import</Button>
                        <Button className="w-full"><Download /> Export</Button>
                      </>
                    }
                  >
                    <FilterGroup title="Payment">
                      <CheckboxRow label="Payment due" count={4} />
                      <CheckboxRow label="Partly paid" count={1} />
                      <CheckboxRow label="Paid" count={19} />
                    </FilterGroup>
                    <FilterGroup title="Product type">
                      <Select aria-label="Product type" defaultValue="all">
                        <option value="all">All types</option>
                        <option>Rental</option>
                        <option>Service</option>
                      </Select>
                    </FilterGroup>
                  </FilterPanel>
                  <div className="grid min-w-0 flex-1 content-start gap-4 bg-bg p-4 md:p-6">
                    <Tabs
                      tabs={[
                        { value: "all", label: "All" },
                        { value: "upcoming", label: "Coming up" },
                        { value: "late", label: "Overdue" },
                        { value: "short", label: "Short on stock" },
                      ]}
                      defaultValue="upcoming"
                      aside={
                        <span className="flex items-center gap-2">
                          {(["filled", "loading", "empty"] as const).map((s) => (
                            <Button key={s} size="sm" variant={tableState === s ? "primary" : "secondary"} onClick={() => setTableState(s)}>
                              {s}
                            </Button>
                          ))}
                        </span>
                      }
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <BulkBar count={selected.size} total={products.length} items={[{ label: "Show in store" }, { label: "Hide from store" }, "separator", { label: "Archive", danger: true }]} onSelectAll={() => setSelected(new Set(products.map((p) => p.id)))} />
                      <ColumnPicker columns={allColumns.filter((c) => c.key !== "name")} visible={visibleCols} onChange={setVisibleCols} />
                    </div>
                    <DataTable
                      caption="Products"
                      columns={columns}
                      rows={tableState === "empty" ? [] : sorted}
                      loading={tableState === "loading"}
                      selectable
                      selected={selected}
                      onSelectedChange={setSelected}
                      sort={sort}
                      onSortChange={setSort}
                      empty={<EmptyState icon={Package} title="No products match these filters">Clear a filter or add a product.</EmptyState>}
                    />
                  </div>
                </div>
              </Section>

              <Section id="booking" title="Booking pieces: availability, totals, aside, dialogs">
                <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_var(--layout-aside)]">
                  <Card>
                    <CardHeader title="Items" />
                    <CardBody className="grid gap-6">
                      <ul className="divide-y divide-line">
                        <li className="flex items-center justify-between gap-4 py-3">
                          <span className="grid"><span className="text-sm font-medium text-ink">Mirrorless camera body</span><AvailabilityLabel free={2} breakdown={{ available: 2, expected: 0, thisOrder: 1, otherOrders: 3, withinShortage: 0, overShortage: 0, downtime: 0 }} /></span>
                          <span className="tabular-nums text-ink">{formatMoney(13500, "USD")}</span>
                        </li>
                        <li className="flex items-center justify-between gap-4 py-3">
                          <span className="grid"><span className="text-sm font-medium text-ink">Folding chair × 60</span><AvailabilityLabel free={-2} breakdown={{ available: 0, expected: 10, thisOrder: 60, otherOrders: 40, withinShortage: 2, overShortage: 0, downtime: 0 }} onAddStock={() => toast("success", "Temporary stock form would open here.")} /></span>
                          <span className="tabular-nums text-ink">{formatMoney(18000, "USD")}</span>
                        </li>
                      </ul>
                      <div className="flex justify-end">
                        <TotalsBlock currency="USD" subtotal={31500} discount={1500} tax={6300} total={36300} deposit={20000} depositNote="Fixed amount per booking" onAddDiscount={() => {}} onAddCoupon={() => {}} />
                      </div>
                    </CardBody>
                    <CardFooter>
                      <Dialog
                        title="Hand out items"
                        description="Pick the units leaving now. You can hand out the rest later."
                        trigger={<Button>Hand out</Button>}
                        footer={
                          <>
                            <DialogClose asChild><Button>Cancel</Button></DialogClose>
                            <DialogClose asChild><Button variant="primary" onClick={() => toast("success", "3 items handed out.")}>Hand out 3 items</Button></DialogClose>
                          </>
                        }
                      >
                        <div className="grid gap-4">
                          <Field label="Camera unit">{(p) => <Select {...p}><option>CAM-1</option><option>CAM-2</option></Select>}</Field>
                          <Field label="Folding chairs" hint="60 booked">{(p) => <Input type="number" defaultValue={60} min={0} max={60} {...p} />}</Field>
                        </div>
                      </Dialog>
                      <Button variant="primary" onClick={() => toast("error", "Could not reserve: 2 chairs short and over the limit.")}>Reserve</Button>
                    </CardFooter>
                  </Card>
                  <div className="overflow-hidden rounded-md border border-line">
                    <AsideSection title="Payments" badge={<StatusPill tone="warning" size="sm">Due</StatusPill>}>
                      <div className="flex justify-between text-sm"><span>Paid</span><span className="tabular-nums text-ink">{formatMoney(0, "USD")}</span></div>
                      <div className="flex justify-between text-sm"><span>Due</span><span className="tabular-nums text-ink">{formatMoney(36300, "USD")}</span></div>
                      <Button className="mt-2 w-full">Record payment</Button>
                    </AsideSection>
                    <AsideSection title="Documents">
                      <Button size="sm" className="justify-start"><FileText /> New quote</Button>
                    </AsideSection>
                    <AsideSection title="Tags" defaultOpen={false}>
                      <Input dense placeholder="Add a tag" aria-label="Add a tag" />
                    </AsideSection>
                  </div>
                </div>
              </Section>

              <Section id="calendar" title="Storefront month calendar">
                <Card>
                  <CardBody className="flex flex-wrap gap-10">
                    <MonthCalendar month={demoMonth} today={new Date(2027, 0, 4)} status={demoStatus} value={range} onChange={setRange} />
                    <div className="grid content-start gap-2 text-sm">
                      <p className="text-ink">Selected: {range.start ?? "pick a start"} {range.end ? `to ${range.end}` : ""}</p>
                      <p className="text-muted">Sundays closed; 12 to 14 booked out; 11 and 15 partly free.</p>
                    </div>
                  </CardBody>
                </Card>
              </Section>

              <Section id="settings" title="Settings page section">
                <Card>
                  <CardBody>
                    <SettingsSection title="Two-step sign-in" description="Ask everyone on the team to confirm sign-ins with a code from an authenticator app." learnMore="#guide">
                      <Card>
                        <CardBody>
                          <label className="flex items-start gap-3">
                            <Switch className="mt-0.5" />
                            <span className="grid gap-0.5">
                              <span className="text-sm font-medium text-ink">Require it for all team members</span>
                              <span className="text-sm text-body">People without it set up are asked to do so at their next sign-in.</span>
                            </span>
                          </label>
                        </CardBody>
                        <CardFooter><Button variant="primary" disabled>Save</Button></CardFooter>
                      </Card>
                    </SettingsSection>
                    <SettingsSection title="Default pickup location" description="Where online bookings are collected when the customer does not choose.">
                      <Card>
                        <CardBody>
                          <Field label="Location">{(p) => <Select {...p}><option>Closest to the customer</option><option>Main warehouse</option></Select>}</Field>
                        </CardBody>
                        <CardFooter><Button variant="primary">Save</Button></CardFooter>
                      </Card>
                    </SettingsSection>
                  </CardBody>
                </Card>
              </Section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default function DesignPage() {
  return (
    <ToastProvider>
      <Demo />
    </ToastProvider>
  );
}
