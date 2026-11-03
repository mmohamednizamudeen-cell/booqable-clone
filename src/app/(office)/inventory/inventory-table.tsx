"use client";

import Link from "next/link";
import { Package } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data";
import { EmptyState } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/pill";
import { buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/time";
import type { ProductRow } from "@/lib/data/store";

const typeLabel = (p: ProductRow) =>
  p.productType === "rental" ? (p.tracking === "individual" ? "Rental, each unit" : "Rental, by quantity") : p.productType === "service" ? "Service" : "For sale";

const priceLabel = (p: ProductRow, currency: string) =>
  p.priceType === "none" ? "Free" : p.priceType === "fixed" ? `${formatMoney(p.basePriceCents, currency)} fixed` : `${formatMoney(p.basePriceCents, currency)} / ${p.pricePeriod}`;

export function InventoryTable({ rows, currency, filtered }: { rows: ProductRow[]; currency: string; filtered: boolean }) {
  const columns: Column<ProductRow>[] = [
    {
      key: "name",
      header: "Name",
      cell: (p) => (
        <Link href={`/inventory/${p.id}`} className="block max-w-72 truncate font-medium text-ink hover:underline" title={p.name}>
          {p.name}
        </Link>
      ),
    },
    { key: "type", header: "Type", cell: typeLabel },
    { key: "price", header: "Price", align: "right", cell: (p) => priceLabel(p, currency) },
    { key: "stock", header: "Stock", align: "right", cell: (p) => (p.productType === "rental" ? p.stockCount : "") },
    { key: "store", header: "Online", cell: (p) => <StatusPill size="sm" tone={p.showInStore ? "success" : "neutral"}>{p.showInStore ? "Shown" : "Hidden"}</StatusPill> },
    { key: "sku", header: "SKU", cell: (p) => <span className="font-mono text-xs">{p.sku}</span> },
  ];
  return (
    <DataTable
      caption="Products"
      columns={columns}
      rows={rows}
      empty={
        filtered ? (
          <EmptyState icon={Package} title="No products match">Try another search or clear the filter.</EmptyState>
        ) : (
          <EmptyState icon={Package} title="No products yet" action={<Link href="/inventory/new" className={buttonVariants({ variant: "primary" })}>Add your first product</Link>}>
            Add what you rent out. Bookings and the online store use it straight away.
          </EmptyState>
        )
      }
    />
  );
}
