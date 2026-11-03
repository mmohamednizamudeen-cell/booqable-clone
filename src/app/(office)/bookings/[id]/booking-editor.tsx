"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Plus, Search, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader, EmptyState } from "@/components/ui/card";
import { Checkbox, Field, Input, MoneyInput } from "@/components/ui/form";
import { Dialog, Menu, useToast, type MenuItem } from "@/components/ui/overlay";
import { Avatar, StatusPill } from "@/components/ui/pill";
import { AsideSection } from "@/components/ui/shell";
import { TotalsBlock } from "@/components/ui/domain";
import {
  addCustomLineAction,
  addItemAction,
  createCustomerAction,
  freeUnitsAction,
  pickupAction,
  removeLineAction,
  returnAction,
  searchCustomersAction,
  searchProductsAction,
  setCustomerAction,
  setLineQuantityAction,
  setPeriodAction,
  transitionAction,
  type ProductHit,
  type Result,
} from "@/app/actions";
import type { OrderView, Org } from "@/lib/data/types";
import { formatDateTime, formatMoney, toZonedInput } from "@/lib/time";

type Props = { order: OrderView; currency: string; timeZone: string; unitNames: Record<string, string>; tracked: string[]; defaults: Org["settings"] };

/** Run an action; on a shortage warning ask, and retry with confirmation. */
function useAction() {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [ask, setAsk] = useState<{ message: string; retry: () => void } | null>(null);
  const run = <T,>(fn: (confirm: boolean) => Promise<Result<T>>, success?: string, after?: (data: T) => void) =>
    start(async () => {
      const r = await fn(false);
      if (r.ok) {
        if (success) toast("success", success);
        after?.(r.data);
        router.refresh();
      } else if (r.code === "shortage_warning") {
        setAsk({
          message: r.message,
          retry: () =>
            start(async () => {
              const again = await fn(true);
              setAsk(null);
              if (again.ok) {
                if (success) toast("success", success);
                after?.(again.data);
                router.refresh();
              } else toast("error", again.message);
            }),
        });
      } else toast("error", r.message);
    });
  const confirmDialog = (
    <Dialog
      open={ask !== null}
      onOpenChange={(o) => !o && setAsk(null)}
      size="sm"
      title="Book with a shortage?"
      description={ask?.message}
      footer={
        <>
          <Button onClick={() => setAsk(null)}>Go back</Button>
          <Button variant="primary" loading={pending} onClick={() => ask?.retry()}>
            Book anyway
          </Button>
        </>
      }
    />
  );
  return { run, pending, confirmDialog };
}

