"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { MonthCalendar, type DayStatus } from "@/components/ui/domain";
import { shopAddToCartAction, shopMonthAction } from "@/app/actions";

export function BookPanel({
  slug,
  product,
  today,
  initialMonth,
  period,
  defaults,
}: {
  slug: string;
  product: { id: string; name: string; rental: boolean };
  today: string;
  initialMonth: Record<string, DayStatus | "available" | "partial" | "unavailable">;
  period: { start: string; end: string } | null;
  defaults: { pickup: string; ret: string };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [days, setDays] = useState<Record<string, string>>(initialMonth);
  const [range, setRange] = useState<{ start?: string; end?: string }>(period ? { start: period.start.slice(0, 10), end: period.end.slice(0, 10) } : {});
  const [pickupTime, setPickupTime] = useState(period?.start.slice(11) ?? defaults.pickup);
  const [returnTime, setReturnTime] = useState(period?.end.slice(11) ?? defaults.ret);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const locked = period !== null; // the cart already has dates; change them in the cart

  const status = (d: string): DayStatus => {
    if (d < today) return "unavailable";
    const s = days[d];
    return s === "partial" ? "partial" : s === "unavailable" ? "unavailable" : "available";
  };

  const add = () =>
    start(async () => {
      setError(null);
      if (product.rental && (!range.start || !range.end) && !locked) return setError("Choose your pickup and return dates on the calendar.");
      const s = locked ? undefined : `${range.start}T${pickupTime}`;
      const e = locked ? undefined : `${range.end}T${returnTime}`;
      const r = await shopAddToCartAction(slug, product.id, qty, s, e);
      if (!r.ok) return setError(r.message);
      router.push(`/shop/${slug}/cart`);
    });

  const [y, m] = today.split("-").map(Number) as [number, number];
  return (
    <Card className="h-fit">
      <CardHeader title={product.rental ? "When do you need it?" : "Add to your booking"} />
      <CardBody className="grid gap-5">
        {product.rental ? (
          locked ? (
            <p className="text-sm text-body">
              Your cart is for {period!.start.replace("T", " ")} to {period!.end.replace("T", " ")}. Change the dates in the cart.
            </p>
          ) : (
            <>
              <MonthCalendar
                month={new Date(y, m - 1, 1)}
                today={new Date(y, m - 1, Number(today.slice(8)))}
                status={status}
                value={range}
                onChange={setRange}
                onMonthChange={async (d) => {
                  const more = await shopMonthAction(product.id, d.getFullYear(), d.getMonth() + 1, qty);
                  setDays((prev) => ({ ...prev, ...more }));
                }}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={`Pickup time${range.start ? ` on ${range.start}` : ""}`}>
                  {(p) => <Input {...p} type="time" step={1800} value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} />}
                </Field>
                <Field label={`Return time${range.end ? ` on ${range.end}` : ""}`}>
                  {(p) => <Input {...p} type="time" step={1800} value={returnTime} onChange={(e) => setReturnTime(e.target.value)} />}
                </Field>
              </div>
            </>
          )
        ) : null}
        <Field label="Quantity">{(p) => <Input {...p} type="number" min={1} max={999} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />}</Field>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        <Button variant="primary" size="md" loading={pending} onClick={add}>
          Add to cart
        </Button>
      </CardBody>
    </Card>
  );
}
