import Link from "next/link";
import { Package } from "lucide-react";
import { Card, EmptyState } from "@/components/ui/card";
import { getOrgBySlug, listProducts } from "@/lib/data/store";
import { formatMoney } from "@/lib/time";

export default async function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = (await getOrgBySlug(slug))!;
  const products = await listProducts({ storeOnly: true });
  return (
    <>
      <div className="grid gap-1">
        <h1 className="text-display text-ink">Rent from {org.name}</h1>
        <p className="text-sm text-body">Pick an item, choose your dates, and we hold it for you.</p>
      </div>
      {products.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <li key={p.id}>
              <Link href={`/shop/${slug}/p/${p.slug}`} className="group block h-full rounded-md border border-line bg-surface p-5 hover:border-line-input">
                <div className="mb-4 flex aspect-[4/3] items-center justify-center rounded-md bg-surface-muted" aria-hidden>
                  <Package className="size-10 text-muted" />
                </div>
                <h2 className="truncate text-lg text-ink group-hover:underline" title={p.name}>{p.name}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-body">{p.description}</p>
                <p className="mt-3 text-sm font-semibold text-ink">
                  {p.priceType === "flat" ? `${formatMoney(p.basePriceCents, org.currency)} per ${p.pricePeriod}` : p.priceType === "fixed" ? formatMoney(p.basePriceCents, org.currency) : "Free"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <EmptyState icon={Package} title="Nothing to rent yet">Check back soon.</EmptyState>
        </Card>
      )}
    </>
  );
}
