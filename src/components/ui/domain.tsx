"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { Popover } from "./overlay";

// ---------------------------------------------------------------- money

export function formatMoney(cents: number, currency: string, locale = "en") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

// ---------------------------------------------------------------- availability label + breakdown

export type Breakdown = {
  available: number;
  expected: number;
  thisOrder: number;
  otherOrders: number;
  withinShortage: number;
  overShortage: number;
  downtime: number;
};

const segments: { key: keyof Breakdown; label: string; className: string }[] = [
  { key: "available", label: "Free", className: "bg-success-pill" },
  { key: "expected", label: "Arriving", className: "bg-success" },
  { key: "thisOrder", label: "On this booking", className: "bg-accent" },
  { key: "otherOrders", label: "On other bookings", className: "bg-line-input" },
  { key: "withinShortage", label: "Short, within limit", className: "bg-warning-pill" },
  { key: "overShortage", label: "Short, over limit", className: "bg-danger" },
  { key: "downtime", label: "In maintenance", className: "bg-tooltip" },
];

export function AvailabilityLabel({ free, breakdown, onAddStock }: { free: number; breakdown: Breakdown; onAddStock?: () => void }) {
  const short = free < 0;
  const total = segments.reduce((s, x) => s + breakdown[x.key], 0) || 1;
  return (
    <Popover
      trigger={
        <button type="button" className={cn("justify-self-start text-left text-xs font-semibold underline-offset-4 hover:underline", short ? "text-danger" : "text-success")}>
          {short ? `${-free} short` : `${free} left`}
        </button>
      }
    >
      <p className="mb-3 text-sm font-semibold text-ink">Stock for this period</p>
      <div className="mb-4 flex h-2 overflow-hidden rounded-pill bg-surface-muted" aria-hidden>
        {segments.map((s) =>
          breakdown[s.key] > 0 ? <span key={s.key} className={s.className} style={{ width: `${(breakdown[s.key] / total) * 100}%` }} /> : null,
        )}
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
        {segments.map((s) => (
          <div key={s.key} className="contents">
            <dt className="flex items-center gap-2 text-body">
              <span className={cn("size-2 rounded-pill", s.className)} aria-hidden />
              {s.label}
            </dt>
            <dd className="text-right text-ink tabular-nums">{breakdown[s.key]}</dd>
          </div>
        ))}
      </dl>
      {onAddStock ? (
        <Button size="sm" className="mt-4 w-full" onClick={onAddStock}>
          Add stock
        </Button>
      ) : null}
    </Popover>
  );
}

// ---------------------------------------------------------------- totals

