import { redirect } from "next/navigation";
import { newOrder } from "@/lib/data/store";

// Opens the member's unsaved booking (created on first visit, then reused).
export default async function NewBookingPage() {
  const o = await newOrder();
  redirect(`/bookings/${o.id}`);
}
