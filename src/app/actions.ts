"use server";

// Server actions: the only way screens change data. Each validates input,
// calls the data layer, refreshes the affected pages and returns a Result the
// screen can show. Domain errors become messages; anything else is a bug and
// is rethrown so it reaches error tracking.
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import * as store from "@/lib/data/store";
import { DomainError, type OrderView } from "@/lib/data/types";
import { fromZonedInput } from "@/lib/time";

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; code: DomainError["code"]; message: string };

async function run<T>(fn: () => Promise<T>, paths: string[] = []): Promise<Result<T>> {
  try {
    const data = await fn();
    for (const p of paths) revalidatePath(p, p.includes("[") ? "page" : undefined);
    return { ok: true, data };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, code: e.code, message: e.message };
    throw e;
  }
}

const officePaths = (orderId?: string) => ["/dashboard", "/bookings", ...(orderId ? [`/bookings/${orderId}`] : []), "/inventory", "/customers"];

// ------------------------------------------------------------------ inventory

export async function createProductAction(input: store.NewProduct) {
  return run(() => store.createProduct(input), ["/inventory"]);
}

export async function updateProductAction(productId: string, patch: Parameters<typeof store.updateProduct>[1]) {
  return run(() => store.updateProduct(productId, patch), ["/inventory", `/inventory/${productId}`]);
}

export async function addStockAction(
  productId: string,
  input: { identifiers?: string[]; quantity?: number; availableFrom?: string; availableTill?: string },
) {
  const org = await store.getOrg();
  const window = {
    availableFrom: input.availableFrom ? fromZonedInput(input.availableFrom, org.timeZone) : undefined,
    availableTill: input.availableTill ? fromZonedInput(input.availableTill, org.timeZone) : undefined,
  };
  return run(async () => {
    if (window.availableFrom && window.availableTill && window.availableTill <= window.availableFrom)
      throw new DomainError("invalid", "The end date has to be after the start date.");
    if (input.identifiers) await store.addStockUnits(productId, input.identifiers, window);
    else await store.addStockQuantity(productId, input.quantity ?? 0, window);
  }, ["/inventory", `/inventory/${productId}`]);
}

export async function archiveUnitAction(productId: string, unitId: string) {
  return run(() => store.archiveUnit(unitId), ["/inventory", `/inventory/${productId}`]);
}

// ------------------------------------------------------------------ customers

export async function createCustomerAction(input: { name: string; email?: string; phone?: string }) {
  return run(() => store.createCustomer(input), ["/customers"]);
}

export async function searchCustomersAction(q: string) {
  return (await store.listCustomers(q)).slice(0, 8).map(({ id, name, email }) => ({ id, name, email }));
}

// ------------------------------------------------------------------ bookings

export type ProductHit = { id: string; name: string; tracking: string; productType: string; free: number | null };

/** Products matching q, with how many are free for the booking's dates. */
export async function searchProductsAction(q: string, orderId: string): Promise<ProductHit[]> {
  const order = await store.getOrder(orderId);
  const products = (await store.listProducts({ q })).slice(0, 8);
  return Promise.all(
    products.map(async (p) => {
      let free: number | null = null;
      if (p.productType === "rental" && order?.startsAt != null && order.stopsAt != null) {
        free = (await store.availability(p.id, order.startsAt - p.bufferBeforeSec * 1000, order.stopsAt + p.bufferAfterSec * 1000, orderId)).free;
        free += order.lines.filter((l) => l.productId === p.id).reduce((s, l) => s + l.quantity, 0);
      }
      return { id: p.id, name: p.name, tracking: p.tracking, productType: p.productType, free };
    }),
  );
}

export async function setCustomerAction(orderId: string, customerId: string | null) {
  return run(() => store.setOrderCustomer(orderId, customerId), officePaths(orderId));
}

export async function setPeriodAction(orderId: string, start: string, end: string, confirmShortage = false) {
  const org = await store.getOrg();
  return run(async () => {
    if (!start || !end) throw new DomainError("invalid", "Enter both the pickup and the return.");
    return store.setOrderPeriod(orderId, fromZonedInput(start, org.timeZone), fromZonedInput(end, org.timeZone), { confirmShortage });
  }, officePaths(orderId));
}

