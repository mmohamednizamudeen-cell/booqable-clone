import Link from "next/link";
import { Plus } from "lucide-react";
import { Page } from "@/components/app/page";
import { buttonVariants } from "@/components/ui/button";
import { listProducts } from "@/lib/data/store";
import { getOrg } from "@/lib/data/store";
import { InventoryTable } from "./inventory-table";
import { ListSearch, TypeFilter } from "./filters";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string }> }) {
  const { q, type } = await searchParams;
  const [products, org] = await Promise.all([listProducts({ q, type }), getOrg()]);
  const all = await listProducts();
  const counts = { rental: 0, service: 0, sales_item: 0 } as Record<string, number>;
  for (const p of all) counts[p.productType] = (counts[p.productType] ?? 0) + 1;
  return (
    <Page
      title="Inventory"
      search={<ListSearch placeholder="Search by name or SKU" defaultValue={q} />}
      actions={
        <Link href="/inventory/new" className={buttonVariants({ variant: "primary" })}>
          <Plus /> <span className="hidden sm:inline">Add product</span>
        </Link>
      }
      flush
    >
      <div className="flex min-h-full">
        <TypeFilter current={type} counts={counts} />
        <div className="grid min-w-0 flex-1 content-start gap-4 p-4 md:p-6">
          <nav aria-label="Inventory sections" className="flex gap-6 border-b border-line text-sm font-medium">
            <span aria-current="page" className="-mb-px border-b-2 border-accent pb-2.5 text-ink">Products</span>
            <Link href="/inventory/bundles" className="pb-2.5 text-muted hover:text-ink">Bundles</Link>
            <Link href="/inventory/downtime" className="pb-2.5 text-muted hover:text-ink">Downtime</Link>
          </nav>
          <ListSearch className="md:hidden" placeholder="Search by name or SKU" defaultValue={q} />
          <InventoryTable rows={products} currency={org.currency} filtered={Boolean(q || type)} />
          <p className="text-right text-xs text-muted">
            {products.length} of {all.length} products
          </p>
        </div>
      </div>
    </Page>
  );
}
