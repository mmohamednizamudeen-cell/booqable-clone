import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Package } from "lucide-react";
import { cartView, getOrgBySlug, getProductBySlug, monthAvailability } from "@/lib/data/store";
import { currentCartId } from "@/app/actions";
import { formatDateTime, formatMoney, toZonedInput } from "@/lib/time";
import { BookPanel } from "./book-panel";

export default async function ShopProductPage({ params }: { params: Promise<{ slug: string; product: string }> }) {
  const { slug, product: productSlug } = await params;
  const org = (await getOrgBySlug(slug))!;
  const product = await getProductBySlug(productSlug);
  if (!product || !product.showInStore) notFound();
  const today = toZonedInput(Date.now(), org.timeZone).slice(0, 10);
  const [y, m] = today.split("-").map(Number) as [number, number];
  const month = product.productType === "rental" ? await monthAvailability(product.id, y, m) : {};
  const id = await currentCartId();
  const cart = id ? await cartView(id) : null;
  const period = cart?.cart.startsAt != null && cart.cart.stopsAt != null ? { start: toZonedInput(cart.cart.startsAt, org.timeZone), end: toZonedInput(cart.cart.stopsAt, org.timeZone), label: `${formatDateTime(cart.cart.startsAt, org.timeZone)} to ${formatDateTime(cart.cart.stopsAt, org.timeZone)}` } : null;
  return (
    <>
      <Link href={`/shop/${slug}`} className="inline-flex items-center gap-1 text-sm text-link underline-offset-4 hover:underline">
        <ChevronLeft className="size-4" aria-hidden /> All items
      </Link>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="grid content-start gap-4">
          <div className="flex aspect-[4/3] items-center justify-center rounded-md border border-line bg-surface" aria-hidden>
            <Package className="size-16 text-muted" />
          </div>
          <h1 className="text-display text-ink">{product.name}</h1>
          <p className="text-lg text-ink">
            {product.priceType === "flat" ? `${formatMoney(product.basePriceCents, org.currency)} per ${product.pricePeriod}` : product.priceType === "fixed" ? formatMoney(product.basePriceCents, org.currency) : "Free"}
          </p>
          {product.description ? <p className="text-sm text-body">{product.description}</p> : null}
        </div>
        <BookPanel
          slug={slug}
          product={{ id: product.id, name: product.name, rental: product.productType === "rental" }}
          today={today}
          initialMonth={month}
          period={period}
          defaults={{ pickup: org.settings.defaultPickupTime, ret: org.settings.defaultReturnTime }}
        />
      </div>
    </>
  );
}
