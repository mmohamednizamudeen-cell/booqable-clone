import { notFound } from "next/navigation";
import { Page } from "@/components/app/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/pill";
import { OrderTable } from "@/components/app/order-table";
import { getCustomer, getOrg, listOrders } from "@/lib/data/store";
import { formatDate } from "@/lib/time";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();
  const [orders, org] = await Promise.all([listOrders({ tab: "all", customerId: id }), getOrg()]);
  return (
    <Page title={customer.name} breadcrumb={["Customers"]}>
      <Card>
        <CardBody className="flex flex-wrap items-center gap-4">
          <Avatar name={customer.name} size={40} />
          <div className="grid min-w-0 flex-1 gap-0.5">
            <p className="truncate text-lg text-ink">{customer.name}</p>
            <p className="text-sm text-body">{[customer.email, customer.phone].filter(Boolean).join(" · ") || "No contact details yet"}</p>
          </div>
          <p className="text-sm text-muted">Customer #{customer.number} since {formatDate(customer.createdAt, org.timeZone)}</p>
        </CardBody>
      </Card>
      <Card className="overflow-hidden border-0 bg-transparent">
        <CardHeader title="Bookings" className="border-0 px-0 pt-0" />
        <OrderTable orders={orders} currency={org.currency} timeZone={org.timeZone} empty={{ title: "No bookings yet", body: "Bookings for this customer show here." }} />
      </Card>
    </Page>
  );
}
