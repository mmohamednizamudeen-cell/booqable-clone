// Time helpers. The database and engines use real UTC instants (epoch ms);
// the org's IANA time zone is applied only at the edges: forms and display.

function parts(ms: number, timeZone: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date(ms))
      .map((x) => [x.type, x.value]),
  );
  return { y: +p.year!, m: +p.month!, d: +p.day!, h: +p.hour!, min: +p.minute! };
}

/** Offset of the zone from UTC at an instant, in ms. */
function offsetAt(ms: number, timeZone: string) {
  const p = parts(ms, timeZone);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - Math.floor(ms / 60000) * 60000;
}

/** "2027-01-10T09:00" in the zone -> UTC ms. Handles DST by re-checking the offset. */
export function fromZonedInput(value: string, timeZone: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value);
  if (!m) throw new Error(`Not a date: ${value}`);
  const naive = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +(m[4] ?? 0), +(m[5] ?? 0));
  let guess = naive - offsetAt(naive, timeZone);
  guess = naive - offsetAt(guess, timeZone);
  return guess;
}

/** UTC ms -> "2027-01-10T09:00" in the zone (for datetime-local inputs). */
export function toZonedInput(ms: number, timeZone: string): string {
  const p = parts(ms, timeZone);
  const z = (n: number) => String(n).padStart(2, "0");
  return `${p.y}-${z(p.m)}-${z(p.d)}T${z(p.h)}:${z(p.min)}`;
}

/** "YYYY-MM-DD" of an instant in the zone. */
export function zonedDate(ms: number, timeZone: string): string {
  return toZonedInput(ms, timeZone).slice(0, 10);
}

/** [start, end) of a calendar day in the zone. */
export function dayBounds(date: string, timeZone: string): [number, number] {
  const start = fromZonedInput(date, timeZone);
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const nextStr = next.toISOString().slice(0, 10);
  return [start, fromZonedInput(nextStr, timeZone)];
}

export function formatDateTime(ms: number, timeZone: string, locale = "en-US") {
  return new Intl.DateTimeFormat(locale, { timeZone, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(ms);
}

export function formatDate(ms: number, timeZone: string, locale = "en-US") {
  return new Intl.DateTimeFormat(locale, { timeZone, day: "numeric", month: "short", year: "numeric" }).format(ms);
}

export function formatMoney(cents: number, currency: string, locale = "en-US") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}
