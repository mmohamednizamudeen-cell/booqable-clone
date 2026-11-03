"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Field, Input, MoneyInput, RadioGroup, Select, Switch, Textarea } from "@/components/ui/form";
import { addStockAction, createProductAction } from "@/app/actions";
import type { PricePeriod, PriceType } from "@/lib/engine/pricing";
import type { ProductType, Tracking } from "@/lib/data/types";

export function NewProductForm({ currency }: { currency: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [productType, setType] = useState<ProductType>("rental");
  const [tracking, setTracking] = useState<Tracking>("individual");
  const [priceType, setPriceType] = useState<PriceType>("flat");
  const [period, setPeriod] = useState<PricePeriod>("day");
  const [price, setPrice] = useState(0);
  const [deposit, setDeposit] = useState(0);
  const [description, setDescription] = useState("");
  const [showInStore, setShow] = useState(true);
  const [identifiers, setIdentifiers] = useState("");
  const [quantity, setQuantity] = useState("10");

  const rental = productType === "rental";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await createProductAction({
        name,
        productType,
        tracking: rental ? tracking : "none",
        priceType: productType === "sales_item" && priceType === "flat" ? "fixed" : priceType,
        pricePeriod: priceType === "flat" ? period : undefined,
        basePriceCents: price,
        depositValueCents: deposit,
        description,
        showInStore,
      });
      if (!r.ok) return setError(r.message);
      if (rental) {
        const ids = identifiers.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
        const qty = Number(quantity);
        const s = tracking === "individual" ? (ids.length ? await addStockAction(r.data.id, { identifiers: ids }) : null) : qty > 0 ? await addStockAction(r.data.id, { quantity: qty }) : null;
        if (s && !s.ok) {
          router.push(`/inventory/${r.data.id}?stockError=${encodeURIComponent(s.message)}`);
          return;
        }
      }
      router.push(`/inventory/${r.data.id}`);
    });
  };

  return (
    <form onSubmit={submit} className="grid max-w-3xl gap-6" noValidate>
      {error ? (
        <p role="alert" className="rounded-md border border-danger bg-danger-subtle px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Card>
        <CardHeader title="What is it?" />
        <CardBody className="grid gap-5">
          <Field label="Name" hint="Customers see this in the store and on their confirmation.">
            {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} autoFocus />}
          </Field>
          <Field label="Kind of product">
            {(p) => (
              <Select {...p} value={productType} onChange={(e) => setType(e.target.value as ProductType)}>
                <option value="rental">Rental: goes out and comes back</option>
                <option value="service">Service: an extra like delivery or setup</option>
                <option value="sales_item">For sale: sold, not returned</option>
              </Select>
            )}
          </Field>
          {rental ? (
            <fieldset className="grid gap-3">
              <legend className="mb-1 text-sm font-medium text-ink">How do you keep track of it? You cannot change this later.</legend>
              <RadioGroup
                value={tracking}
                onValueChange={(v) => setTracking(v as Tracking)}
                aria-label="Tracking"
                options={[
                  { value: "individual", label: "Each unit has its own ID", hint: "Cameras, vehicles, anything with a serial number." },
                  { value: "bulk", label: "By quantity", hint: "Chairs, cutlery, cables: you only need the count." },
                ]}
              />
            </fieldset>
          ) : null}
          <Field label="Description (optional)">{(p) => <Textarea {...p} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Price" />
        <CardBody className="grid gap-5 md:grid-cols-2">
          <Field label="How you charge">
            {(p) => (
              <Select {...p} value={priceType} onChange={(e) => setPriceType(e.target.value as PriceType)}>
                {productType !== "sales_item" ? <option value="flat">Per period of time</option> : null}
                <option value="fixed">One price per booking</option>
                <option value="none">Free</option>
              </Select>
            )}
          </Field>
          {priceType === "flat" && productType !== "sales_item" ? (
            <Field label="Period" hint="Partial periods are charged as a full one.">
              {(p) => (
                <Select {...p} value={period} onChange={(e) => setPeriod(e.target.value as PricePeriod)}>
                  <option value="hour">Hour</option>
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                </Select>
              )}
            </Field>
          ) : null}
          {priceType !== "none" ? <Field label="Price">{(p) => <MoneyInput {...p} currency={currency} valueCents={price} onValueCents={setPrice} />}</Field> : null}
          {rental ? (
            <Field label="Replacement value" hint="Used to work out the security deposit.">
              {(p) => <MoneyInput {...p} currency={currency} valueCents={deposit} onValueCents={setDeposit} />}
            </Field>
          ) : null}
        </CardBody>
      </Card>

      {rental ? (
        <Card>
          <CardHeader title="Stock" description="You can add more stock at any time." />
          <CardBody>
            {tracking === "individual" ? (
              <Field label="Unit IDs" hint="One per line, or separated by commas. Short and easy to read, like CAM-01.">
                {(p) => <Textarea {...p} value={identifiers} onChange={(e) => setIdentifiers(e.target.value)} placeholder={"CAM-01\nCAM-02"} />}
              </Field>
            ) : (
              <Field label="Quantity in stock">{(p) => <Input {...p} type="number" min={0} inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />}</Field>
            )}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardBody>
          <label className="flex items-start gap-3">
            <Switch checked={showInStore} onCheckedChange={setShow} className="mt-0.5" />
            <span className="grid gap-0.5">
              <span className="text-sm font-medium text-ink">Offer it in the online store</span>
              <span className="text-sm text-body">Customers can find and book it on your booking page.</span>
            </span>
          </label>
        </CardBody>
        <CardFooter>
          <Button onClick={() => router.push("/inventory")}>Cancel</Button>
          <Button type="submit" variant="primary" loading={pending}>
            Save product
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
