// Availability engine. Pure functions, no I/O: the data layer passes in the
// stock windows and holds it loaded. Mirrors variant_free_quantity() in
// replica/schema.sql so the in-memory layer and Postgres give the same answers.
//
// Times are epoch milliseconds. All ranges are half-open: [from, till).

export type Window = { qty: number; from: number; till: number };

export const NEG_INF = -8.64e15;
export const POS_INF = 8.64e15;

/** Units free over [from, till) at the tightest moment: capacity minus holds. */
export function freeQuantity(stock: Window[], holds: Window[], from: number, till: number): number {
  if (!(till > from)) throw new Error("till must be after from");
  const relevant = holds.filter((h) => h.from < till && h.till > from);
  const points = new Set<number>([from]);
  for (const w of [...stock, ...relevant]) {
    if (w.from > from && w.from < till) points.add(w.from);
    if (w.till > from && w.till < till) points.add(w.till);
  }
  let min = Infinity;
  for (const t of points) {
    const cap = stock.reduce((s, w) => (w.from <= t && w.till > t ? s + w.qty : s), 0);
    const held = relevant.reduce((s, w) => (w.from <= t && w.till > t ? s + w.qty : s), 0);
    min = Math.min(min, cap - held);
  }
  return min === Infinity ? 0 : min;
}

/** Does a hold overlap [from, till)? */
export const overlaps = (w: { from: number; till: number }, from: number, till: number) => w.from < till && w.till > from;

/** The period widened by buffers: what a booking actually takes from stock. */
export function reservedRange(startsAt: number, stopsAt: number, bufferBeforeSec: number, bufferAfterSec: number) {
  return { from: startsAt - bufferBeforeSec * 1000, till: stopsAt + bufferAfterSec * 1000 };
}

export type DayStatus = "available" | "partial" | "unavailable" | "closed";

/**
 * Status of one calendar day for `qty` units: available if free all day,
 * partial if free for some of it, unavailable if never.
 * `hourStepMs` controls how finely "some of it" is checked.
 */
export function dayStatus(
  stock: Window[],
  holds: Window[],
  dayStart: number,
  dayEnd: number,
  qty = 1,
  hourStepMs = 60 * 60 * 1000,
): DayStatus {
  if (freeQuantity(stock, holds, dayStart, dayEnd) >= qty) return "available";
  for (let t = dayStart; t < dayEnd; t += hourStepMs) {
    if (freeQuantity(stock, holds, t, Math.min(t + hourStepMs, dayEnd)) >= qty) return "partial";
  }
  return "unavailable";
}
