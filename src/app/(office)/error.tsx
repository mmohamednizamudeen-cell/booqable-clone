"use client";

import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";

export default function OfficeError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" className="p-6">
      <Card>
        <EmptyState title="Something went wrong on our side" action={<Button variant="primary" onClick={reset}>Try again</Button>}>
          Nothing you entered was lost. If this keeps happening, tell us what you were doing.
        </EmptyState>
      </Card>
    </main>
  );
}
