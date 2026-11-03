import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Page } from "@/components/app/page";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/pill";
import { dashboard, getOrg } from "@/lib/data/store";
import { dayBounds, formatDateTime, zonedDate } from "@/lib/time";
import { cn } from "@/lib/cn";
import type { OrderView } from "@/lib/data/types";

const ranges = [
  { value: "today", label: "Today", days: 1 },
  { value: "week", label: "Next 7 days", days: 7 },
];

function Row({ o, when, timeZone }: { o: OrderView; when: number; timeZone: string }) {
  return (
    <li>
      <Link href={`/bookings/${o.id}`} className="flex items-center gap-3 px-6 py-3 hover:bg-surface-muted">
        <span className="grid min-w-0 flex-1">
          <span className="truncate text-sm font-medium text-ink">#{o.number} {o.customer?.name ?? "No customer"}</span>
          <span className="truncate text-xs text-muted">{o.lines.map((l) => `${l.quantity} × ${l.title}`).join(", ")}</span>
        </span>
        <span className="grid justify-items-end gap-1">
          <span className="text-xs text-body">{formatDateTime(when, timeZone)}</span>
          {o.late ? <StatusPill size="sm" tone="warning">Late</StatusPill> : null}
        </span>
      </Link>
    </li>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const sp = await searchParams;
  const range = ranges.find((r) => r.value === sp.range) ?? ranges[0]!;
  const org = await getOrg();
  const [from] = dayBounds(zonedDate(Date.now(), org.timeZone), org.timeZone);
  const till = dayBounds(zonedDate(from + (range.days - 1) * 86_400_000 + 12 * 3_600_000, org.timeZone), org.timeZone)[1];
  const { goingOut, comingBack } = await dashboard(from, till);
  const picker = (
    <nav aria-label="Period" className="flex gap-1 rounded-md border border-line-input p-0.5">
      {ranges.map((r) => (
        <Link key={r.value} href={`/dashboard?range=${r.value}`} aria-current={r === range ? "page" : undefined} className={cn("rounded-sm px-3 py-1.5 text-sm", r === range ? "bg-accent-subtle font-medium text-accent" : "text-body hover:text-ink")}>
          {r.label}
        </Link>
      ))}
    </nav>
  );
  return (
    <Page title="Today" actions={picker}>
      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader title="Going out" description={`${goingOut.length} booking${goingOut.length === 1 ? "" : "s"} to hand out`} />
          {goingOut.length ? (
            <ul className="divide-y divide-line">{goingOut.map((o) => <Row key={o.id} o={o} when={o.startsAt!} timeZone={org.timeZone} />)}</ul>
          ) : (
            <EmptyState icon={ArrowUpRight} title="Nothing to hand out">Reserved bookings starting in this period show up here.</EmptyState>
          )}
        </Card>
        <Card>
          <CardHeader title="Coming back" description={`${comingBack.length} booking${comingBack.length === 1 ? "" : "s"} due back`} />
          {comingBack.length ? (
            <ul className="divide-y divide-line">{comingBack.map((o) => <Row key={o.id} o={o} when={o.stopsAt!} timeZone={org.timeZone} />)}</ul>
          ) : (
            <EmptyState icon={ArrowDownLeft} title="Nothing due back">Bookings due to return in this period show up here.</EmptyState>
          )}
        </Card>
      </div>
    </Page>
  );
}
