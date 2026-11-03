"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Boxes, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader, EmptyState } from "@/components/ui/card";
import { Field, Input, MoneyInput, RadioGroup, Switch, Textarea } from "@/components/ui/form";
import { Dialog, useToast } from "@/components/ui/overlay";
import { StockDot, StatusPill } from "@/components/ui/pill";
import { Tabs } from "@/components/ui/data";
import { addStockAction, archiveUnitAction, updateProductAction } from "@/app/actions";
import type { Product, StockBatch, UnitView } from "@/lib/data/types";
import { formatMoney } from "@/lib/time";

type Stock = { units: UnitView[]; batches: StockBatch[]; total: number; out: number };

const unitState = { available: "available", out: "out", overdue: "short", expected: "expected", expired: "downtime" } as const;
const unitWord = { available: "In stock", out: "With a customer", overdue: "Overdue back", expected: "Arriving later", expired: "Temporary, ended" };

export function ProductEditor({ product, stock, currency, stockError }: { product: Product; stock: Stock; currency: string; stockError?: string }) {
  const rental = product.productType === "rental";
  return (
    <>
      {stockError ? (
        <p role="alert" className="rounded-md border border-danger bg-danger-subtle px-4 py-3 text-sm text-danger">
          The product was saved, but its stock was not: {stockError}
        </p>
      ) : null}
      <Tabs
        tabs={[...(rental ? [{ value: "stock", label: "Stock" }] : []), { value: "settings", label: "Settings and price" }]}
        defaultValue={rental ? "stock" : "settings"}
      >
        {(tab) => (tab === "stock" ? <StockPanel product={product} stock={stock} /> : <SettingsPanel product={product} currency={currency} />)}
      </Tabs>
    </>
  );
}

