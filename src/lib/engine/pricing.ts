// Pricing engine. Pure functions, integer cents throughout.
// This slice covers flat (per period, rounded up) and fixed prices, order
// totals with exclusive or inclusive tax, and the deposit methods.
// Pricing structures and rulesets arrive in M3 (see architecture.md).

export type PricePeriod = "minute" | "hour" | "day" | "week" | "month";
export type PriceType = "flat" | "fixed" | "none";

const PERIOD_MS: Record<Exclude<PricePeriod, "month">, number> = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
};

/**
 * How many charge periods a rental of [start, end) uses. Days, weeks and
 * months are counted on the org's calendar (its time zone), so a rental that
 * crosses a daylight saving change is not charged an extra day.
 */
export function chargePeriods(start: number, end: number, period: PricePeriod, timeZone: string): number {
  if (!(end > start)) return 0;
  if (period === "minute" || period === "hour") return Math.ceil((end - start) / PERIOD_MS[period]);
  // wall-clock length in the org's zone
  const wall = (t: number) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
        .formatToParts(new Date(t))
        .map((x) => [x.type, x.value]),
    );
    return Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!);
  };
  const wallMs = wall(end) - wall(start);
  if (period === "month") return Math.max(1, Math.ceil(wallMs / (30 * PERIOD_MS.day)));
  return Math.max(1, Math.ceil(wallMs / PERIOD_MS[period]));
}

const periodWord: Record<PricePeriod, [string, string]> = {
  minute: ["minute", "minutes"],
  hour: ["hour", "hours"],
  day: ["day", "days"],
  week: ["week", "weeks"],
  month: ["month", "months"],
};

export function priceLine(
  p: { priceType: PriceType; pricePeriod?: PricePeriod; basePriceCents: number },
  start: number | undefined,
  end: number | undefined,
  timeZone: string,
): { priceEachCents: number; chargeLabel: string } {
  if (p.priceType === "none") return { priceEachCents: 0, chargeLabel: "" };
  if (p.priceType === "fixed") return { priceEachCents: p.basePriceCents, chargeLabel: "" };
  const period = p.pricePeriod ?? "day";
  if (start === undefined || end === undefined) {
    return { priceEachCents: p.basePriceCents, chargeLabel: `1 ${periodWord[period][0]}` };
  }
  const n = chargePeriods(start, end, period, timeZone);
  return { priceEachCents: n * p.basePriceCents, chargeLabel: `${n} ${periodWord[period][n === 1 ? 0 : 1]}` };
}

export type DepositType = "none" | "percent_of_order" | "percent_of_product_value" | "fixed";

export type TotalsInput = {
  lines: { quantity: number; priceEachCents: number; depositValueCents: number; isRental: boolean; taxable: boolean }[];
  discountPercent: number;
  taxRateBps: number;
  pricesIncludeTax: boolean;
  depositType: DepositType;
  depositValue: number; // percent for percent types, cents for fixed
};

export type Totals = { subtotal: number; discount: number; tax: number; total: number; deposit: number };

/** Half-even rounding to whole cents. */
export function roundCents(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  if (Math.abs(d - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1;
  return Math.round(x);
}

export function orderTotals(t: TotalsInput): Totals {
  const subtotal = t.lines.reduce((s, l) => s + l.quantity * l.priceEachCents, 0);
  const discount = roundCents((subtotal * t.discountPercent) / 100);
  const rate = t.taxRateBps / 10000;
  let tax = 0;
  for (const l of t.lines) {
    if (!l.taxable) continue;
    const gross = l.quantity * l.priceEachCents;
    const afterDiscount = subtotal ? gross - (gross / subtotal) * discount : gross;
    tax += t.pricesIncludeTax ? afterDiscount - afterDiscount / (1 + rate) : afterDiscount * rate;
  }
  tax = roundCents(tax);
  const total = subtotal - discount + (t.pricesIncludeTax ? 0 : tax);

  const rentalSum = t.lines.filter((l) => l.isRental).reduce((s, l) => s + l.quantity * l.priceEachCents, 0);
  const deposit =
    t.depositType === "fixed"
      ? Math.round(t.depositValue)
      : t.depositType === "percent_of_order"
        ? roundCents((rentalSum * t.depositValue) / 100)
        : t.depositType === "percent_of_product_value"
          ? roundCents(t.lines.reduce((s, l) => s + l.quantity * l.depositValueCents, 0) * (t.depositValue / 100))
          : 0;

  return { subtotal, discount, tax, total, deposit };
}
