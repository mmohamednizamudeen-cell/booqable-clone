import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Card, EmptyState } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cartView, getOrgBySlug } from "@/lib/data/store";
import { currentCartId } from "@/app/actions";
import { toZonedInput } from "@/lib/time";
import { CartEditor } from "./cart-editor";

export default async function CartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = (await getOrgBySlug(slug))!;
  const id = await currentCartId();
  const cart = id ? await cartView(id) : null;
  if (!cart || !cart.lines.length)
    return (
      <Card>
        <EmptyState icon={ShoppingBag} title="Your cart is empty" action={<Link href={`/shop/${slug}`} className={buttonVariants({ variant: "primary" })}>Browse items</Link>}>
          Add an item and choose your dates to get started.
        </EmptyState>
      </Card>
    );
  return (
    <>
      <h1 className="text-display text-ink">Your cart</h1>
      <CartEditor
        slug={slug}
        cart={cart}
        currency={org.currency}
        period={cart.cart.startsAt != null && cart.cart.stopsAt != null ? { start: toZonedInput(cart.cart.startsAt, org.timeZone), end: toZonedInput(cart.cart.stopsAt, org.timeZone) } : null}
      />
    </>
  );
}
