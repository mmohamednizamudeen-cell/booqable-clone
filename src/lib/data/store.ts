// In-memory data layer with seed data. Same function signatures the Postgres
// layer (replica/schema.sql) will implement, so screens never change when it
// is swapped in. State lives on globalThis so dev-server reloads keep it.
//
// Concurrency: every mutation below runs synchronously between awaits, so a
// check-then-reserve can never interleave with another request in this
// process. The Postgres layer gets the same guarantee from advisory locks and
// the exclusion constraint (architecture.md, "races").
import { freeQuantity, NEG_INF, POS_INF, reservedRange, dayStatus, type Window } from "@/lib/engine/availability";
import { orderTotals, priceLine } from "@/lib/engine/pricing";
import { dayBounds, fromZonedInput } from "@/lib/time";
import type {
  Breakdown,
  Cart,
  Customer,
  Line,
  Order,
  OrderStatus,
  OrderView,
  Org,
  Planning,
  Product,
  StockBatch,
  StockUnit,
  UnitView,
} from "./types";
import { DomainError } from "./types";

type DB = {
  org: Org;
  products: Product[];
  units: StockUnit[];
  batches: StockBatch[];
  customers: Customer[];
  orders: Order[];
  carts: Cart[];
  counters: { order: number; customer: number };
};

let seq = 0;
const id = (p: string) => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const token = () => Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
const now = () => Date.now();
const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .slice(0, 60) || "item";

// ------------------------------------------------------------------ seed

function seed(): DB {
  const org: Org = {
    id: "org_demo",
    name: "Demo Rentals",
    slug: "demo",
    currency: "USD",
    timeZone: "America/New_York",
    settings: {
      pricesIncludeTax: false,
      taxRateBps: 800,
      depositType: "percent_of_product_value",
      depositValue: 100,
      storeLive: true,
      availabilityEnabled: true,
      defaultPickupTime: "09:00",
      defaultReturnTime: "17:00",
    },
  };
  const db: DB = { org, products: [], units: [], batches: [], customers: [], orders: [], carts: [], counters: { order: 0, customer: 0 } };

  const product = (p: Partial<Product> & Pick<Product, "name" | "productType" | "tracking" | "basePriceCents">): Product => {
    const full: Product = {
      id: id("prd"),
      slug: slugify(p.name),
      description: "",
      priceType: "flat",
      pricePeriod: "day",
      depositValueCents: 0,
      bufferBeforeSec: 0,
      bufferAfterSec: 0,
      allowShortage: false,
      shortageLimit: 0,
      showInStore: true,
      sku: slugify(p.name).toUpperCase().replace(/-/g, "_").slice(0, 20),
      createdAt: now(),
      ...p,
    };
    db.products.push(full);
    return full;
  };

  const camera = product({ name: "Mirrorless camera kit", productType: "rental", tracking: "individual", basePriceCents: 6500, depositValueCents: 50000, bufferAfterSec: 3600, description: "Full-frame body, 24-70mm lens, two batteries and a charger." });
  const tripod = product({ name: "Video tripod", productType: "rental", tracking: "individual", basePriceCents: 1800, depositValueCents: 8000, description: "Fluid head, carries up to 8 kg." });
  const speaker = product({ name: "Powered PA speaker", productType: "rental", tracking: "individual", basePriceCents: 4000, depositValueCents: 20000, description: "1000 W, with stand and cables." });
  const chair = product({ name: "Folding chair", productType: "rental", tracking: "bulk", basePriceCents: 300, depositValueCents: 1000, allowShortage: true, shortageLimit: 10, description: "White, stackable." });
  product({ name: "Delivery and setup", productType: "service", tracking: "none", priceType: "fixed", pricePeriod: undefined, basePriceCents: 7500, showInStore: false });

  for (const [p, ids] of [
    [camera, ["CAM-01", "CAM-02"]],
    [tripod, ["TRI-01", "TRI-02", "TRI-03"]],
    [speaker, ["PA-01"]],
  ] as const) {
    for (const ident of ids) db.units.push({ id: id("unit"), productId: p.id, identifier: ident, kind: "regular" });
  }
  db.batches.push({ id: id("bat"), productId: chair.id, quantity: 80, kind: "regular" });

  const customer = (name: string, email: string): Customer => {
    const c = { id: id("cus"), number: ++db.counters.customer, name, email, createdAt: now() };
    db.customers.push(c);
    return c;
  };
  const ana = customer("Ana Lima", "ana@example.com");
  const ben = customer("Ben Carter", "ben@example.com");
  customer("Studio Nine", "hello@studionine.example");

  // a few bookings around today, in the org's time zone
  const today = new Date().toISOString().slice(0, 10);
  const at = (dayOffset: number, time: string) => {
    const [d0] = dayBounds(today, org.timeZone);
    const date = new Date(d0 + dayOffset * 86_400_000 + 12 * 3_600_000).toISOString().slice(0, 10);
    return fromZonedInput(`${date}T${time}`, org.timeZone);
  };
  const order = (customerId: string, s: number, e: number, items: [Product, number][], status: OrderStatus) => {
    const o = blankOrder(db, "back_office");
    o.customerId = customerId;
    o.startsAt = s;
    o.stopsAt = e;
    for (const [p, q] of items) addLine(db, o, p, q);
    o.number = ++db.counters.order;
    if (status !== "draft") {
      o.status = "reserved";
      for (const pl of o.plannings) pl.holdsStock = true;
    } else o.status = "draft";
    if (status === "started") {
      for (const pl of o.plannings) {
        const p = db.products.find((x) => x.id === pl.productId)!;
        if (p.tracking === "individual") {
          const free = freeUnitIds(db, p.id, pl.reservedFrom, pl.reservedTill, o.id).slice(0, pl.quantity);
          pl.unitIds = free;
          pl.startedUnitIds = [...free];
        }
        pl.startedQty = pl.quantity;
      }
      o.status = "started";
    }
    db.orders.push(o);
    return o;
  };
  order(ana.id, at(0, "09:00"), at(2, "17:00"), [[camera, 1], [tripod, 1]], "reserved");
  order(ben.id, at(-2, "10:00"), at(0, "17:00"), [[speaker, 1], [chair, 40]], "started");
  order(ana.id, at(3, "09:00"), at(4, "17:00"), [[chair, 30]], "draft");
  return db;
}

