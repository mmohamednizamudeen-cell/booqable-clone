"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { shopCheckoutAction } from "@/app/actions";

export function CheckoutForm({ slug, canCheckout, problems }: { slug: string; canCheckout: boolean; problems: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return; // a double click makes one booking
    setError(null);
    start(async () => {
      const r = await shopCheckoutAction(slug, { name, email, phone });
      if (!r.ok) return setError(r.message);
      router.push(`/shop/${slug}/order/${r.data.orderToken}`);
    });
  };
  return (
    <form onSubmit={submit} noValidate>
      <Card>
        <CardHeader title="Your details" description="We send the confirmation to this email." />
        <CardBody className="grid gap-4 md:grid-cols-2">
          <Field label="Full name" className="md:col-span-2">{(p) => <Input {...p} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />}</Field>
          <Field label="Email">{(p) => <Input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}</Field>
          <Field label="Phone (optional)">{(p) => <Input {...p} type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
        </CardBody>
        <CardFooter className="flex-wrap justify-between">
          <Link href={`/shop/${slug}/cart`} className="text-sm text-link underline-offset-4 hover:underline">Back to cart</Link>
          <div className="grid justify-items-end gap-2">
            {error ? <p role="alert" className="max-w-md text-right text-sm text-danger">{error}</p> : null}
            {!canCheckout ? <p role="status" className="text-sm text-danger">{problems.join(" ")}</p> : null}
            <Button type="submit" variant="primary" loading={pending} disabled={!canCheckout}>
              Book now
            </Button>
          </div>
        </CardFooter>
      </Card>
    </form>
  );
}
