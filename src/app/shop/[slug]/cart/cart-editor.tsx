"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { TotalsBlock } from "@/components/ui/domain";
import { shopSetLineAction, shopSetPeriodAction } from "@/app/actions";
import type { CartView } from "@/lib/data/store";
import { formatMoney } from "@/lib/time";

export function CartEditor({ slug, cart, currency, period }: { slug: string; cart: CartView; currency: string; period: { start: string; end: string } | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [from, setFrom] = useState(period?.start ?? "");
  const [till, setTill] = useState(period?.end ?? "");
  const [error, setError] = useState<string | null>(null);
  const act = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.message ?? "Something went wrong.");
      router.refresh();
    });
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid content-start gap-6">
        <Card>
          <CardHeader title="Dates" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Pickup">{(p) => <Input {...p} type="datetime-local" step={1800} value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
            <Field label="Return">{(p) => <Input {...p} type="datetime-local" step={1800} min={from} value={till} onChange={(e) => setTill(e.target.value)} />}</Field>
          </CardBody>
          <CardFooter>
            <Button disabled={pending || (from === period?.start && till === period?.end)} onClick={() => act(() => shopSetPeriodAction(slug, from, till))}>
              Update dates
            </Button>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader title="Items" />
          <ul className="divide-y divide-line">
            {cart.lines.map((l) => (
              <li key={l.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-6 py-4 sm:grid-cols-[minmax(0,1fr)_5rem_6rem_auto]">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink" title={l.product.name}>{l.product.name}</p>
                  <p className="text-xs text-muted">{l.chargeLabel ? `${l.chargeLabel}, ${formatMoney(l.priceEachCents, currency)} each` : formatMoney(l.priceEachCents, currency)}</p>
                  {l.free !== null && l.free < l.quantity ? <p className="text-xs font-semibold text-danger">{l.free <= 0 ? "Booked out for these dates" : `Only ${l.free} free for these dates`}</p> : null}
                </div>
                <label className="sr-only" htmlFor={`q-${l.id}`}>Quantity of {l.product.name}</label>
                <Input id={`q-${l.id}`} dense type="number" min={1} defaultValue={l.quantity} className="text-right" onBlur={(e) => Number(e.target.value) !== l.quantity && act(() => shopSetLineAction(slug, l.id, Number(e.target.value)))} />
                <span className="text-right text-sm text-ink tabular-nums">{formatMoney(l.priceEachCents * l.quantity, currency)}</span>
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${l.product.name}`} onClick={() => act(() => shopSetLineAction(slug, l.id, 0))}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
          <CardFooter className="justify-start">
            <Link href={`/shop/${slug}`} className={buttonVariants({ variant: "link" })}>Add more items</Link>
          </CardFooter>
        </Card>
      </div>
      <Card className="h-fit">
        <CardHeader title="Summary" />
        <CardBody className="grid gap-4">
          <TotalsBlock currency={currency} subtotal={cart.totals.subtotal} discount={cart.totals.discount} tax={cart.totals.tax} total={cart.totals.total} deposit={cart.totals.deposit} depositNote="Refunded when everything comes back as it went out" />
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          {cart.problems.length ? (
            <ul className="grid gap-1 text-sm text-danger" role="status">
              {cart.problems.map((p) => <li key={p}>{p}</li>)}
            </ul>
          ) : null}
          {cart.canCheckout ? (
            <Link href={`/shop/${slug}/checkout`} className={buttonVariants({ variant: "primary", className: "w-full" })}>
              Continue to checkout
            </Link>
          ) : (
            <Button variant="primary" disabled className="w-full">Continue to checkout</Button>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
