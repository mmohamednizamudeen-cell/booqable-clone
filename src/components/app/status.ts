import type { OrderView } from "@/lib/data/types";

/** Words customers and staff read for each status. API names stay internal. */
export function statusLabel(o: Pick<OrderView, "status" | "fulfillment">): string {
  if (o.status === "started" && o.fulfillment === "partially_started") return "Partly out";
  if (o.status === "started" && o.fulfillment === "partially_stopped") return "Partly back";
  return { new: "New", draft: "Draft", reserved: "Reserved", started: "Out", stopped: "Returned", archived: "Archived", canceled: "Canceled" }[o.status];
}

export function statusTone(o: Pick<OrderView, "status">): "neutral" | "accent" | "success" | "danger" | "warning" {
  return ({ new: "neutral", draft: "neutral", reserved: "accent", started: "warning", stopped: "success", archived: "neutral", canceled: "danger" } as const)[o.status];
}
