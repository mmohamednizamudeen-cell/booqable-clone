"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data";
import { Field, Input } from "@/components/ui/form";
import { Dialog, useToast } from "@/components/ui/overlay";
import { Avatar } from "@/components/ui/pill";
import { createCustomerAction } from "@/app/actions";
import type { CustomerRow } from "@/lib/data/store";
import { formatDate, formatMoney } from "@/lib/time";

export function CustomerTable({ rows, currency, timeZone, filtered }: { rows: CustomerRow[]; currency: string; timeZone: string; filtered: boolean }) {
  const columns: Column<CustomerRow>[] = [
    { key: "n", header: "#", cell: (c) => c.number },
    {
      key: "name",
      header: "Name",
      cell: (c) => (
        <Link href={`/customers/${c.id}`} className="flex items-center gap-2 font-medium text-ink hover:underline">
          <Avatar name={c.name} size={24} />
          <span className="max-w-56 truncate" title={c.name}>{c.name}</span>
        </Link>
      ),
    },
    { key: "email", header: "Email", cell: (c) => c.email ?? "" },
    { key: "orders", header: "Bookings", align: "right", cell: (c) => c.orderCount },
    { key: "latest", header: "Latest booking", cell: (c) => (c.latestOrderAt ? formatDate(c.latestOrderAt, timeZone) : "") },
    { key: "due", header: "Booked value", align: "right", cell: (c) => formatMoney(c.balanceDueCents, currency) },
  ];
  return (
    <DataTable
      caption="Customers"
      columns={columns}
      rows={rows}
      empty={filtered ? <EmptyState icon={Users} title="Nobody matches">Try another name or email.</EmptyState> : <EmptyState icon={Users} title="No customers yet">They are added when you book for someone or when they book online.</EmptyState>}
    />
  );
}

export function NewCustomerButton() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      size="sm"
      title="New customer"
      trigger={<Button variant="primary"><UserPlus /> <span className="hidden sm:inline">New customer</span></Button>}
      footer={
        <>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="primary"
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await createCustomerAction({ name, email, phone });
                if (!r.ok) return setError(r.message);
                toast("success", `${r.data.name} added.`);
                setOpen(false);
                setName("");
                setEmail("");
                setPhone("");
                router.refresh();
              })
            }
          >
            Add customer
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        <Field label="Name">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} autoFocus />}</Field>
        <Field label="Email (optional)">{(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
        <Field label="Phone (optional)">{(p) => <Input {...p} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
      </div>
    </Dialog>
  );
}