export function TotalsBlock({
  currency,
  subtotal,
  discount,
  tax,
  total,
  deposit,
  depositNote,
  pricesIncludeTax,
  onAddDiscount,
  onAddCoupon,
}: {
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  deposit: number;
  depositNote?: string;
  pricesIncludeTax?: boolean;
  onAddDiscount?: () => void;
  onAddCoupon?: () => void;
}) {
  const m = (c: number) => formatMoney(c, currency);
  const row = "flex items-baseline justify-between gap-6";
  return (
    <div className="grid w-full max-w-80 gap-2.5 text-sm">
      <div className={row}>
        <span className="text-body">Subtotal</span>
        <span className="text-ink tabular-nums">{m(subtotal)}</span>
      </div>
      {onAddDiscount ? (
        <Button variant="link" className="justify-self-start" onClick={onAddDiscount}>
          Give a discount
        </Button>
      ) : null}
      {onAddCoupon ? (
        <Button variant="link" className="justify-self-start" onClick={onAddCoupon}>
          Apply a coupon code
        </Button>
      ) : null}
      <div className={row}>
        <span className="text-body">Discounts</span>
        <span className="text-ink tabular-nums">{discount ? `−${m(discount)}` : m(0)}</span>
      </div>
      {!pricesIncludeTax ? (
        <div className={row}>
          <span className="text-body">Tax</span>
          <span className="text-ink tabular-nums">{m(tax)}</span>
        </div>
      ) : null}
      <div className={cn(row, "border-t border-line pt-3")}>
        <span className="font-semibold text-ink">Total{pricesIncludeTax ? " incl. tax" : ""}</span>
        <span className="font-semibold text-ink tabular-nums">{m(total)}</span>
      </div>
      <div className={row}>
        <span className="grid">
          <span className="text-body">Security deposit</span>
          {depositNote ? <span className="text-xs text-muted">{depositNote}</span> : null}
        </span>
        <span className="text-ink tabular-nums">{m(deposit)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- month calendar

export type DayStatus = "available" | "partial" | "closed" | "unavailable";

const dayStyle: Record<DayStatus, string> = {
  available: "bg-success-pill/60 text-ink hover:ring-2 hover:ring-accent",
  partial: "bg-[linear-gradient(135deg,var(--c-success-pill)_50%,var(--c-warning-pill)_50%)] text-ink hover:ring-2 hover:ring-accent",
  closed: "text-muted line-through",
  unavailable: "border border-dashed border-line-input text-muted",
};

const statusName: Record<DayStatus, string> = {
  available: "available",
  partial: "available part of the day",
  closed: "closed for pickup and return",
  unavailable: "not available",
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/**
 * Month grid with availability per day and a start / end selection.
 * Keyboard: arrows move a day / week, Home / End to week edges,
 * PageUp / PageDown change month, Enter or Space selects.
 */
export function MonthCalendar({
  month,
  status,
  value,
  onChange,
  locale = "en",
  today = new Date(),
}: {
  month: Date;
  status: (isoDate: string) => DayStatus;
  value?: { start?: string; end?: string };
  onChange?: (v: { start?: string; end?: string }) => void;
  locale?: string;
  today?: Date;
}) {
  const [view, setView] = useState(new Date(month.getFullYear(), month.getMonth(), 1));
  const [focus, setFocus] = useState(iso(view));
  const grid = useRef<HTMLDivElement>(null);

  const weeks = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7; // Monday first
    const start = addDays(first, -offset);
    return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
  }, [view]);

  const weekdayNames = useMemo(() => {
    const monday = new Date(2024, 0, 1);
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i).toLocaleDateString(locale, { weekday: "short" }));
  }, [locale]);

  const pick = (d: string) => {
    if (status(d) === "unavailable" || status(d) === "closed") return;
    if (!value?.start || value.end || d < value.start) onChange?.({ start: d });
    else onChange?.({ start: value.start, end: d });
  };

  const move = (d: Date) => {
    setFocus(iso(d));
    if (d.getMonth() !== view.getMonth()) setView(new Date(d.getFullYear(), d.getMonth(), 1));
    requestAnimationFrame(() => grid.current?.querySelector<HTMLButtonElement>(`[data-day="${iso(d)}"]`)?.focus());
  };

  const onKey = (e: React.KeyboardEvent, d: Date) => {
    const map: Record<string, () => Date> = {
      ArrowLeft: () => addDays(d, -1),
      ArrowRight: () => addDays(d, 1),
      ArrowUp: () => addDays(d, -7),
      ArrowDown: () => addDays(d, 7),
      Home: () => addDays(d, -((d.getDay() + 6) % 7)),
      End: () => addDays(d, 6 - ((d.getDay() + 6) % 7)),
      PageUp: () => new Date(d.getFullYear(), d.getMonth() - 1, d.getDate()),
      PageDown: () => new Date(d.getFullYear(), d.getMonth() + 1, d.getDate()),
    };
    if (map[e.key]) {
      e.preventDefault();
      move(map[e.key]!());
    }
  };

  const title = view.toLocaleDateString(locale, { month: "long", year: "numeric" });

  return (
    <div className="w-full max-w-80">
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}>
          <ChevronLeft />
        </Button>
        <p className="text-sm font-semibold text-ink" aria-live="polite">
          {title}
        </p>
        <Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}>
          <ChevronRight />
        </Button>
      </div>
      <div ref={grid} role="grid" aria-label={title} className="grid gap-1">
        <div role="row" className="grid grid-cols-7 gap-1">
          {weekdayNames.map((n) => (
            <span key={n} role="columnheader" className="text-center text-xs font-medium text-muted">
              {n}
            </span>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} role="row" className="grid grid-cols-7 gap-1">
            {week.map((d) => {
              const key = iso(d);
              const st = status(key);
              const inMonth = d.getMonth() === view.getMonth();
              const isStart = value?.start === key;
              const isEnd = value?.end === key;
              const inRange = value?.start && value?.end && key > value.start && key < value.end;
              const selectable = st === "available" || st === "partial";
              return (
                <div key={key} role="gridcell" aria-selected={isStart || isEnd || !!inRange}>
                  <button
                    type="button"
                    data-day={key}
                    tabIndex={key === focus ? 0 : -1}
                    aria-disabled={!selectable}
                    aria-label={`${d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}, ${statusName[st]}`}
                    onClick={() => pick(key)}
                    onKeyDown={(e) => onKey(e, d)}
                    onFocus={() => setFocus(key)}
                    className={cn(
                      "flex aspect-square w-full items-center justify-center rounded-sm text-sm tabular-nums",
                      dayStyle[st],
                      !inMonth && "opacity-40",
                      !selectable && "cursor-not-allowed",
                      key === iso(today) && "ring-1 ring-ink",
                      inRange && "bg-accent-subtle bg-none font-medium text-accent ring-1 ring-accent/40",
                      (isStart || isEnd) && "bg-accent bg-none font-semibold text-on-accent",
                    )}
                  >
                    {d.getDate()}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-body" aria-label="Legend">
        <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-success-pill/60" aria-hidden />Available</li>
        <li className="flex items-center gap-1.5"><span className={cn("size-3 rounded-sm", dayStyle.partial)} aria-hidden />Part of the day</li>
        <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm border border-dashed border-line-input" aria-hidden />Booked out</li>
        <li className="flex items-center gap-1.5"><span className="text-muted line-through" aria-hidden>12</span>Closed</li>
      </ul>
    </div>
  );
}
