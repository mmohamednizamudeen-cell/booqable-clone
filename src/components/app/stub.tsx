import { Hammer } from "lucide-react";
import { Card, EmptyState } from "@/components/ui/card";
import { Page } from "./page";

/** Placeholder for screens outside the current milestone. Says so plainly. */
export function Stub({ title, screen, milestone, what, breadcrumb }: { title: string; screen: string; milestone: string; what: string; breadcrumb?: string[] }) {
  return (
    <Page title={title} breadcrumb={breadcrumb}>
      <Card>
        <EmptyState icon={Hammer} title="Not built yet">
          {what} Planned for {milestone} ({screen} in the recon map).
        </EmptyState>
      </Card>
    </Page>
  );
}