export function BookingEditor({ order, currency, timeZone, unitNames, tracked, defaults }: Props) {
  const { run, pending, confirmDialog } = useAction();
  const router = useRouter();
  const closed = order.status === "archived" || order.status === "canceled";
  const out = order.plannings.reduce((s, p) => s + p.startedQty - p.stoppedQty, 0);
  const toHandOut = order.plannings.reduce((s, p) => s + p.quantity - p.startedQty, 0);

  const primary: React.ReactNode[] = [];
  if (order.status === "new") primary.push(<Button key="draft" disabled={pending} onClick={() => run(() => transitionAction(order.id, "draft"), "Saved as a draft.")}>Save as draft</Button>);
  if (order.status === "new" || order.status === "draft")
    primary.push(
      <Button key="reserve" variant="primary" disabled={pending || order.startsAt === null || !order.lines.length} onClick={() => run((c) => transitionAction(order.id, "reserved", c), "Reserved. The items are held for these dates.")}>
        Reserve
      </Button>,
    );
  if ((order.status === "reserved" || order.status === "started") && toHandOut > 0) primary.push(<HandOutDialog key="out" order={order} tracked={tracked} />);
  if (order.status === "started" && out > 0) primary.push(<TakeBackDialog key="back" order={order} unitNames={unitNames} currency={currency} />);
  if (order.status === "stopped") primary.push(<Button key="archive" disabled={pending} onClick={() => run(() => transitionAction(order.id, "archived"), "Archived.")}>Archive</Button>);

  const more: MenuItem[] = [];
  if (order.status === "reserved") more.push({ label: "Back to draft (release the items)", onSelect: () => run(() => transitionAction(order.id, "revert"), "Back to draft.") });
  if (order.status === "archived") more.push({ label: "Unarchive", onSelect: () => run(() => transitionAction(order.id, "revert"), "Unarchived.") });
  if (!closed && out === 0)
    more.push("separator", {
      label: order.status === "new" ? "Discard this booking" : "Cancel booking",
      danger: true,
      onSelect: () =>
        run(() => transitionAction(order.id, "canceled"), order.status === "new" ? "Discarded." : "Canceled. The items are free again.", () => {
          if (order.status === "new") router.push("/bookings");
        }),
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_var(--layout-aside)]">
      {confirmDialog}
      <div className="grid min-w-0 content-start gap-6">
        {order.late ? (
          <p role="status" className="rounded-md border border-warning-pill bg-warning-pill/30 px-4 py-3 text-sm text-ink">
            {order.late === "pickup" ? "This booking should have been picked up already." : "This booking is overdue back."}
          </p>
        ) : null}
        {order.shortages.length ? (
          <p role="status" className="rounded-md border border-danger bg-danger-subtle px-4 py-3 text-sm text-danger">
            Short on stock: {order.shortages.map((s) => `${s.title} (${s.short})`).join(", ")}. Add stock or change the booking.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {primary}
          {more.length ? <Menu items={more} trigger={<Button size="icon" aria-label="More actions"><MoreHorizontal /></Button>} /> : null}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <CustomerCard order={order} disabled={closed} />
          <PeriodCard order={order} timeZone={timeZone} defaults={defaults} disabled={closed} />
        </div>
        <ItemsCard order={order} currency={currency} unitNames={unitNames} disabled={closed} run={run} pending={pending} />
      </div>
      <aside aria-label="Booking summary" className="h-fit overflow-hidden rounded-md border border-line">
        <AsideSection title="Payment" badge={<StatusPill size="sm" tone={order.paymentStatus === "paid" ? "success" : "warning"}>{order.paymentStatus === "paid" ? "Paid" : "Due"}</StatusPill>}>
          <div className="flex justify-between text-sm"><span>Paid</span><span className="tabular-nums text-ink">{formatMoney(0, currency)}</span></div>
          <div className="flex justify-between text-sm"><span>Due</span><span className="tabular-nums text-ink">{formatMoney(order.totals.total, currency)}</span></div>
          <div className="flex justify-between text-sm"><span>Deposit</span><span className="tabular-nums text-ink">{formatMoney(order.totals.deposit, currency)}</span></div>
          <p className="text-xs text-muted">Taking payments arrives with the Stripe connection (M2).</p>
        </AsideSection>
        {order.depositKeptCents ? (
          <AsideSection title="Deposit kept">
            <p className="text-sm text-ink tabular-nums">{formatMoney(order.depositKeptCents, currency)}</p>
            <p className="text-sm text-body">{order.depositKeptReason}</p>
          </AsideSection>
        ) : null}
        <AsideSection title="History" defaultOpen={false}>
          <p className="text-sm text-body">Created {formatDateTime(order.createdAt, timeZone)}</p>
          <p className="text-sm text-body">Source: {order.source === "store" ? "online store" : "back office"}</p>
        </AsideSection>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------- customer

function CustomerCard({ order, disabled }: { order: OrderView; disabled: boolean }) {
  const { run, pending } = useAction();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ id: string; name: string; email?: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      const r = q.trim() ? await searchCustomersAction(q) : [];
      if (live) setHits(r);
    }, 150);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);
  const c = order.customer;
  return (
    <Card>
      <CardHeader title="Customer" />
      <CardBody className="grid gap-3">
        {c ? (
          <div className="flex items-center gap-3">
            <Avatar name={c.name} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink" title={c.name}>{c.name}</p>
              {c.email ? <p className="truncate text-sm text-body">{c.email}</p> : null}
            </div>
            {!disabled ? (
              <Button variant="ghost" size="icon-sm" aria-label="Remove customer" onClick={() => run(() => setCustomerAction(order.id, null))}>
                <X />
              </Button>
            ) : null}
          </div>
        ) : creating ? (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                const r = await createCustomerAction({ name, email });
                return r.ok ? setCustomerAction(order.id, r.data.id) : r;
              }, "Customer added.");
            }}
          >
            <Field label="Name">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />}</Field>
            <Field label="Email (optional)">{(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setCreating(false)}>Cancel</Button>
              <Button type="submit" variant="primary" loading={pending}>Add customer</Button>
            </div>
          </form>
        ) : (
          <div className="grid gap-2">
            <label className="sr-only" htmlFor="customer-search">Find a customer</label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input id="customer-search" className="pl-9" placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} disabled={disabled} autoComplete="off" />
            </div>
            {hits.length ? (
              <ul className="divide-y divide-line rounded-md border border-line" aria-label="Matching customers">
                {hits.map((h) => (
                  <li key={h.id}>
                    <button type="button" className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-muted" onClick={() => run(() => setCustomerAction(order.id, h.id))}>
                      <Avatar name={h.name} size={24} />
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{h.name}</span>
                      <span className="truncate text-xs text-muted">{h.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : q.trim() ? (
              <p className="text-sm text-muted">Nobody matches “{q}”.</p>
            ) : null}
            {!disabled ? (
              <Button variant="link" className="justify-self-start" onClick={() => { setCreating(true); setName(q); }}>
                <UserPlus /> New customer
              </Button>
            ) : null}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------- period

function PeriodCard({ order, timeZone, defaults, disabled }: { order: OrderView; timeZone: string; defaults: Org["settings"]; disabled: boolean }) {
  const { run, pending, confirmDialog } = useAction();
  const initial = useMemo(() => {
    if (order.startsAt !== null && order.stopsAt !== null) return [toZonedInput(order.startsAt, timeZone), toZonedInput(order.stopsAt, timeZone)];
    const tomorrow = toZonedInput(Date.now() + 86_400_000, timeZone).slice(0, 10);
    const after = toZonedInput(Date.now() + 2 * 86_400_000, timeZone).slice(0, 10);
    return [`${tomorrow}T${defaults.defaultPickupTime}`, `${after}T${defaults.defaultReturnTime}`];
  }, [order.startsAt, order.stopsAt, timeZone, defaults]);
  const [start, setStart] = useState(initial[0]!);
  const [end, setEnd] = useState(initial[1]!);
  const unsaved = order.startsAt === null || start !== initial[0] || end !== initial[1];
  const outAlready = order.status === "started";
  return (
    <Card>
      {confirmDialog}
      <CardHeader title="Rental period" description={order.startsAt === null ? "Pick dates to see what is free." : undefined} />
      <CardBody className="grid gap-4">
        <Field label="Pickup" hint={outAlready ? "Items are out, so only the return can move." : undefined}>
          {(p) => <Input {...p} type="datetime-local" step={900} value={start} onChange={(e) => setStart(e.target.value)} disabled={disabled || outAlready} />}
        </Field>
        <Field label="Return">{(p) => <Input {...p} type="datetime-local" step={900} value={end} min={start} onChange={(e) => setEnd(e.target.value)} disabled={disabled} />}</Field>
      </CardBody>
      {!disabled ? (
        <CardFooter>
          <Button variant={unsaved ? "primary" : "secondary"} disabled={!unsaved} loading={pending} onClick={() => run((c) => setPeriodAction(order.id, start, end, c), "Dates saved.")}>
            {order.startsAt === null ? "Set dates" : "Change dates"}
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------- items

function ItemsCard({
  order,
  currency,
  unitNames,
  disabled,
  run,
  pending,
}: {
  order: OrderView;
  currency: string;
  unitNames: Record<string, string>;
  disabled: boolean;
  run: ReturnType<typeof useAction>["run"];
  pending: boolean;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ProductHit[]>([]);
  const [custom, setCustom] = useState(false);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState(0);
  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      const r = q.trim() ? await searchProductsAction(q, order.id) : [];
      if (live) setHits(r);
    }, 150);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, order.id, order.startsAt, order.stopsAt, order.lines.length]);
  const count = order.lines.reduce((s, l) => s + l.quantity, 0);
  return (
    <Card>
      <CardHeader title="Items" />
      <CardBody className="grid gap-6">
        {!disabled ? (
          <div className="grid gap-2">
            <label htmlFor="product-search" className="text-sm font-medium text-ink">Add items</label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input id="product-search" className="pl-9" placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
            </div>
            {hits.length ? (
              <ul className="divide-y divide-line rounded-md border border-line" aria-label="Matching products">
                {hits.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{h.name}</span>
                    {h.free !== null ? <span className={h.free > 0 ? "text-xs text-success" : "text-xs text-danger"}>{h.free > 0 ? `${h.free} free` : "none free"}</span> : null}
                    <Button size="sm" variant="primary" disabled={pending} onClick={() => run((c) => addItemAction(order.id, h.id, 1, c), `${h.name} added.`, () => setQ(""))}>
                      <Plus /> Add
                    </Button>
                  </li>
                ))}
              </ul>
            ) : q.trim() ? (
              <p className="text-sm text-muted">No products match “{q}”.</p>
            ) : null}
          </div>
        ) : null}

        {order.lines.length ? (
          <ul className="divide-y divide-line border-y border-line">
            {order.lines.map((l) => {
              const pl = order.plannings.find((p) => p.lineId === l.id);
              const short = order.shortages.find((s) => s.productId === l.productId);
              const units = pl?.unitIds.map((u) => unitNames[u] ?? "unit") ?? [];
              return (
                <li key={l.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-3 sm:grid-cols-[minmax(0,1fr)_6rem_7rem_auto]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink" title={l.title}>{l.title}</p>
                    <p className="text-xs text-muted">
                      {l.chargeLabel ? `${l.chargeLabel} at ${formatMoney(l.priceEachCents, currency)} each` : l.custom ? "Custom charge" : ""}
                      {units.length ? ` · ${units.join(", ")}` : ""}
                      {pl && pl.startedQty ? ` · ${pl.startedQty - pl.stoppedQty} out, ${pl.stoppedQty} back` : ""}
                    </p>
                    {short ? <p className="text-xs font-semibold text-danger">{short.short} short</p> : null}
                  </div>
                  <label className="sr-only" htmlFor={`qty-${l.id}`}>Quantity of {l.title}</label>
                  <Input
                    id={`qty-${l.id}`}
                    dense
                    type="number"
                    min={1}
                    defaultValue={l.quantity}
                    disabled={disabled || l.custom}
                    className="w-20 text-right"
                    onBlur={(e) => {
                      const n = Number(e.target.value);
                      if (n !== l.quantity) run((c) => setLineQuantityAction(order.id, l.id, n, c), undefined, undefined);
                    }}
                  />
                  <span className="text-right text-sm text-ink tabular-nums">{formatMoney(l.priceEachCents * l.quantity, currency)}</span>
                  {!disabled ? (
                    <Button variant="ghost" size="icon-sm" aria-label={`Remove ${l.title}`} onClick={() => run(() => removeLineAction(order.id, l.id))}>
                      <Trash2 />
                    </Button>
                  ) : <span />}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title="No items yet">Search above to add what the customer is renting.</EmptyState>
        )}

        {!disabled ? (
          custom ? (
            <form
              className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => addCustomLineAction(order.id, title, price), "Charge added.", () => { setCustom(false); setTitle(""); setPrice(0); });
              }}
            >
              <Field label="Description">{(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} required />}</Field>
              <Field label="Amount" hint="Negative for a discount.">{(p) => <MoneyInput {...p} currency={currency} valueCents={price} onValueCents={setPrice} />}</Field>
              <div className="flex gap-2">
                <Button onClick={() => setCustom(false)}>Cancel</Button>
                <Button type="submit" variant="primary">Add</Button>
              </div>
            </form>
          ) : (
            <Button variant="link" className="justify-self-start" onClick={() => setCustom(true)}>
              <Plus /> Add a one-off charge
            </Button>
          )
        ) : null}
        <div className="flex flex-wrap items-end justify-between gap-6">
          <p className="text-sm text-muted">{order.lines.length} lines, {count} items</p>
          <TotalsBlock currency={currency} subtotal={order.totals.subtotal} discount={order.totals.discount} tax={order.totals.tax} total={order.totals.total} deposit={order.totals.deposit} depositNote="Based on the items' replacement value" />
        </div>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------- hand out / take back

function HandOutDialog({ order, tracked }: { order: OrderView; tracked: string[] }) {
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [units, setUnits] = useState<Record<string, { id: string; identifier: string }[]>>({});
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [qty, setQty] = useState<Record<string, number>>({});
  const lines = order.plannings.filter((p) => p.quantity > p.startedQty);

  useEffect(() => {
    if (!open) return;
    let live = true;
    (async () => {
      const u: typeof units = {};
      const pk: typeof picked = {};
      const q: typeof qty = {};
      for (const pl of lines) {
        if (tracked.includes(pl.productId)) {
          const free = await freeUnitsAction(order.id, pl.lineId);
          u[pl.lineId] = free.filter((f) => !pl.startedUnitIds.includes(f.id));
          const preset = pl.unitIds.filter((x) => !pl.startedUnitIds.includes(x));
          pk[pl.lineId] = (preset.length ? preset : u[pl.lineId]!.map((f) => f.id)).slice(0, pl.quantity - pl.startedQty);
        } else q[pl.lineId] = pl.quantity - pl.startedQty;
      }
      if (live) {
        setUnits(u);
        setPicked(pk);
        setQty(q);
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const total = Object.values(picked).reduce((s, a) => s + a.length, 0) + Object.values(qty).reduce((s, n) => s + (n || 0), 0);
  const title = (lineId: string) => order.lines.find((l) => l.id === lineId)?.title ?? "";

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="Hand out items"
      description="Choose what leaves now. Anything left over can go out later."
      trigger={<Button variant="primary">Hand out</Button>}
      footer={
        <>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="primary"
            loading={pending}
            disabled={total === 0}
            onClick={() =>
              run(
                () => pickupAction(order.id, lines.map((pl) => (units[pl.lineId] ? { lineId: pl.lineId, unitIds: picked[pl.lineId] ?? [] } : { lineId: pl.lineId, quantity: qty[pl.lineId] ?? 0 }))),
                `${total} item${total === 1 ? "" : "s"} handed out.`,
                () => setOpen(false),
              )
            }
          >
            Hand out {total} item{total === 1 ? "" : "s"}
          </Button>
        </>
      }
    >
      <div className="grid gap-5">
        {lines.map((pl) =>
          units[pl.lineId] ? (
            <fieldset key={pl.lineId} className="grid gap-2">
              <legend className="mb-1 text-sm font-medium text-ink">
                {title(pl.lineId)} <span className="font-normal text-muted">({pl.quantity - pl.startedQty} to go)</span>
              </legend>
              {units[pl.lineId]!.length ? (
                units[pl.lineId]!.map((u) => {
                  const checked = picked[pl.lineId]?.includes(u.id) ?? false;
                  const full = (picked[pl.lineId]?.length ?? 0) >= pl.quantity - pl.startedQty;
                  return (
                    <label key={u.id} className="flex items-center gap-3 text-sm text-ink">
                      <Checkbox
                        checked={checked}
                        disabled={!checked && full}
                        onCheckedChange={(c) => setPicked((s) => ({ ...s, [pl.lineId]: c ? [...(s[pl.lineId] ?? []), u.id] : (s[pl.lineId] ?? []).filter((x) => x !== u.id) }))}
                      />
                      <span className="font-mono">{u.identifier}</span>
                    </label>
                  );
                })
              ) : (
                <p className="text-sm text-danger">No unit is free right now. One may still be out on another booking.</p>
              )}
            </fieldset>
          ) : (
            <Field key={pl.lineId} label={title(pl.lineId)} hint={`${pl.quantity - pl.startedQty} still to hand out`}>
              {(p) => <Input {...p} type="number" min={0} max={pl.quantity - pl.startedQty} value={qty[pl.lineId] ?? 0} onChange={(e) => setQty((s) => ({ ...s, [pl.lineId]: Number(e.target.value) }))} />}
            </Field>
          ),
        )}
      </div>
    </Dialog>
  );
}

function TakeBackDialog({ order, unitNames, currency }: { order: OrderView; unitNames: Record<string, string>; currency: string }) {
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const lines = order.plannings.filter((p) => p.startedQty > p.stoppedQty);
  const outUnits = (pl: (typeof lines)[number]) => pl.startedUnitIds.filter((u) => !pl.stoppedUnitIds.includes(u));
  const [picked, setPicked] = useState<Record<string, string[]>>(() => Object.fromEntries(lines.map((pl) => [pl.lineId, outUnits(pl)])));
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(lines.filter((pl) => !pl.startedUnitIds.length).map((pl) => [pl.lineId, pl.startedQty - pl.stoppedQty])));
  const [kept, setKept] = useState(0);
  const [reason, setReason] = useState("");
  const total = lines.reduce((s, pl) => s + (pl.startedUnitIds.length ? (picked[pl.lineId]?.length ?? 0) : qty[pl.lineId] ?? 0), 0);
  const title = (lineId: string) => order.lines.find((l) => l.id === lineId)?.title ?? "";
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="Take items back"
      description="Check off what came back. Missing items stay on the booking."
      trigger={<Button variant="primary">Take back</Button>}
      footer={
        <>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="primary"
            loading={pending}
            disabled={total === 0}
            onClick={() =>
              run(
                () =>
                  returnAction(
                    order.id,
                    lines.map((pl) => (pl.startedUnitIds.length ? { lineId: pl.lineId, unitIds: picked[pl.lineId] ?? [] } : { lineId: pl.lineId, quantity: qty[pl.lineId] ?? 0 })),
                    { keptCents: kept, reason },
                  ),
                `${total} item${total === 1 ? "" : "s"} back in stock.`,
                () => setOpen(false),
              )
            }
          >
            Take back {total} item{total === 1 ? "" : "s"}
          </Button>
        </>
      }
    >
      <div className="grid gap-5">
        {lines.map((pl) =>
          pl.startedUnitIds.length ? (
            <fieldset key={pl.lineId} className="grid gap-2">
              <legend className="mb-1 text-sm font-medium text-ink">{title(pl.lineId)}</legend>
              {outUnits(pl).map((u) => (
                <label key={u} className="flex items-center gap-3 text-sm text-ink">
                  <Checkbox
                    checked={picked[pl.lineId]?.includes(u) ?? false}
                    onCheckedChange={(c) => setPicked((s) => ({ ...s, [pl.lineId]: c ? [...(s[pl.lineId] ?? []), u] : (s[pl.lineId] ?? []).filter((x) => x !== u) }))}
                  />
                  <span className="font-mono">{unitNames[u] ?? "unit"}</span>
                </label>
              ))}
            </fieldset>
          ) : (
            <Field key={pl.lineId} label={title(pl.lineId)} hint={`${pl.startedQty - pl.stoppedQty} out`}>
              {(p) => <Input {...p} type="number" min={0} max={pl.startedQty - pl.stoppedQty} value={qty[pl.lineId] ?? 0} onChange={(e) => setQty((s) => ({ ...s, [pl.lineId]: Number(e.target.value) }))} />}
            </Field>
          ),
        )}
        <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
          <Field label="Keep from the deposit" hint={`Deposit on this booking: ${formatMoney(order.totals.deposit, currency)}`}>
            {(p) => <MoneyInput {...p} currency={currency} valueCents={kept} onValueCents={setKept} />}
          </Field>
          {kept > 0 ? <Field label="Why">{(p) => <Input {...p} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. cracked lens hood" />}</Field> : null}
        </div>
      </div>
    </Dialog>
  );
}
