import Link from "next/link";
import { notFound } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { cartView, getOrgBySlug } from "@/lib/data/store";
import { currentCartId } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function ShopLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org || !org.settings.storeLive) notFound();
  const id = await currentCartId();
  const cart = id ? await cartView(id) : null;
  const count = cart?.lines.reduce((s, l) => s + l.quantity, 0) ?? 0;
  return (
    <div className="min-h-dvh bg-bg">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-[var(--layout-header)] max-w-[var(--layout-content-max)] items-center justify-between gap-4 px-4 md:px-6">
          <Link href={`/shop/${slug}`} className="truncate text-lg text-ink">{org.name}</Link>
          <Link href={`/shop/${slug}/cart`} className="inline-flex items-center gap-2 rounded-md border border-line-input px-3 py-2 text-sm text-ink hover:bg-surface-muted">
            <ShoppingBag className="size-4" aria-hidden />
            Cart
            <span className="rounded-pill bg-accent px-1.5 text-xs text-on-accent tabular-nums">{count}</span>
            <span className="sr-only">items</span>
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto grid max-w-[var(--layout-content-max)] grid-cols-[minmax(0,1fr)] gap-6 p-4 md:p-6">{children}</main>
    </div>
  );
}
