import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const pill = cva("inline-flex items-center gap-1 rounded-pill font-medium whitespace-nowrap", {
  variants: {
    tone: {
      success: "bg-success-pill text-on-pill",
      warning: "bg-warning-pill text-on-pill",
      neutral: "bg-neutral-pill text-on-pill",
      accent: "bg-accent-subtle text-accent",
      danger: "bg-danger-subtle text-danger",
    },
    size: {
      sm: "h-5 px-2 text-xs",
      md: "h-6 px-2.5 text-xs",
    },
  },
  defaultVariants: { tone: "neutral", size: "md" },
});

export function StatusPill({
  tone,
  size,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof pill>) {
  return <span className={cn(pill({ tone, size }), className)} {...props} />;
}

/** Dark corner tag that flags a new feature. */
export function NewMarker({ className, children = "New" }: { className?: string; children?: React.ReactNode }) {
  return (
    <span className={cn("rounded-sm bg-tooltip px-1.5 py-0.5 text-xs text-on-tooltip", className)}>{children}</span>
  );
}

const dotTone = {
  available: "bg-success",
  out: "bg-warning-pill",
  expected: "bg-accent",
  downtime: "bg-neutral-pill ring-1 ring-line-input",
  short: "bg-danger",
} as const;

const dotLabel = {
  available: "Available",
  out: "With a customer",
  expected: "Expected",
  downtime: "In downtime",
  short: "Short",
} as const;

/** Stock state dot. Shows its label next to it unless `labelHidden`, in which case it is read to screen readers only. */
export function StockDot({ state, labelHidden }: { state: keyof typeof dotTone; labelHidden?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-body">
      <span className={cn("size-2.5 rounded-pill", dotTone[state])} aria-hidden />
      <span className={labelHidden ? "sr-only" : undefined}>{dotLabel[state]}</span>
    </span>
  );
}

const hues = ["#5b8db8", "#6aa37a", "#b8875b", "#8a74b8", "#b8607a", "#4f9e9e"];

export function Avatar({ name, size = 32 }: { name: string; size?: 24 | 32 | 40 }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  const hue = hues[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % hues.length];
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-pill font-semibold text-white"
      style={{ width: size, height: size, background: hue, fontSize: size <= 24 ? 10 : 12 }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
