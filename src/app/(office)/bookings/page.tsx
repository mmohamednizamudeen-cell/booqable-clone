import Link from "next/link";
import { Plus } from "lucide-react";
import { Page } from "@/components/app/page";
import { buttonVariants } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/card";
import { OrderTable } from "@/components/app/order-table";
import { getOrg, listOrders, type OrderTab } from "@/lib/data/store";
import { formatMoney } from "@/lib/time";
import { cn } from "@/lib/cn";
import { ListSearch } from "../inventory/filters";

const tabs: { value: OrderTab; label: string; empty: { title: string; body: string } }[] = [
  { value: "upcoming", label: "Coming up", empty: { title: "Nothing coming up", body: "New and reserved bookings starting from today show here." } },
  { value: "late", label: "Overdue", empty: { title: "Nothing overdue", body: "Bookings not picked up or not returned on time show here." } },
  { value: "shortage", label: "Short on stock", empty: { title: "No shortages", body: "Bookings that need more stock than you have show here." } },
  { value: "all", label: "All", empty: { title: "No bookings yet", body: "Create one with New booking, or share your online store." } },
];

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const sp = await searchParams;
  const tab = (tabs.find((t) => t.value === sp.tab) ?? tabs[0]!).value;
  const [orders, org] = await Promise.all([listOrders({ tab, q: sp.q }), getOrg()]);
  const active = tabs.find((t) => t.value === tab)!;
  const due = orders.filter((o) => o.status !== "draft").reduce((s, o) => s + o.totals.total, 0);
  return (
    <Page
      title="Bookings"
      search={<ListSearch placeholder="Number, customer or email" defaultValue={sp.q} />}
      actions={<Link href="/bookings/new" className={buttonVariants({ variant: "primary" })}><Plus /> <span className="hidden sm:inline">New booking</span></Link>}
    >
      <nav aria-label="Booking views" className="flex gap-6 overflow-x-auto border-b border-line text-sm font-medium">
        {tabs.map((t) => (
          <Link
            key={t.value}
            href={`/bookings?tab=${t.value}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`}
            aria-current={t.value === tab ? "page" : undefined}
            className={cn("-mb-px shrink-0 border-b-2 pb-2.5", t.value === tab ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink")}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <ListSearch className="md:hidden" placeholder="Number, customer or email" defaultValue={sp.q} />
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Bookings" value={orders.length} />
        <MetricCard label="Items" value={orders.reduce((s, o) => s + o.lines.reduce((x, l) => x + l.quantity, 0), 0)} />
        <MetricCard label="Still to collect" value={formatMoney(due, org.currency)} info="Totals of the bookings in this view, drafts left out. Payments are not recorded yet." />
      </div>
      <OrderTable orders={orders} currency={org.currency} timeZone={org.timeZone} empty={active.empty} />
    </Page>
  );
}
