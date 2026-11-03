"use client";

import Link from "next/link";
import { Inbox } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data";
import { EmptyState } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/pill";
import { formatDateTime, formatMoney } from "@/lib/time";
import type { OrderView } from "@/lib/data/types";
import { statusLabel, statusTone } from "./status";

export function OrderTable({ orders, currency, timeZone, empty }: { orders: OrderView[]; currency: string; timeZone: string; empty: { title: string; body: string } }) {
  const columns: Column<OrderView>[] = [
    { key: "number", header: "#", cell: (o) => <Link href={`/bookings/${o.id}`} className="font-medium text-ink hover:underline">#{o.number}</Link> },
    { key: "customer", header: "Customer", cell: (o) => <span className="block max-w-56 truncate" title={o.customer?.name}>{o.customer?.name ?? "No customer"}</span> },
    { key: "pickup", header: "Pickup", cell: (o) => (o.startsAt ? formatDateTime(o.startsAt, timeZone) : "") },
    { key: "return", header: "Return", cell: (o) => (o.stopsAt ? formatDateTime(o.stopsAt, timeZone) : "") },
    {
      key: "status",
      header: "Status",
      cell: (o) => (
        <span className="flex flex-wrap gap-1">
          <StatusPill size="sm" tone={statusTone(o)}>{statusLabel(o)}</StatusPill>
          {o.late ? <StatusPill size="sm" tone="warning">Late</StatusPill> : null}
          {o.shortages.length ? <StatusPill size="sm" tone="danger">Short</StatusPill> : null}
        </span>
      ),
    },
    { key: "total", header: "Total", align: "right", cell: (o) => formatMoney(o.totals.total, currency) },
  ];
  return <DataTable caption="Bookings" columns={columns} rows={orders} empty={<EmptyState icon={Inbox} title={empty.title}>{empty.body}</EmptyState>} />;
}
