"use client";

import { Info } from "lucide-react";
import { cn } from "@/lib/cn";
import { Tooltip } from "./overlay";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={cn("rounded-md border border-line bg-surface", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  actions,
  className,
  as: Heading = "h2",
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  as?: "h2" | "h3";
}) {
  return (
    <header className={cn("flex items-start justify-between gap-4 border-b border-line px-6 py-5", className)}>
      <div className="grid gap-1">
        <Heading className="text-lg text-ink">{title}</Heading>
        {description ? <p className="text-sm text-body">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-end gap-2 border-t border-line px-6 py-4", className)} {...props} />;
}

export function MetricCard({ label, value, info }: { label: string; value: React.ReactNode; info?: string }) {
  return (
    <Card className="px-4 py-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-base text-ink">{label}</p>
        {info ? (
          <Tooltip content={info}>
            <button type="button" aria-label={`About ${label}`} className="text-muted hover:text-ink">
              <Info className="size-4" />
            </button>
          </Tooltip>
        ) : null}
      </div>
      <p className="mt-2 text-display text-ink tabular-nums">{value}</p>
    </Card>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-6 py-10 text-center", className)}>
      {Icon ? <Icon className="mb-1 size-8 text-muted" aria-hidden /> : null}
      <p className="text-base text-ink">{title}</p>
      {children ? <p className="max-w-sm text-sm text-muted">{children}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