declare global {
  var __rentalDb: DB | undefined;
}
const db = (): DB => (globalThis.__rentalDb ??= seed());

/** Tests only: start again from the seed. */
export async function resetForTests() {
  globalThis.__rentalDb = seed();
}

// ------------------------------------------------------------------ helpers

function blankOrder(d: DB, source: Order["source"]): Order {
  return {
    id: id("ord"),
    token: token(),
    number: null,
    status: "new",
    source,
    customerId: null,
    startsAt: null,
    stopsAt: null,
    discountPercent: 0,
    lines: [],
    plannings: [],
    depositKeptCents: 0,
    createdAt: now(),
    updatedAt: now(),
  };
}

const getProductOrThrow = (d: DB, productId: string) => {
  const p = d.products.find((x) => x.id === productId && !x.archivedAt);
  if (!p) throw new DomainError("not_found", "That product no longer exists.");
  return p;
};

const getOrderOrThrow = (d: DB, orderId: string) => {
  const o = d.orders.find((x) => x.id === orderId);
  if (!o) throw new DomainError("not_found", "That booking does not exist.");
  return o;
};

function stockWindows(d: DB, productId: string): Window[] {
  const p = d.products.find((x) => x.id === productId);
  if (!p) return [];
  const src = p.tracking === "individual" ? d.units.filter((u) => u.productId === productId).map((u) => ({ ...u, quantity: 1 })) : d.batches.filter((b) => b.productId === productId);
  return src.filter((s) => !s.archivedAt).map((s) => ({ qty: s.quantity, from: s.availableFrom ?? NEG_INF, till: s.availableTill ?? POS_INF }));
}

function holdWindows(d: DB, productId: string, excludeOrderId?: string): Window[] {
  const out: Window[] = [];
  for (const o of d.orders) {
    if (o.id === excludeOrderId) continue;
    for (const pl of o.plannings) {
      if (pl.productId !== productId || !pl.holdsStock) continue;
      const qty = pl.quantity - pl.stoppedQty;
      if (qty > 0) out.push({ qty, from: pl.reservedFrom, till: pl.reservedTill });
    }
  }
  return out;
}

/** Units of a tracked product not held by any other booking over [from, till). */
function freeUnitIds(d: DB, productId: string, from: number, till: number, excludeOrderId?: string): string[] {
  const busy = new Set<string>();
  for (const o of d.orders) {
    for (const pl of o.plannings) {
      if (pl.productId !== productId) continue;
      // A unit that is out right now but due back before [from, till) is free
      // for planning; pickup() separately refuses to hand out a unit that has
      // not come back yet.
      if (o.id === excludeOrderId || !pl.holdsStock) continue;
      if (pl.reservedFrom < till && pl.reservedTill > from) for (const u of pl.unitIds) if (!pl.stoppedUnitIds.includes(u)) busy.add(u);
    }
  }
  return d.units
    .filter((u) => u.productId === productId && !u.archivedAt && (u.availableFrom ?? NEG_INF) <= from && (u.availableTill ?? POS_INF) >= till && !busy.has(u.id))
    .map((u) => u.id);
}

function reprice(d: DB, o: Order) {
  for (const l of o.lines) {
    if (l.custom || !l.productId) continue;
    const p = d.products.find((x) => x.id === l.productId);
    if (!p) continue;
    const r = priceLine(p, o.startsAt ?? undefined, o.stopsAt ?? undefined, d.org.timeZone);
    l.priceEachCents = r.priceEachCents;
    l.chargeLabel = r.chargeLabel;
  }
}

function replan(d: DB, o: Order) {
  for (const pl of o.plannings) {
    const p = d.products.find((x) => x.id === pl.productId)!;
    if (o.startsAt === null || o.stopsAt === null) continue;
    const r = reservedRange(o.startsAt, o.stopsAt, p.bufferBeforeSec, p.bufferAfterSec);
    pl.reservedFrom = r.from;
    pl.reservedTill = r.till;
  }
}

function addLine(d: DB, o: Order, p: Product, qty: number) {
  const line: Line = { id: id("lin"), productId: p.id, title: p.name, quantity: qty, priceEachCents: 0, chargeLabel: "" };
  o.lines.push(line);
  if (p.productType === "rental") {
    const s = o.startsAt ?? now();
    const e = o.stopsAt ?? s + 86_400_000;
    const r = reservedRange(s, e, p.bufferBeforeSec, p.bufferAfterSec);
    o.plannings.push({
      id: id("pln"),
      lineId: line.id,
      productId: p.id,
      quantity: qty,
      reservedFrom: r.from,
      reservedTill: r.till,
      holdsStock: o.status === "reserved" || o.status === "started",
      startedQty: 0,
      stoppedQty: 0,
      unitIds: [],
      startedUnitIds: [],
      stoppedUnitIds: [],
    });
  }
  reprice(d, o);
  return line;
}

/** Shortages for an order's lines if it held stock for its current dates. */
function checkShortages(d: DB, o: Order) {
  const out: { productId: string; title: string; short: number; overLimit: boolean }[] = [];
  const byProduct = new Map<string, number>();
  for (const pl of o.plannings) byProduct.set(pl.productId, (byProduct.get(pl.productId) ?? 0) + pl.quantity - pl.stoppedQty);
  for (const [productId, need] of byProduct) {
    if (need <= 0) continue;
    const p = d.products.find((x) => x.id === productId)!;
    const pl = o.plannings.find((x) => x.productId === productId)!;
    const free = freeQuantity(stockWindows(d, productId), holdWindows(d, productId, o.id), pl.reservedFrom, pl.reservedTill);
    const short = need - free;
    if (short > 0) out.push({ productId, title: p.name, short, overLimit: !p.allowShortage || short > p.shortageLimit });
  }
  // specified units must not be held elsewhere
  for (const pl of o.plannings) {
    if (!pl.unitIds.length) continue;
    const free = new Set(freeUnitIds(d, pl.productId, pl.reservedFrom, pl.reservedTill, o.id));
    const clash = pl.unitIds.filter((u) => !free.has(u) && !pl.startedUnitIds.includes(u));
    if (clash.length) {
      const p = d.products.find((x) => x.id === pl.productId)!;
      out.push({ productId: p.id, title: `${p.name} (${clash.map((u) => d.units.find((x) => x.id === u)?.identifier).join(", ")})`, short: clash.length, overLimit: true });
    }
  }
  return out;
}

