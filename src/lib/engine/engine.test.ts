import { describe, expect, it } from "vitest";
import { dayStatus, freeQuantity, NEG_INF, POS_INF, reservedRange } from "./availability";
import { chargePeriods, orderTotals, priceLine, roundCents } from "./pricing";

const t = (iso: string) => Date.parse(iso);

// Same fixture as replica/schema_test.sql, so the in-memory engine and the
// Postgres function are held to the same answers.
describe("freeQuantity (matches schema_test.sql)", () => {
  const cameraStock = [
    { qty: 1, from: NEG_INF, till: POS_INF },
    { qty: 1, from: NEG_INF, till: POS_INF },
  ];
  const cameraHold = reservedRange(t("2027-01-10T09:00Z"), t("2027-01-11T09:00Z"), 0, 3600);
  const cameraHolds = [{ qty: 1, ...cameraHold }];
  const chairStock = [
    { qty: 10, from: NEG_INF, till: POS_INF },
    { qty: 5, from: t("2027-01-10T00:00Z"), till: t("2027-01-12T00:00Z") },
  ];
  const chairHolds = [{ qty: 12, from: t("2027-01-10T09:00Z"), till: t("2027-01-11T09:00Z") }];

  it("T1 camera still inside the 1h after-buffer", () => {
    expect(freeQuantity(cameraStock, cameraHolds, t("2027-01-11T09:30Z"), t("2027-01-12T09:00Z"))).toBe(1);
  });
  it("T2 camera free once the buffer ends", () => {
    expect(freeQuantity(cameraStock, cameraHolds, t("2027-01-11T10:00Z"), t("2027-01-12T09:00Z"))).toBe(2);
  });
  it("T3 chairs with temporary stock", () => {
    expect(freeQuantity(chairStock, chairHolds, t("2027-01-10T09:00Z"), t("2027-01-11T09:00Z"))).toBe(3);
  });
  it("T4 tightest moment of a longer window", () => {
    expect(freeQuantity(chairStock, chairHolds, t("2027-01-09T00:00Z"), t("2027-01-11T09:00Z"))).toBe(3);
  });
  it("T5 after temporary stock ends", () => {
    expect(freeQuantity(chairStock, chairHolds, t("2027-01-12T00:00Z"), t("2027-01-13T00:00Z"))).toBe(10);
  });
  it("T6 excluding the order itself", () => {
    expect(freeQuantity(chairStock, [], t("2027-01-10T09:00Z"), t("2027-01-11T09:00Z"))).toBe(15);
  });
  it("can go negative when overbooked", () => {
    expect(freeQuantity([{ qty: 1, from: NEG_INF, till: POS_INF }], [{ qty: 3, from: 0, till: 10 }], 0, 10)).toBe(-2);
  });
  it("back-to-back holds do not overlap (half-open ranges)", () => {
    const stock = [{ qty: 1, from: NEG_INF, till: POS_INF }];
    expect(freeQuantity(stock, [{ qty: 1, from: 0, till: 10 }], 10, 20)).toBe(1);
  });
  it("rejects an empty range", () => {
    expect(() => freeQuantity([], [], 5, 5)).toThrow();
  });
});

describe("dayStatus", () => {
  const stock = [{ qty: 1, from: NEG_INF, till: POS_INF }];
  const day = [t("2027-01-10T00:00Z"), t("2027-01-11T00:00Z")] as const;
  it("available when nothing is held", () => expect(dayStatus(stock, [], ...day)).toBe("available"));
  it("partial when held for the afternoon", () =>
    expect(dayStatus(stock, [{ qty: 1, from: t("2027-01-10T12:00Z"), till: t("2027-01-12T00:00Z") }], ...day)).toBe("partial"));
  it("unavailable when held all day", () =>
    expect(dayStatus(stock, [{ qty: 1, from: t("2027-01-09T00:00Z"), till: t("2027-01-12T00:00Z") }], ...day)).toBe("unavailable"));
});

describe("pricing", () => {
  it("rounds periods up", () => {
    expect(chargePeriods(t("2027-01-10T09:00Z"), t("2027-01-11T09:00Z"), "day", "UTC")).toBe(1);
    expect(chargePeriods(t("2027-01-10T09:00Z"), t("2027-01-11T09:01Z"), "day", "UTC")).toBe(2);
    expect(chargePeriods(t("2027-01-10T09:00Z"), t("2027-01-10T10:30Z"), "hour", "UTC")).toBe(2);
  });
  it("a day across the spring DST change is still one day", () => {
    // 2027-03-14 is the US spring-forward date: 09:00 to 09:00 local is 23 real hours
    const start = t("2027-03-13T14:00Z"); // 09:00 EST
    const end = t("2027-03-14T13:00Z"); // 09:00 EDT
    expect(chargePeriods(start, end, "day", "America/New_York")).toBe(1);
  });
  it("a day across the autumn DST change is still one day", () => {
    // 2027-11-07 fall-back: 09:00 to 09:00 local is 25 real hours
    const start = t("2027-11-06T13:00Z"); // 09:00 EDT
    const end = t("2027-11-07T14:00Z"); // 09:00 EST
    expect(chargePeriods(start, end, "day", "America/New_York")).toBe(1);
  });
  it("prices a flat daily line with a label", () => {
    expect(priceLine({ priceType: "flat", pricePeriod: "day", basePriceCents: 4500 }, t("2027-01-10T09:00Z"), t("2027-01-13T09:00Z"), "UTC")).toEqual({
      priceEachCents: 13500,
      chargeLabel: "3 days",
    });
  });
  it("fixed price ignores the period", () => {
    expect(priceLine({ priceType: "fixed", basePriceCents: 7500 }, 0, 9e9, "UTC").priceEachCents).toBe(7500);
  });
  it("rounds half to even", () => {
    expect(roundCents(2.5)).toBe(2);
    expect(roundCents(3.5)).toBe(4);
    expect(roundCents(2.4)).toBe(2);
  });
  it("totals with exclusive tax and a percent-of-order deposit", () => {
    const r = orderTotals({
      lines: [
        { quantity: 1, priceEachCents: 10000, depositValueCents: 0, isRental: true, taxable: true },
        { quantity: 1, priceEachCents: 5000, depositValueCents: 0, isRental: false, taxable: true },
      ],
      discountPercent: 10,
      taxRateBps: 2000,
      pricesIncludeTax: false,
      depositType: "percent_of_order",
      depositValue: 50,
    });
    expect(r).toEqual({ subtotal: 15000, discount: 1500, tax: 2700, total: 16200, deposit: 5000 });
  });
  it("inclusive tax is backed out, not added", () => {
    const r = orderTotals({
      lines: [{ quantity: 1, priceEachCents: 12000, depositValueCents: 0, isRental: true, taxable: true }],
      discountPercent: 0,
      taxRateBps: 2000,
      pricesIncludeTax: true,
      depositType: "none",
      depositValue: 0,
    });
    expect(r).toEqual({ subtotal: 12000, discount: 0, tax: 2000, total: 12000, deposit: 0 });
  });
  it("deposit by product value", () => {
    const r = orderTotals({
      lines: [{ quantity: 2, priceEachCents: 1000, depositValueCents: 5000, isRental: true, taxable: false }],
      discountPercent: 0,
      taxRateBps: 0,
      pricesIncludeTax: false,
      depositType: "percent_of_product_value",
      depositValue: 100,
    });
    expect(r.deposit).toBe(10000);
  });
});
