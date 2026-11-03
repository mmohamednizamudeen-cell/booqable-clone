import { redirect } from "next/navigation";
import { cartView, getOrgBySlug } from "@/lib/data/store";
import { currentCartId } from "@/app/actions";
import { formatDateTime, formatMoney } from "@/lib/time";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CheckoutForm } from "./checkout-form";

export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = (await getOrgBySlug(slug))!;
  const id = await currentCartId();
  const cart = id ? await cartView(id) : null;
  if (!cart || !cart.lines.length) redirect(`/shop/${slug}/cart`);
  return (
    <>
      <h1 className="text-display text-ink">Checkout</h1>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <CheckoutForm slug={slug} canCheckout={cart.canCheckout} problems={cart.problems} />
        <Card className="h-fit">
          <CardHeader title="Your booking" />
          <CardBody className="grid gap-3 text-sm">
            {cart.cart.startsAt && cart.cart.stopsAt ? (
              <p className="text-body">
                {formatDateTime(cart.cart.startsAt, org.timeZone)} to {formatDateTime(cart.cart.stopsAt, org.timeZone)}
              </p>
            ) : null}
            <ul className="grid gap-1">
              {cart.lines.map((l) => (
                <li key={l.id} className="flex justify-between gap-4">
                  <span className="truncate text-ink">{l.quantity} × {l.product.name}</span>
                  <span className="tabular-nums text-ink">{formatMoney(l.priceEachCents * l.quantity, org.currency)}</span>
                </li>
              ))}
            </ul>
            <p className="flex justify-between border-t border-line pt-3 font-semibold text-ink"><span>Total</span><span className="tabular-nums">{formatMoney(cart.totals.total, org.currency)}</span></p>
            <p className="flex justify-between text-body"><span>Refundable deposit</span><span className="tabular-nums">{formatMoney(cart.totals.deposit, org.currency)}</span></p>
            <p className="text-xs text-muted">Nothing is charged online yet. You pay when you collect.</p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