function view(d: DB, o: Order): OrderView {
  const customer = d.customers.find((c) => c.id === o.customerId) ?? null;
  const totals = orderTotals({
    lines: o.lines.map((l) => {
      const p = l.productId ? d.products.find((x) => x.id === l.productId) : undefined;
      return { quantity: l.quantity, priceEachCents: l.priceEachCents, depositValueCents: p?.depositValueCents ?? 0, isRental: p?.productType === "rental", taxable: true };
    }),
    discountPercent: o.discountPercent,
    taxRateBps: d.org.settings.taxRateBps,
    pricesIncludeTax: d.org.settings.pricesIncludeTax,
    depositType: d.org.settings.depositType,
    depositValue: d.org.settings.depositValue,
  });
  const qty = o.plannings.reduce((s, p) => s + p.quantity, 0);
  const started = o.plannings.reduce((s, p) => s + p.startedQty, 0);
  const stopped = o.plannings.reduce((s, p) => s + p.stoppedQty, 0);
  const fulfillment: OrderView["fulfillment"] =
    started === 0 ? "none" : stopped === 0 ? (started < qty ? "partially_started" : "started") : stopped < qty ? "partially_stopped" : "stopped";
  const t = now();
  const late =
    o.status === "reserved" && o.startsAt !== null && o.startsAt < t
      ? "pickup"
      : o.status === "started" && o.stopsAt !== null && o.stopsAt < t && stopped < started
        ? "return"
        : null;
  const holding = o.status === "reserved" || o.status === "started";
  return {
    ...structuredClone(o),
    customer,
    totals,
    fulfillment,
    paymentStatus: totals.total === 0 ? "paid" : "payment_due",
    late,
    shortages: holding ? checkShortages(d, o).map(({ productId, title, short }) => ({ productId, title, short })) : [],
  };
}

// ------------------------------------------------------------------ org

export async function getOrg(): Promise<Org> {
  return structuredClone(db().org);
}

export async function getOrgBySlug(slug: string): Promise<Org | null> {
  return db().org.slug === slug ? structuredClone(db().org) : null;
}

// ------------------------------------------------------------------ products and stock

export type ProductRow = Product & { stockCount: number };

