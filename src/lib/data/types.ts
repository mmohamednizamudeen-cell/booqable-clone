// Domain types used by screens. Shaped after replica/schema.sql so the
// Postgres layer can return the same objects. Times are UTC epoch ms.
import type { DepositType, PricePeriod, PriceType, Totals } from "@/lib/engine/pricing";

export type Org = {
  id: string;
  name: string;
  slug: string;
  currency: string;
  timeZone: string;
  settings: {
    pricesIncludeTax: boolean;
    taxRateBps: number;
    depositType: DepositType;
    depositValue: number;
    storeLive: boolean;
    availabilityEnabled: boolean;
    defaultPickupTime: string; // "09:00", local
    defaultReturnTime: string;
  };
};

export type ProductType = "rental" | "service" | "sales_item";
export type Tracking = "individual" | "bulk" | "none";

export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  productType: ProductType;
  tracking: Tracking;
  priceType: PriceType;
  pricePeriod?: PricePeriod;
  basePriceCents: number;
  depositValueCents: number;
  bufferBeforeSec: number;
  bufferAfterSec: number;
  allowShortage: boolean;
  shortageLimit: number;
  showInStore: boolean;
  sku: string;
  archivedAt?: number;
  createdAt: number;
};

export type StockUnit = {
  id: string;
  productId: string;
  identifier: string;
  kind: "regular" | "temporary";
  availableFrom?: number;
  availableTill?: number;
  archivedAt?: number;
};

export type StockBatch = {
  id: string;
  productId: string;
  quantity: number;
  kind: "regular" | "temporary";
  availableFrom?: number;
  availableTill?: number;
  archivedAt?: number;
};

export type Customer = {
  id: string;
  number: number;
  name: string;
  email?: string;
  phone?: string;
  createdAt: number;
};

export type OrderStatus = "new" | "draft" | "reserved" | "started" | "stopped" | "archived" | "canceled";

export type Line = {
  id: string;
  productId?: string;
  title: string;
  quantity: number;
  priceEachCents: number;
  chargeLabel: string;
  custom?: boolean;
};

export type Planning = {
  id: string;
  lineId: string;
  productId: string;
  quantity: number;
  reservedFrom: number;
  reservedTill: number;
  holdsStock: boolean;
  startedQty: number;
  stoppedQty: number;
  unitIds: string[]; // specified units (tracked products)
  startedUnitIds: string[];
  stoppedUnitIds: string[];
};

export type Order = {
  id: string;
  token: string; // for the customer's confirmation link
  number: number | null;
  status: OrderStatus;
  source: "back_office" | "store";
  customerId: string | null;
  startsAt: number | null;
  stopsAt: number | null;
  discountPercent: number;
  lines: Line[];
  plannings: Planning[];
  depositKeptCents: number;
  depositKeptReason?: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
};

/** What screens get for an order: the record plus derived values. */
export type OrderView = Order & {
  customer: Customer | null;
  totals: Totals;
  fulfillment: "none" | "partially_started" | "started" | "partially_stopped" | "stopped";
  paymentStatus: "payment_due" | "paid";
  late: "pickup" | "return" | null;
  shortages: { productId: string; title: string; short: number }[];
};

export type Breakdown = {
  available: number;
  expected: number;
  thisOrder: number;
  otherOrders: number;
  withinShortage: number;
  overShortage: number;
  downtime: number;
};

export type UnitView = StockUnit & { state: "available" | "out" | "overdue" | "expected" | "expired"; heldBy?: { orderId: string; number: number | null } };

export type Cart = {
  id: string;
  startsAt: number | null;
  stopsAt: number | null;
  lines: { id: string; productId: string; quantity: number }[];
  orderId?: string;
  createdAt: number;
};

export class DomainError extends Error {
  constructor(
    public code: "not_found" | "invalid" | "unavailable" | "shortage_warning" | "conflict",
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
