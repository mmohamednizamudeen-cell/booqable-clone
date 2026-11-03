"use client";

import { forwardRef, useId } from "react";
import { Checkbox as RCheckbox, Switch as RSwitch, RadioGroup as RRadio } from "radix-ui";
import { Check, ChevronDown, Minus, Search } from "lucide-react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-md border border-line-input bg-surface px-3 text-sm text-ink placeholder:text-muted transition-colors hover:border-ink disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted read-only:bg-surface-muted aria-invalid:border-danger";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { dense?: boolean }>(
  function Input({ className, dense, ...props }, ref) {
    return <input ref={ref} className={cn(control, dense ? "h-8" : "h-10", className)} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(control, "min-h-24 py-2", className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <span className="relative block">
        <select ref={ref} className={cn(control, "h-10 appearance-none pr-9", className)} {...props}>
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
      </span>
    );
  },
);

export function SearchInput({ label = "Search", className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <span className={cn("relative block", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input type="search" aria-label={label} className={cn(control, "h-10 pl-9")} {...props} />
    </span>
  );
}

/** Amount in minor units (cents) shown in major units. */
export function MoneyInput({
  currency = "USD",
  valueCents,
  onValueCents,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  currency?: string;
  valueCents: number;
  onValueCents?: (cents: number) => void;
}) {
  return (
    <span className="relative block">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs font-medium text-muted">{currency}</span>
      <input
        inputMode="decimal"
        className={cn(control, "h-10 pl-12 text-right tabular-nums")}
        defaultValue={(valueCents / 100).toFixed(2)}
        onBlur={(e) => {
          const n = Math.round(parseFloat(e.target.value.replace(",", ".")) * 100);
          const cents = Number.isFinite(n) ? n : 0;
          e.target.value = (cents / 100).toFixed(2);
          onValueCents?.(cents);
        }}
        {...props}
      />
    </span>
  );
}

/** Label + control + hint or error. Wires ids and aria for the child control. */
export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const noteId = hint || error ? `${id}-note` : undefined;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children({ id, "aria-describedby": noteId, "aria-invalid": error ? true : undefined })}
      {error ? (
        <p id={noteId} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={noteId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Checkbox({ className, ...props }: React.ComponentProps<typeof RCheckbox.Root>) {
  return (
    <RCheckbox.Root
      className={cn(
        "flex size-4.5 shrink-0 items-center justify-center rounded-sm border border-line-input bg-surface text-on-accent data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <RCheckbox.Indicator>
        {props.checked === "indeterminate" ? <Minus className="size-3.5" strokeWidth={3} /> : <Check className="size-3.5" strokeWidth={3} />}
      </RCheckbox.Indicator>
    </RCheckbox.Root>
  );
}

export function Switch({ className, ...props }: React.ComponentProps<typeof RSwitch.Root>) {
  return (
    <RSwitch.Root
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 items-center rounded-pill border border-line-input bg-neutral-pill transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <RSwitch.Thumb className="block size-4.5 translate-x-0.5 rounded-pill bg-surface shadow-sm transition-transform data-[state=checked]:translate-x-[1.125rem]" />
    </RSwitch.Root>
  );
}

export function RadioGroup({
  options,
  ...props
}: React.ComponentProps<typeof RRadio.Root> & { options: { value: string; label: React.ReactNode; hint?: React.ReactNode }[] }) {
  return (
    <RRadio.Root className="grid gap-3" {...props}>
      {options.map((o) => (
        <label key={o.value} className="flex cursor-pointer items-start gap-3">
          <RRadio.Item
            value={o.value}
            className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-pill border border-line-input bg-surface data-[state=checked]:border-accent"
          >
            <RRadio.Indicator className="size-2.5 rounded-pill bg-accent" />
          </RRadio.Item>
          <span className="grid gap-0.5">
            <span className="text-sm text-ink">{o.label}</span>
            {o.hint ? <span className="text-xs text-muted">{o.hint}</span> : null}
          </span>
        </label>
      ))}
    </RRadio.Root>
  );
}

/** Checkbox row with a label and an optional count, for filter panels. */
export function CheckboxRow({ label, count, ...props }: React.ComponentProps<typeof RCheckbox.Root> & { label: string; count?: number }) {
  const id = useId();
  return (
    <div className="flex items-center gap-2.5 py-1">
      <Checkbox id={id} {...props} />
      <label htmlFor={id} className="flex-1 cursor-pointer text-sm text-ink">
        {label}
      </label>
      {count !== undefined ? <span className="text-xs text-muted tabular-nums">({count})</span> : null}
    </div>
  );
}