export async function listProducts(filter: { q?: string; type?: string; storeOnly?: boolean } = {}): Promise<ProductRow[]> {
  const d = db();
  const q = filter.q?.trim().toLowerCase();
  return d.products
    .filter((p) => !p.archivedAt)
    .filter((p) => !filter.type || p.productType === filter.type)
    .filter((p) => !filter.storeOnly || p.showInStore)
    .filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
    .map((p) => ({ ...structuredClone(p), stockCount: stockWindows(d, p.id).filter((w) => w.from === NEG_INF && w.till === POS_INF).reduce((s, w) => s + w.qty, 0) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getProduct(productId: string): Promise<Product | null> {
  const p = db().products.find((x) => x.id === productId && !x.archivedAt);
  return p ? structuredClone(p) : null;
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const p = db().products.find((x) => x.slug === slug && !x.archivedAt);
  return p ? structuredClone(p) : null;
}

export type NewProduct = Pick<Product, "name" | "productType" | "tracking" | "priceType" | "pricePeriod" | "basePriceCents" | "depositValueCents" | "description"> &
  Partial<Pick<Product, "bufferBeforeSec" | "bufferAfterSec" | "allowShortage" | "shortageLimit" | "showInStore" | "sku">>;

export async function createProduct(input: NewProduct): Promise<Product> {
  const d = db();
  const name = input.name.trim();
  if (!name) throw new DomainError("invalid", "Give the product a name.");
  if (name.length > 200) throw new DomainError("invalid", "Keep the name under 200 characters.");
  if (input.productType === "rental" && input.tracking === "none") throw new DomainError("invalid", "Choose how this rental is tracked.");
  if (input.productType !== "rental" && input.tracking !== "none") throw new DomainError("invalid", "Only rental products are tracked.");
  if (input.basePriceCents < 0) throw new DomainError("invalid", "The price cannot be negative.");
  let slug = slugify(name);
  while (d.products.some((p) => p.slug === slug && !p.archivedAt)) slug = `${slug}-${Math.floor(Math.random() * 900 + 100)}`;
  const p: Product = {
    id: id("prd"),
    slug,
    bufferBeforeSec: 0,
    bufferAfterSec: 0,
    allowShortage: false,
    shortageLimit: 0,
    showInStore: true,
    sku: slug.toUpperCase().replace(/-/g, "_").slice(0, 20),
    createdAt: now(),
    ...input,
    name,
  };
  d.products.push(p);
  return structuredClone(p);
}

export async function updateProduct(productId: string, patch: Partial<Omit<Product, "id" | "productType" | "tracking" | "createdAt">>): Promise<Product> {
  const d = db();
  const p = getProductOrThrow(d, productId);
  if (patch.name !== undefined && !patch.name.trim()) throw new DomainError("invalid", "Give the product a name.");
  Object.assign(p, patch);
  return structuredClone(p);
}

export async function addStockUnits(productId: string, identifiers: string[], window: { availableFrom?: number; availableTill?: number } = {}): Promise<StockUnit[]> {
  const d = db();
  const p = getProductOrThrow(d, productId);
  if (p.tracking !== "individual") throw new DomainError("invalid", "This product is tracked by quantity.");
  const clean = identifiers.map((s) => s.trim()).filter(Boolean);
  if (!clean.length) throw new DomainError("invalid", "Add at least one identifier.");
  const taken = new Set(d.units.filter((u) => !u.archivedAt).map((u) => u.identifier.toLowerCase()));
  const dupes = clean.filter((s, i) => taken.has(s.toLowerCase()) || clean.findIndex((x) => x.toLowerCase() === s.toLowerCase()) !== i);
  if (dupes.length) throw new DomainError("invalid", `Already in use: ${[...new Set(dupes)].join(", ")}.`);
  const kind = window.availableTill ? "temporary" : "regular";
  const made = clean.map((identifier) => ({ id: id("unit"), productId, identifier, kind, ...window }) as StockUnit);
  d.units.push(...made);
  return structuredClone(made);
}

export async function addStockQuantity(productId: string, quantity: number, window: { availableFrom?: number; availableTill?: number } = {}): Promise<StockBatch> {
  const d = db();
  const p = getProductOrThrow(d, productId);
  if (p.tracking !== "bulk") throw new DomainError("invalid", "This product is tracked unit by unit.");
  if (!Number.isInteger(quantity) || quantity < 1) throw new DomainError("invalid", "Enter a whole number of 1 or more.");
  const b: StockBatch = { id: id("bat"), productId, quantity, kind: window.availableTill ? "temporary" : "regular", ...window };
  d.batches.push(b);
  return structuredClone(b);
}

export async function archiveUnit(unitId: string): Promise<void> {
  const d = db();
  const u = d.units.find((x) => x.id === unitId);
  if (!u) throw new DomainError("not_found", "That unit no longer exists.");
  const t = now();
  const held = d.orders.some((o) => o.plannings.some((pl) => pl.holdsStock && pl.reservedTill > t && pl.unitIds.includes(u.id) && !pl.stoppedUnitIds.includes(u.id)));
  if (held) throw new DomainError("conflict", "This unit is on a current or upcoming booking. Swap it out first.");
  u.archivedAt = t;
}

export async function productStock(productId: string): Promise<{ units: UnitView[]; batches: StockBatch[]; total: number; out: number }> {
  const d = db();
  const p = getProductOrThrow(d, productId);
  const t = now();
  const units: UnitView[] = d.units
    .filter((u) => u.productId === productId && !u.archivedAt)
    .map((u) => {
      let state: UnitView["state"] = "available";
      let heldBy: UnitView["heldBy"];
      if (u.availableFrom && u.availableFrom > t) state = "expected";
      if (u.availableTill && u.availableTill <= t) state = "expired";
      for (const o of d.orders) {
        const pl = o.plannings.find((x) => x.startedUnitIds.includes(u.id) && !x.stoppedUnitIds.includes(u.id));
        if (pl) {
          state = o.stopsAt !== null && o.stopsAt < t ? "overdue" : "out";
          heldBy = { orderId: o.id, number: o.number };
        }
      }
      return { ...structuredClone(u), state, heldBy };
    })
    .sort((a, b) => a.identifier.localeCompare(b.identifier, undefined, { numeric: true }));
  const batches = structuredClone(d.batches.filter((b) => b.productId === productId && !b.archivedAt));
  const total = p.tracking === "individual" ? units.filter((u) => u.kind === "regular").length : batches.filter((b) => b.kind === "regular").reduce((s, b) => s + b.quantity, 0);
  const out =
    p.tracking === "individual"
      ? units.filter((u) => u.state === "out" || u.state === "overdue").length
      : d.orders.reduce((s, o) => s + o.plannings.filter((pl) => pl.productId === productId).reduce((x, pl) => x + pl.startedQty - pl.stoppedQty, 0), 0);
  return { units, batches, total, out };
}

/** Free units of a product over [from, till), with the popover breakdown. */
export async function availability(productId: string, from: number, till: number, orderId?: string): Promise<{ free: number; breakdown: Breakdown }> {
  const d = db();
  const p = getProductOrThrow(d, productId);
  const stock = stockWindows(d, productId);
  const others = holdWindows(d, productId, orderId);
  const free = freeQuantity(stock, others, from, till);
  const thisOrder = orderId
    ? getOrderOrThrow(d, orderId)
        .plannings.filter((pl) => pl.productId === productId)
        .reduce((s, pl) => s + pl.quantity - pl.stoppedQty, 0)
    : 0;
  const expected = stock.filter((w) => w.from > from && w.from < till).reduce((s, w) => s + w.qty, 0);
  const otherOrders = others.filter((w) => w.from < till && w.till > from).reduce((s, w) => s + w.qty, 0);
  const remaining = free - thisOrder;
  const short = Math.max(0, -remaining);
  const within = p.allowShortage ? Math.min(short, p.shortageLimit) : 0;
  return {
    free: remaining,
    breakdown: { available: Math.max(0, remaining), expected, thisOrder, otherOrders, withinShortage: within, overShortage: short - within, downtime: 0 },
  };
}

/** Per-day status for a month, for the storefront calendar. */
export async function monthAvailability(productId: string, year: number, month: number, qty = 1): Promise<Record<string, "available" | "partial" | "unavailable">> {
  const d = db();
  getProductOrThrow(d, productId);
  const stock = stockWindows(d, productId);
  const holds = holdWindows(d, productId);
  const out: Record<string, "available" | "partial" | "unavailable"> = {};
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let day = 1; day <= days; day++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const [s, e] = dayBounds(date, d.org.timeZone);
    const st = dayStatus(stock, holds, s, e, qty);
    out[date] = st === "closed" ? "unavailable" : st;
  }
  return out;
}

// ------------------------------------------------------------------ customers

export type CustomerRow = Customer & { orderCount: number; latestOrderAt: number | null; balanceDueCents: number };

export async function listCustomers(q?: string): Promise<CustomerRow[]> {
  const d = db();
  const s = q?.trim().toLowerCase();
  return d.customers
    .filter((c) => !s || c.name.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s))
    .map((c) => {
      const orders = d.orders.filter((o) => o.customerId === c.id && o.status !== "new" && o.status !== "canceled");
      return {
        ...structuredClone(c),
        orderCount: orders.length,
        latestOrderAt: orders.length ? Math.max(...orders.map((o) => o.createdAt)) : null,
        balanceDueCents: orders.filter((o) => o.status !== "draft").reduce((s2, o) => s2 + view(d, o).totals.total, 0),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCustomer(customerId: string): Promise<Customer | null> {
  const c = db().customers.find((x) => x.id === customerId);
  return c ? structuredClone(c) : null;
}

export async function createCustomer(input: { name: string; email?: string; phone?: string }): Promise<Customer> {
  const d = db();
  const name = input.name.trim();
  if (!name) throw new DomainError("invalid", "Enter the customer's name.");
  const email = input.email?.trim().toLowerCase() || undefined;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DomainError("invalid", "That email address does not look right.");
  const c: Customer = { id: id("cus"), number: ++d.counters.customer, name, email, phone: input.phone?.trim() || undefined, createdAt: now() };
  d.customers.push(c);
  return structuredClone(c);
}

// ------------------------------------------------------------------ orders

export type OrderTab = "all" | "upcoming" | "late" | "shortage";

export async function listOrders(filter: { tab?: OrderTab; q?: string; status?: OrderStatus; customerId?: string } = {}): Promise<OrderView[]> {
  const d = db();
  const q = filter.q?.trim().toLowerCase();
  const t = now();
  return d.orders
    .filter((o) => o.status !== "new")
    .map((o) => view(d, o))
    .filter((o) => !filter.customerId || o.customerId === filter.customerId)
    .filter((o) => !filter.status || o.status === filter.status)
    .filter((o) => {
      switch (filter.tab) {
        case "upcoming":
          return (o.status === "reserved" || o.status === "draft") && (o.startsAt ?? Infinity) >= t - 86_400_000;
        case "late":
          return o.late !== null;
        case "shortage":
          return o.shortages.length > 0;
        default:
          return o.status !== "archived" || filter.status === "archived";
      }
    })
    .filter((o) => !q || String(o.number) === q || o.customer?.name.toLowerCase().includes(q) || o.customer?.email?.toLowerCase().includes(q))
    .sort((a, b) => (a.startsAt ?? Infinity) - (b.startsAt ?? Infinity));
}

export async function getOrder(orderId: string): Promise<OrderView | null> {
  const d = db();
  const o = d.orders.find((x) => x.id === orderId);
  return o ? view(d, o) : null;
}

export async function getOrderByToken(t: string): Promise<OrderView | null> {
  const d = db();
  const o = d.orders.find((x) => x.token === t);
  return o ? view(d, o) : null;
}

/** The single unsaved booking for the back office, reused like a scratch pad. */
export async function newOrder(): Promise<OrderView> {
  const d = db();
  let o = d.orders.find((x) => x.status === "new" && x.source === "back_office");
  if (!o) {
    o = blankOrder(d, "back_office");
    d.orders.push(o);
  }
  return view(d, o);
}

const editable = (o: Order) => {
  if (o.status === "archived" || o.status === "canceled") throw new DomainError("invalid", "Archived and canceled bookings cannot be changed.");
};

export async function setOrderCustomer(orderId: string, customerId: string | null): Promise<OrderView> {
  const d = db();
  const o = getOrderOrThrow(d, orderId);
  editable(o);
  if (customerId && !d.customers.some((c) => c.id === customerId)) throw new DomainError("not_found", "That customer does not exist.");
  o.customerId = customerId;
  o.updatedAt = now();
  return view(d, o);
}

export async function setOrderPeriod(orderId: string, startsAt: number, stopsAt: number, opts: { confirmShortage?: boolean } = {}): Promise<OrderView> {
  const d = db();
  const o = getOrderOrThrow(d, orderId);
  editable(o);
  if (!(stopsAt > startsAt)) throw new DomainError("invalid", "The return has to be after the pickup.");
  if (o.status === "started" && startsAt !== o.startsAt) throw new DomainError("invalid", "Items are already out, so only the return can move.");
  const before = { s: o.startsAt, e: o.stopsAt, plans: o.plannings.map((p) => ({ ...p })) };
  o.startsAt = startsAt;
  o.stopsAt = stopsAt;
  replan(d, o);
  if (o.status === "reserved" || o.status === "started") {
    const short = checkShortages(d, o);
    const blocking = short.filter((s) => s.overLimit);
    if (blocking.length || (short.length && !opts.confirmShortage)) {
      o.startsAt = before.s;
      o.stopsAt = before.e;
      o.plannings = before.plans;
      if (blocking.length) throw new DomainError("unavailable", `Not enough stock for the new dates: ${blocking.map((s) => `${s.title} (${s.short} short)`).join(", ")}.`, blocking);
      throw new DomainError("shortage_warning", `The new dates leave ${short.map((s) => `${s.title} ${s.short} short`).join(", ")}. Confirm to accept the shortage.`, short);
    }
  }
  reprice(d, o);
  o.updatedAt = now();
  return view(d, o);
}

export async function addOrderItem(orderId: string, productId: string, quantity: number, opts: { confirmShortage?: boolean } = {}): Promise<OrderView> {
  const d = db();
  const o = getOrderOrThrow(d, orderId);
  editable(o);
  const p = getProductOrThrow(d, productId);
  if (!Number.isInteger(quantity) || quantity < 1) throw new DomainError("invalid", "Enter a quantity of 1 or more.");
  const existing = o.lines.find((l) => l.productId === productId && !l.custom);
  if (existing) {
    return setLineQuantity(orderId, existing.id, existing.quantity + quantity, opts);
  }
  addLine(d, o, p, quantity);
  if (o.status === "reserved" || o.status === "started") {
    const short = checkShortages(d, o).filter((s) => s.productId === productId);
    if (short.some((s) => s.overLimit) || (short.length && !opts.confirmShortage)) {
      const line = o.lines.pop()!;
      o.plannings = o.plannings.filter((pl) => pl.lineId !== line.id);
      if (short.some((s) => s.overLimit)) throw new DomainError("unavailable", `Only ${quantity - short[0]!.short} ${p.name} free for these dates.`, short);
      throw new DomainError("shortage_warning", `${p.name} would be ${short[0]!.short} short. Confirm to accept the shortage.`, short);
    }
  }
  o.updatedAt = now();
  return view(d, o);
}

export async function addCustomLine(orderId: string, title: string, priceEachCents: number, quantity = 1): Promise<OrderView> {
  const d = db();
  const o = getOrderOrThrow(d, orderId);
  editable(o);
  if (!title.trim()) throw new DomainError("invalid", "Describe the charge.");
  o.lines.push({ id: id("lin"), title: title.trim(), quantity, priceEachCents, chargeLabel: "", custom: true });
  o.updatedAt = now();
  return view(d, o);
}

export async function setLineQuantity(orderId: string, lineId: string, quantity: number, opts: { confirmShortage?: boolean } = {}): Promise<OrderView> {
  const d = db();
  const o = getOrderOrThrow(d, orderId);
  editable(o);
  const l = o.lines.find((x) => x.id === lineId);
  if (!l) throw new DomainError("not_found", "That line is gone.");
  if (!Number.isInteger(quantity) || quantity < 1) throw new DomainError("invalid", "Enter a quantity of 1 or more, or remove the line.");
  const pl = o.plannings.find((x) => x.lineId === lineId);
  if (pl && quantity < pl.startedQty) throw new DomainError("invalid", `${pl.startedQty} are already out. Return them before lowering the quantity.`);
  if (pl && quantity < pl.unitIds.length) throw new DomainError("invalid", "Remove assigned units before lowering the quantity.");
  const prev = l.quantity;
  l.quantity = quantity;
  if (pl) pl.quantity = quantity;
  if (pl && quantity > prev && (o.status === "reserved" || o.status === "started")) {
    const short = checkShortages(d, o).filter((s) => s.productId === pl.productId);
    if (short.some((s) => s.overLimit) || (short.length && !opts.confirmShortage)) {
      l.quantity = prev;
      pl.quantity = prev;
      if (short.some((s) => s.overLimit)) throw new DomainError("unavailable", `Not enough ${l.title} free for these dates.`, short);
      throw new DomainError("shortage_warning", `${l.title} would be ${short[0]!.short} short. Confirm to accept the shortage.`, short);
    }
  }
  o.updatedAt = now();
  return view(d, o);
}

export async function removeLine(orderId: string, lineId: string): Promise<OrderView> {
  const d = db();
  const o = getOrderOrThrow(d, orderId);
  editable(o);
  const pl = o.plannings.find((x) => x.lineId === lineId);
  if (pl && pl.startedQty > pl.stoppedQty) throw new DomainError("invalid", "Some of these are still out. Take them back first.");
  o.lines = o.lines.filter((l) => l.id !== lineId);
  o.plannings = o.plannings.filter((p) => p.lineId !== lineId);
  o.updatedAt = now();
  return view(d, o);
}

/** Assign or swap the exact units on a tracked line. */
export async function assignUnits(orderId: string, lineId: string, unitIds: string[]): Promise<OrderView> {
  const d = db();
  const o = getOrderOrThrow(d, orderId);
  editable(o);
  const pl = o.plannings.find((x) => x.lineId === lineId);
  if (!pl) throw new DomainError("not_found", "That line has no stock to assign.");
  if (unitIds.length > pl.quantity) throw new DomainError("invalid", `This line needs ${pl.quantity}, not ${unitIds.length}.`);
  const free = new Set(freeUnitIds(d, pl.productId, pl.reservedFrom, pl.reservedTill, o.id));
  const bad = unitIds.filter((u) => !free.has(u) && !pl.startedUnitIds.includes(u));
  if (bad.length) throw new DomainError("unavailable", `Already booked for these dates: ${bad.map((u) => d.units.find((x) => x.id === u)?.identifier ?? u).join(", ")}.`);
  pl.unitIds = [...new Set([...pl.startedUnitIds, ...unitIds])];
  o.updatedAt = now();
  return view(d, o);
}

export async function freeUnitsFor(orderId: string, lineId: string): Promise<{ id: string; identifier: string }[]> {
  const d = db();
  const o = getOrderOrThrow(d, orderId);
  const pl = o.plannings.find((x) => x.lineId === lineId);
  if (!pl) return [];
  const free = new Set(freeUnitIds(d, pl.productId, pl.reservedFrom, pl.reservedTill, o.id));
  return d.units.filter((u) => free.has(u.id) || pl.unitIds.includes(u.id)).map((u) => ({ id: u.id, identifier: u.identifier }));
}

export type Transition = "draft" | "reserved" | "archived" | "canceled" | "revert";

export async function transition(orderId: string, to: Transition, opts: { confirmShortage?: boolean } = {}): Promise<OrderView> {
  const d = db();
  const o = getOrderOrThrow(d, orderId);
  const assignNumber = () => {
    if (o.number === null) o.number = ++d.counters.order;
  };
  switch (to) {
    case "draft":
      if (o.status !== "new") throw new DomainError("invalid", "Only a new booking can be saved as a draft.");
      assignNumber();
      o.status = "draft";
      break;
    case "reserved": {
      if (o.status !== "new" && o.status !== "draft") throw new DomainError("invalid", "This booking is already past reservation.");
      if (o.startsAt === null || o.stopsAt === null) throw new DomainError("invalid", "Pick the rental period first.");
      if (!o.lines.length) throw new DomainError("invalid", "Add at least one item first.");
      const short = checkShortages(d, o);
      const blocking = short.filter((s) => s.overLimit);
      if (blocking.length) throw new DomainError("unavailable", `Not enough stock: ${blocking.map((s) => `${s.title} (${s.short} short)`).join(", ")}.`, blocking);
      if (short.length && !opts.confirmShortage)
        throw new DomainError("shortage_warning", `${short.map((s) => `${s.title} ${s.short} short`).join(", ")}, within the allowed shortage. Reserve anyway?`, short);
      assignNumber();
      for (const pl of o.plannings) pl.holdsStock = true;
      o.status = "reserved";
      break;
    }
    case "revert":
      if (o.status === "reserved") {
        for (const pl of o.plannings) pl.holdsStock = false;
        o.status = "draft";
      } else if (o.status === "archived") {
        o.status = "stopped";
      } else throw new DomainError("invalid", "There is nothing to revert to from here.");
      break;
    case "archived":
      if (o.status !== "stopped" && o.status !== "draft") throw new DomainError("invalid", "Archive a booking once everything is back.");
      o.status = "archived";
      break;
    case "canceled":
      if (o.status === "canceled" || o.status === "archived") throw new DomainError("invalid", "This booking is already closed.");
      if (o.plannings.some((pl) => pl.startedQty > pl.stoppedQty)) throw new DomainError("invalid", "Items are still out. Take them back before canceling.");
      for (const pl of o.plannings) pl.holdsStock = false;
      if (o.status === "new") {
        d.orders = d.orders.filter((x) => x.id !== o.id);
        return view(d, o);
      }
      o.status = "canceled";
      break;
  }
  o.updatedAt = now();
  return view(d, o);
}

export type HandItem = { lineId: string; quantity?: number; unitIds?: string[] };

export async function pickup(orderId: string, items: HandItem[]): Promise<OrderView> {
  const d = db();
  const o = getOrderOrThrow(d, orderId);
  if (o.status !== "reserved" && o.status !== "started") throw new DomainError("invalid", "Reserve the booking before handing items out.");
  // validate everything first, then apply, so a bad item changes nothing
  const plan: { pl: Planning; qty: number; units: string[] }[] = [];
  for (const it of items) {
    const pl = o.plannings.find((x) => x.lineId === it.lineId);
    if (!pl) throw new DomainError("not_found", "One of the items is no longer on this booking.");
    const p = d.products.find((x) => x.id === pl.productId)!;
    const remaining = pl.quantity - pl.startedQty;
    if (p.tracking === "individual") {
      const units = it.unitIds ?? [];
      if (units.length > remaining) throw new DomainError("invalid", `${p.name}: only ${remaining} left to hand out.`);
      const free = new Set(freeUnitIds(d, p.id, pl.reservedFrom, pl.reservedTill, o.id));
      const bad = units.filter((u) => !free.has(u) && !pl.unitIds.includes(u));
      if (bad.length) throw new DomainError("unavailable", `${p.name}: ${bad.map((u) => d.units.find((x) => x.id === u)?.identifier).join(", ")} is not free.`);
      const out = units.filter((u) => d.orders.some((x) => x.plannings.some((y) => y.startedUnitIds.includes(u) && !y.stoppedUnitIds.includes(u))));
      if (out.length) throw new DomainError("unavailable", `${out.map((u) => d.units.find((x) => x.id === u)?.identifier).join(", ")} has not come back from another booking yet.`);
      if (units.length) plan.push({ pl, qty: units.length, units });
    } else {
      const qty = it.quantity ?? 0;
      if (!Number.isInteger(qty) || qty < 0 || qty > remaining) throw new DomainError("invalid", `${p.name}: enter 0 to ${remaining}.`);
      if (qty) plan.push({ pl, qty, units: [] });
    }
  }
  if (!plan.length) throw new DomainError("invalid", "Choose at least one item to hand out.");
  for (const { pl, qty, units } of plan) {
    pl.startedQty += qty;
    pl.startedUnitIds.push(...units);
    pl.unitIds = [...new Set([...pl.unitIds, ...units])];
  }
  o.status = "started";
  o.updatedAt = now();
  return view(d, o);
}

export async function returnItems(orderId: string, items: HandItem[], deposit: { keptCents?: number; reason?: string } = {}): Promise<OrderView> {
  const d = db();
  const o = getOrderOrThrow(d, orderId);
  if (o.status !== "started") throw new DomainError("invalid", "Nothing is out on this booking.");
  const plan: { pl: Planning; qty: number; units: string[] }[] = [];
  for (const it of items) {
    const pl = o.plannings.find((x) => x.lineId === it.lineId);
    if (!pl) throw new DomainError("not_found", "One of the items is no longer on this booking.");
    const out = pl.startedQty - pl.stoppedQty;
    const p = d.products.find((x) => x.id === pl.productId)!;
    if (p.tracking === "individual") {
      const units = (it.unitIds ?? []).filter((u) => pl.startedUnitIds.includes(u) && !pl.stoppedUnitIds.includes(u));
      if (units.length) plan.push({ pl, qty: units.length, units });
    } else {
      const qty = it.quantity ?? 0;
      if (!Number.isInteger(qty) || qty < 0 || qty > out) throw new DomainError("invalid", `${p.name}: enter 0 to ${out}.`);
      if (qty) plan.push({ pl, qty, units: [] });
    }
  }
  if (!plan.length) throw new DomainError("invalid", "Choose at least one item to take back.");
  const kept = deposit.keptCents ?? 0;
  if (kept < 0) throw new DomainError("invalid", "The kept amount cannot be negative.");
  if (kept > 0 && !deposit.reason?.trim()) throw new DomainError("invalid", "Say why part of the deposit is kept.");
  for (const { pl, qty, units } of plan) {
    pl.stoppedQty += qty;
    pl.stoppedUnitIds.push(...units);
  }
  if (kept > 0) {
    o.depositKeptCents += kept;
    o.depositKeptReason = [o.depositKeptReason, deposit.reason!.trim()].filter(Boolean).join("; ");
  }
  const allBack = o.plannings.every((pl) => pl.stoppedQty === pl.quantity);
  if (allBack) {
    o.status = "stopped";
    for (const pl of o.plannings) pl.holdsStock = false;
  }
  o.updatedAt = now();
  return view(d, o);
}

// ------------------------------------------------------------------ dashboard

export async function dashboard(from: number, till: number): Promise<{ goingOut: OrderView[]; comingBack: OrderView[] }> {
  const d = db();
  const t = now();
  const views = d.orders.filter((o) => o.status === "reserved" || o.status === "started").map((o) => view(d, o));
  const goingOut = views.filter((o) => o.fulfillment !== "started" && o.fulfillment !== "stopped" && o.startsAt !== null && ((o.startsAt >= from && o.startsAt < till) || (o.startsAt < t && o.status === "reserved")));
  const comingBack = views.filter((o) => o.status === "started" && o.stopsAt !== null && ((o.stopsAt >= from && o.stopsAt < till) || o.stopsAt < t));
  const byStart = (a: OrderView, b: OrderView) => (a.startsAt ?? 0) - (b.startsAt ?? 0);
  return { goingOut: goingOut.sort(byStart), comingBack: comingBack.sort((a, b) => (a.stopsAt ?? 0) - (b.stopsAt ?? 0)) };
}

// ------------------------------------------------------------------ storefront cart and checkout

export async function getCart(cartId: string | undefined): Promise<Cart | null> {
  const c = cartId ? db().carts.find((x) => x.id === cartId && !x.orderId) : undefined;
  return c ? structuredClone(c) : null;
}

export async function createCart(): Promise<Cart> {
  const c: Cart = { id: id("cart"), startsAt: null, stopsAt: null, lines: [], createdAt: now() };
  db().carts.push(c);
  return structuredClone(c);
}

const cartOrThrow = (cartId: string) => {
  const c = db().carts.find((x) => x.id === cartId && !x.orderId);
  if (!c) throw new DomainError("not_found", "Your cart has expired. Please start again.");
  return c;
};

export async function setCartPeriod(cartId: string, startsAt: number, stopsAt: number): Promise<Cart> {
  if (!(stopsAt > startsAt)) throw new DomainError("invalid", "The return has to be after the pickup.");
  if (startsAt < now() - 60_000) throw new DomainError("invalid", "Pick a start in the future.");
  const c = cartOrThrow(cartId);
  c.startsAt = startsAt;
  c.stopsAt = stopsAt;
  return structuredClone(c);
}

export async function addCartLine(cartId: string, productId: string, quantity: number): Promise<Cart> {
  const d = db();
  const c = cartOrThrow(cartId);
  const p = getProductOrThrow(d, productId);
  if (!p.showInStore) throw new DomainError("not_found", "That item is not offered online.");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw new DomainError("invalid", "Choose a quantity between 1 and 999.");
  const line = c.lines.find((l) => l.productId === productId);
  if (line) line.quantity += quantity;
  else c.lines.push({ id: id("cl"), productId, quantity });
  return structuredClone(c);
}

export async function setCartLine(cartId: string, lineId: string, quantity: number): Promise<Cart> {
  const c = cartOrThrow(cartId);
  if (quantity <= 0) c.lines = c.lines.filter((l) => l.id !== lineId);
  else {
    const l = c.lines.find((x) => x.id === lineId);
    if (l) l.quantity = Math.min(999, Math.floor(quantity));
  }
  return structuredClone(c);
}

export type CartView = {
  cart: Cart;
  lines: { id: string; product: Product; quantity: number; priceEachCents: number; chargeLabel: string; free: number | null }[];
  totals: ReturnType<typeof orderTotals>;
  canCheckout: boolean;
  problems: string[];
};

export async function cartView(cartId: string): Promise<CartView | null> {
  const d = db();
  const c = d.carts.find((x) => x.id === cartId && !x.orderId);
  if (!c) return null;
  const problems: string[] = [];
  const lines = c.lines
    .map((l) => {
      const product = d.products.find((p) => p.id === l.productId && !p.archivedAt);
      if (!product) return null;
      const price = priceLine(product, c.startsAt ?? undefined, c.stopsAt ?? undefined, d.org.timeZone);
      let free: number | null = null;
      if (product.productType === "rental" && c.startsAt !== null && c.stopsAt !== null) {
        const r = reservedRange(c.startsAt, c.stopsAt, product.bufferBeforeSec, product.bufferAfterSec);
        free = freeQuantity(stockWindows(d, product.id), holdWindows(d, product.id), r.from, r.till) + (product.allowShortage ? product.shortageLimit : 0);
        if (free < l.quantity) problems.push(free <= 0 ? `${product.name} is booked out for these dates.` : `Only ${free} ${product.name} free for these dates.`);
      }
      return { id: l.id, product: structuredClone(product), quantity: l.quantity, priceEachCents: price.priceEachCents, chargeLabel: price.chargeLabel, free };
    })
    .filter((x) => x !== null);
  if (c.startsAt === null) problems.push("Choose your rental dates.");
  if (!lines.length) problems.push("Your cart is empty.");
  const totals = orderTotals({
    lines: lines.map((l) => ({ quantity: l.quantity, priceEachCents: l.priceEachCents, depositValueCents: l.product.depositValueCents, isRental: l.product.productType === "rental", taxable: true })),
    discountPercent: 0,
    taxRateBps: d.org.settings.taxRateBps,
    pricesIncludeTax: d.org.settings.pricesIncludeTax,
    depositType: d.org.settings.depositType,
    depositValue: d.org.settings.depositValue,
  });
  return { cart: structuredClone(c), lines, totals, canCheckout: problems.length === 0, problems };
}

/**
 * Turn a cart into a booking. Availability is re-checked and the stock held in
 * the same synchronous step, so two customers racing for the last unit get
 * one booking and one clear refusal.
 */
export async function checkout(cartId: string, details: { name: string; email: string; phone?: string }): Promise<{ orderToken: string }> {
  const d = db();
  const c = cartOrThrow(cartId);
  const name = details.name.trim();
  const email = details.email.trim().toLowerCase();
  if (!name) throw new DomainError("invalid", "Enter your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DomainError("invalid", "Enter a valid email address.");
  if (c.startsAt === null || c.stopsAt === null) throw new DomainError("invalid", "Choose your rental dates.");
  if (!c.lines.length) throw new DomainError("invalid", "Your cart is empty.");

  const o = blankOrder(d, "store");
  o.startsAt = c.startsAt;
  o.stopsAt = c.stopsAt;
  for (const l of c.lines) addLine(d, o, getProductOrThrow(d, l.productId), l.quantity);

  const reserve = d.org.settings.availabilityEnabled;
  if (reserve) {
    const short = checkShortages(d, o).filter((s) => s.overLimit);
    if (short.length) throw new DomainError("unavailable", `Sorry, someone just booked ${short.map((s) => s.title).join(", ")} for these dates. Your cart is unchanged; try other dates or fewer items.`, short);
  }

  let customer = d.customers.find((x) => x.email === email);
  if (!customer) {
    customer = { id: id("cus"), number: ++d.counters.customer, name, email, phone: details.phone?.trim() || undefined, createdAt: now() };
    d.customers.push(customer);
  }
  o.customerId = customer.id;
  o.number = ++d.counters.order;
  o.status = reserve ? "reserved" : "draft";
  for (const pl of o.plannings) pl.holdsStock = reserve;
  d.orders.push(o);
  c.orderId = o.id;
  return { orderToken: o.token };
}