export async function addItemAction(orderId: string, productId: string, quantity: number, confirmShortage = false) {
  return run(() => store.addOrderItem(orderId, productId, quantity, { confirmShortage }), officePaths(orderId));
}

export async function setLineQuantityAction(orderId: string, lineId: string, quantity: number, confirmShortage = false) {
  return run(() => store.setLineQuantity(orderId, lineId, quantity, { confirmShortage }), officePaths(orderId));
}

export async function removeLineAction(orderId: string, lineId: string) {
  return run(() => store.removeLine(orderId, lineId), officePaths(orderId));
}

export async function addCustomLineAction(orderId: string, title: string, priceCents: number) {
  return run(() => store.addCustomLine(orderId, title, priceCents), officePaths(orderId));
}

export async function transitionAction(orderId: string, to: store.Transition, confirmShortage = false): Promise<Result<OrderView>> {
  return run(() => store.transition(orderId, to, { confirmShortage }), officePaths(orderId));
}

export async function freeUnitsAction(orderId: string, lineId: string) {
  return store.freeUnitsFor(orderId, lineId);
}

export async function pickupAction(orderId: string, items: store.HandItem[]) {
  return run(() => store.pickup(orderId, items), officePaths(orderId));
}

export async function returnAction(orderId: string, items: store.HandItem[], deposit: { keptCents?: number; reason?: string }) {
  return run(() => store.returnItems(orderId, items, deposit), officePaths(orderId));
}

// ------------------------------------------------------------------ storefront

const CART = "cart_id";

async function cartId(create: boolean) {
  const jar = await cookies();
  const existing = jar.get(CART)?.value;
  if (existing && (await store.getCart(existing))) return existing;
  if (!create) return undefined;
  const c = await store.createCart();
  jar.set(CART, c.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return c.id;
}

export async function currentCartId() {
  return cartId(false);
}

export async function shopAddToCartAction(slug: string, productId: string, quantity: number, start?: string, end?: string) {
  const org = await store.getOrgBySlug(slug);
  if (!org) return { ok: false, code: "not_found", message: "This store does not exist." } as const;
  return run(async () => {
    const id = (await cartId(true))!;
    if (start && end) await store.setCartPeriod(id, fromZonedInput(start, org.timeZone), fromZonedInput(end, org.timeZone));
    return store.addCartLine(id, productId, quantity);
  }, [`/shop/${slug}`]);
}

export async function shopSetPeriodAction(slug: string, start: string, end: string) {
  const org = await store.getOrgBySlug(slug);
  if (!org) return { ok: false, code: "not_found", message: "This store does not exist." } as const;
  return run(async () => {
    if (!start || !end) throw new DomainError("invalid", "Choose both dates and times.");
    const id = (await cartId(true))!;
    return store.setCartPeriod(id, fromZonedInput(start, org.timeZone), fromZonedInput(end, org.timeZone));
  }, [`/shop/${slug}`]);
}

export async function shopSetLineAction(slug: string, lineId: string, quantity: number) {
  return run(async () => {
    const id = await cartId(false);
    if (!id) throw new DomainError("not_found", "Your cart has expired.");
    return store.setCartLine(id, lineId, quantity);
  }, [`/shop/${slug}`]);
}

export async function shopCheckoutAction(slug: string, details: { name: string; email: string; phone?: string }) {
  return run(async () => {
    const id = await cartId(false);
    if (!id) throw new DomainError("not_found", "Your cart has expired. Please start again.");
    const r = await store.checkout(id, details);
    (await cookies()).delete(CART);
    return r;
  }, [`/shop/${slug}`, "/dashboard", "/bookings"]);
}

export async function shopMonthAction(productId: string, year: number, month: number, quantity = 1) {
  const p = await store.getProduct(productId);
  if (!p || !p.showInStore || p.productType !== "rental") return {};
  return store.monthAvailability(productId, year, month, quantity);
}
