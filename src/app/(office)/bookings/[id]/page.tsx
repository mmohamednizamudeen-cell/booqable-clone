import { notFound } from "next/navigation";
import { Page } from "@/components/app/page";
import { getOrder, getOrg, getProduct, productStock } from "@/lib/data/store";
import { BookingEditor } from "./booking-editor";
import { StatusPill } from "@/components/ui/pill";
import { statusLabel, statusTone } from "@/components/app/status";

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, org] = await Promise.all([getOrder(id), getOrg()]);
  if (!order) notFound();
  // names of every unit that could appear on this booking
  const unitNames: Record<string, string> = {};
  const tracked: string[] = [];
  for (const pid of new Set(order.plannings.map((p) => p.productId))) {
    if ((await getProduct(pid))?.tracking === "individual") tracked.push(pid);
    for (const u of (await productStock(pid)).units) unitNames[u.id] = u.identifier;
  }
  return (
    <Page
      title={order.number ? `Booking #${order.number}` : "New booking"}
      breadcrumb={["Bookings"]}
      actions={<StatusPill tone={statusTone(order)}>{statusLabel(order)}</StatusPill>}
    >
      <BookingEditor order={order} currency={org.currency} timeZone={org.timeZone} unitNames={unitNames} tracked={tracked} defaults={org.settings} />
    </Page>
  );
}
