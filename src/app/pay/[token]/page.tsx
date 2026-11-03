import { Card, EmptyState } from "@/components/ui/card";

export default function PayPage() {
  return (
    <main id="main" className="mx-auto grid min-h-dvh max-w-lg place-content-center p-4">
      <Card>
        <EmptyState title="Payment links are not live yet">Online payment arrives with the Stripe connection in M2 (S34).</EmptyState>
      </Card>
    </main>
  );
}