function StockPanel({ product, stock }: { product: Product; stock: Stock }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const tracked = product.tracking === "individual";
  const remove = (unitId: string, ident: string) =>
    start(async () => {
      const r = await archiveUnitAction(product.id, unitId);
      if (!r.ok) toast("error", r.message);
      else {
        toast("success", `${ident} removed from stock.`);
        router.refresh();
      }
    });

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-body">In stock</p>
          <p className="mt-1 text-display text-ink tabular-nums">{stock.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-body">Out right now</p>
          <p className="mt-1 text-display text-ink tabular-nums">{stock.out}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-body">Temporary or arriving</p>
          <p className="mt-1 text-display text-ink tabular-nums">
            {tracked ? stock.units.filter((u) => u.kind === "temporary" || u.state === "expected").length : stock.batches.filter((b) => b.kind === "temporary" || b.availableFrom).reduce((s, b) => s + b.quantity, 0)}
          </p>
        </Card>
      </div>
      <Card>
        <CardHeader title={tracked ? "Units" : "Stock additions"} actions={<AddStockDialog product={product} />} />
        {tracked ? (
          stock.units.length ? (
            <ul className="divide-y divide-line">
              {stock.units.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-3">
                  <span className="w-28 font-mono text-sm text-ink">{u.identifier}</span>
                  <span className="flex-1">
                    <StockDot state={unitState[u.state]} labelHidden />
                    <span className="ml-2 text-sm text-body">{unitWord[u.state]}</span>
                    {u.heldBy ? (
                      <Link href={`/bookings/${u.heldBy.orderId}`} className="ml-2 text-sm text-link underline-offset-4 hover:underline">
                        booking #{u.heldBy.number}
                      </Link>
                    ) : null}
                  </span>
                  {u.kind === "temporary" ? <StatusPill size="sm" tone="accent">Temporary</StatusPill> : null}
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${u.identifier}`} disabled={pending} onClick={() => remove(u.id, u.identifier)}>
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Boxes} title="No units yet">Add the units you own so they can be booked.</EmptyState>
          )
        ) : stock.batches.length ? (
          <ul className="divide-y divide-line">
            {stock.batches.map((b) => (
              <li key={b.id} className="flex items-center gap-4 px-6 py-3 text-sm">
                <span className="w-16 text-ink tabular-nums">+{b.quantity}</span>
                <span className="flex-1 text-body">{b.kind === "temporary" ? "Temporary stock" : b.availableFrom ? "Arriving" : "Regular stock"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Boxes} title="No stock yet">Add how many you own so they can be booked.</EmptyState>
        )}
      </Card>
    </div>
  );
}

function AddStockDialog({ product }: { product: Product }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [kind, setKind] = useState("regular");
  const [ids, setIds] = useState("");
  const [qty, setQty] = useState("1");
  const [from, setFrom] = useState("");
  const [till, setTill] = useState("");
  const [error, setError] = useState<string | null>(null);
  const tracked = product.tracking === "individual";
  const submit = () =>
    start(async () => {
      setError(null);
      const window = kind === "temporary" ? { availableFrom: from || undefined, availableTill: till || undefined } : kind === "expected" ? { availableFrom: from || undefined } : {};
      if (kind === "temporary" && !till) return setError("Temporary stock needs an end date.");
      if (kind === "expected" && !from) return setError("Arriving stock needs the date it arrives.");
      const r = await addStockAction(product.id, tracked ? { identifiers: ids.split(/[\n,]+/), ...window } : { quantity: Number(qty), ...window });
      if (!r.ok) return setError(r.message);
      toast("success", "Stock added.");
      setOpen(false);
      setIds("");
      router.refresh();
    });
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="Add stock"
      trigger={<Button size="sm">Add stock</Button>}
      footer={
        <>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="primary" loading={pending} onClick={submit}>
            Add
          </Button>
        </>
      }
    >
      <div className="grid gap-5">
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        <RadioGroup
          value={kind}
          onValueChange={setKind}
          aria-label="Kind of stock"
          options={[
            { value: "regular", label: "Regular", hint: "Yours to rent out from now on." },
            { value: "expected", label: "Arriving later", hint: "Bookable from the date it arrives." },
            { value: "temporary", label: "Temporary", hint: "Borrowed or sub-rented for a set time." },
          ]}
        />
        {tracked ? (
          <Field label="Unit IDs" hint="One per line or separated by commas.">{(p) => <Textarea {...p} value={ids} onChange={(e) => setIds(e.target.value)} />}</Field>
        ) : (
          <Field label="Quantity">{(p) => <Input {...p} type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />}</Field>
        )}
        {kind !== "regular" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={kind === "expected" ? "Arrives" : "From (optional)"}>{(p) => <Input {...p} type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
            {kind === "temporary" ? <Field label="Until">{(p) => <Input {...p} type="datetime-local" value={till} onChange={(e) => setTill(e.target.value)} />}</Field> : null}
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}

function SettingsPanel({ product, currency }: { product: Product; currency: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description);
  const [price, setPrice] = useState(product.basePriceCents);
  const [deposit, setDeposit] = useState(product.depositValueCents);
  const [before, setBefore] = useState(String(product.bufferBeforeSec / 3600));
  const [after, setAfter] = useState(String(product.bufferAfterSec / 3600));
  const [allowShortage, setAllow] = useState(product.allowShortage);
  const [limit, setLimit] = useState(String(product.shortageLimit));
  const [show, setShow] = useState(product.showInStore);
  const rental = product.productType === "rental";
  const save = () =>
    start(async () => {
      const hours = (v: string) => Math.max(0, Math.round(Number(v) * 3600)) || 0;
      const r = await updateProductAction(product.id, {
        name,
        description,
        basePriceCents: price,
        depositValueCents: deposit,
        bufferBeforeSec: hours(before),
        bufferAfterSec: hours(after),
        allowShortage,
        shortageLimit: Math.max(0, Math.floor(Number(limit)) || 0),
        showInStore: show,
      });
      if (!r.ok) return toast("error", r.message);
      toast("success", "Saved. Existing bookings keep the buffers they were booked with.");
      router.refresh();
    });
  const per = product.priceType === "flat" ? ` per ${product.pricePeriod}` : product.priceType === "fixed" ? " per booking" : "";
  return (
    <Card>
      <CardBody className="grid gap-5 md:grid-cols-2">
        <Field label="Name" className="md:col-span-2">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />}</Field>
        <Field label="Description" className="md:col-span-2">{(p) => <Textarea {...p} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
        {product.priceType !== "none" ? (
          <Field label={`Price${per}`} hint={`Now ${formatMoney(product.basePriceCents, currency)}${per}.`}>
            {(p) => <MoneyInput {...p} currency={currency} valueCents={price} onValueCents={setPrice} />}
          </Field>
        ) : null}
        {rental ? (
          <>
            <Field label="Replacement value" hint="Used for the security deposit.">{(p) => <MoneyInput {...p} currency={currency} valueCents={deposit} onValueCents={setDeposit} />}</Field>
            <Field label="Prep time before each booking (hours)">{(p) => <Input {...p} type="number" min={0} step={0.5} value={before} onChange={(e) => setBefore(e.target.value)} />}</Field>
            <Field label="Turnaround after each booking (hours)" hint="Cleaning, charging, checks.">{(p) => <Input {...p} type="number" min={0} step={0.5} value={after} onChange={(e) => setAfter(e.target.value)} />}</Field>
            <label className="flex items-start gap-3 md:col-span-2">
              <Switch checked={allowShortage} onCheckedChange={setAllow} className="mt-0.5" />
              <span className="grid gap-0.5">
                <span className="text-sm font-medium text-ink">Allow overbooking</span>
                <span className="text-sm text-body">Take more bookings than you have, up to a limit, when you can rent in extra.</span>
              </span>
            </label>
            {allowShortage ? <Field label="Overbooking limit">{(p) => <Input {...p} type="number" min={0} value={limit} onChange={(e) => setLimit(e.target.value)} />}</Field> : null}
          </>
        ) : null}
        <label className="flex items-start gap-3 md:col-span-2">
          <Switch checked={show} onCheckedChange={setShow} className="mt-0.5" />
          <span className="text-sm font-medium text-ink">Offer it in the online store</span>
        </label>
      </CardBody>
      <CardFooter>
        <Button variant="primary" loading={pending} onClick={save}>
          Save changes
        </Button>
      </CardFooter>
    </Card>
  );
}
