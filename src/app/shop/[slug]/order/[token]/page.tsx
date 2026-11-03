import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { getOrderByToken, getOrgBySlug } from "@/lib/data/store";
import { formatDateTime, formatMoney } from "@/lib/time";

export default async function ConfirmationPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  const [org, order] = await Promise.all([getOrgBySlug(slug), getOrderByToken(token)]);
  if (!org || !order) notFound();
  const held = order.status === "reserved";
  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardBody className="grid gap-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-1 size-6 shrink-0 text-success" aria-hidden />
          <div className="grid gap-1">
            <h1 className="text-xl text-ink">{held ? "You are booked" : "Request received"}</h1>
            <p className="text-sm text-body">
              {held ? `Booking #${order.number} is confirmed and the items are held for you.` : `Request #${order.number} is with ${org.name}. They will confirm soon.`}
              {order.customer?.email ? ` A copy goes to ${order.customer.email}.` : ""}
            </p>
          </div>
        </div>
        {order.startsAt && order.stopsAt ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
            <dt className="text-body">Pickup</dt><dd className="text-ink">{formatDateTime(order.startsAt, org.timeZone)}</dd>
            <dt className="text-body">Return</dt><dd className="text-ink">{formatDateTime(order.stopsAt, org.timeZone)}</dd>
          </dl>
        ) : null}
        <ul className="grid gap-1 border-y border-line py-3 text-sm">
          {order.lines.map((l) => (
            <li key={l.id} className="flex justify-between gap-4"><span className="text-ink">{l.quantity} × {l.title}</span><span className="tabular-nums text-ink">{formatMoney(l.quantity * l.priceEachCents, org.currency)}</span></li>
          ))}
        </ul>
        <p className="flex justify-between text-sm font-semibold text-ink"><span>Total</span><span className="tabular-nums">{formatMoney(order.totals.total, org.currency)}</span></p>
        <p className="flex justify-between text-sm text-body"><span>Refundable deposit, paid at pickup</span><span className="tabular-nums">{formatMoney(order.totals.deposit, org.currency)}</span></p>
        <Link href={`/shop/${slug}`} className="text-sm text-link underline-offset-4 hover:underline">Back to the store</Link>
      </CardBody>
    </Card>
  );
}
