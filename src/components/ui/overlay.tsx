"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Dialog as RDialog, Popover as RPopover, DropdownMenu as RMenu, Tooltip as RTooltip } from "radix-ui";
import { CheckCircle2, ChevronDown, X, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, type ButtonProps } from "./button";

const panel = "rounded-md border border-line bg-surface text-sm text-body shadow-pop";

// ---------------------------------------------------------------- dialog

const dialogWidth = { sm: "max-w-[420px]", md: "max-w-[560px]", lg: "max-w-[720px]" };

export function Dialog({
  trigger,
  title,
  description,
  children,
  footer,
  size = "md",
  open,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: keyof typeof dialogWidth;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <RDialog.Trigger asChild>{trigger}</RDialog.Trigger> : null}
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-40 bg-overlay/40" />
        <RDialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 grid max-h-[90vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 grid-rows-[auto_1fr_auto] rounded-lg bg-surface shadow-modal",
            dialogWidth[size],
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
            <div className="grid gap-1">
              <RDialog.Title className="text-lg text-ink">{title}</RDialog.Title>
              {description ? (
                <RDialog.Description className="text-sm text-body">{description}</RDialog.Description>
              ) : (
                <RDialog.Description className="sr-only">{title}</RDialog.Description>
              )}
            </div>
            <RDialog.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close">
                <X />
              </Button>
            </RDialog.Close>
          </div>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
          {footer ? <div className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</div> : null}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

export const DialogClose = RDialog.Close;

// ---------------------------------------------------------------- popover

export function Popover({
  trigger,
  children,
  align = "start",
  className,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
}) {
  return (
    <RPopover.Root>
      <RPopover.Trigger asChild>{trigger}</RPopover.Trigger>
      <RPopover.Portal>
        <RPopover.Content align={align} sideOffset={6} className={cn(panel, "z-50 w-80 p-4", className)}>
          {children}
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  );
}

// ---------------------------------------------------------------- menu

export type MenuItem = { label: string; onSelect?: () => void; danger?: boolean; disabled?: boolean } | "separator";

export function Menu({ trigger, items, align = "end" }: { trigger: React.ReactNode; items: MenuItem[]; align?: "start" | "end" }) {
  return (
    <RMenu.Root>
      <RMenu.Trigger asChild>{trigger}</RMenu.Trigger>
      <RMenu.Portal>
        <RMenu.Content align={align} sideOffset={6} className={cn(panel, "z-50 min-w-44 p-1")}>
          {items.map((item, i) =>
            item === "separator" ? (
              <RMenu.Separator key={i} className="my-1 h-px bg-line" />
            ) : (
              <RMenu.Item
                key={item.label}
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={cn(
                  "flex h-9 cursor-pointer items-center rounded-sm px-3 outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent-subtle",
                  item.danger ? "text-danger" : "text-ink",
                )}
              >
                {item.label}
              </RMenu.Item>
            ),
          )}
        </RMenu.Content>
      </RMenu.Portal>
    </RMenu.Root>
  );
}

export function SplitButton({
  children,
  items,
  menuLabel,
  ...props
}: ButtonProps & { items: MenuItem[]; menuLabel: string }) {
  return (
    <div className="inline-flex">
      <Button variant="primary" className="rounded-r-none" {...props}>
        {children}
      </Button>
      <Menu
        items={items}
        trigger={
          <Button variant="primary" size="icon" aria-label={menuLabel} className="rounded-l-none border-l border-on-accent/30">
            <ChevronDown />
          </Button>
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------- tooltip

export function Tooltip({ content, children }: { content: React.ReactNode; children: React.ReactNode }) {
  return (
    <RTooltip.Provider delayDuration={300}>
      <RTooltip.Root>
        <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
        <RTooltip.Portal>
          <RTooltip.Content sideOffset={6} className="z-50 max-w-64 rounded-sm bg-tooltip px-2 py-1 text-xs text-on-tooltip">
            {content}
          </RTooltip.Content>
        </RTooltip.Portal>
      </RTooltip.Root>
    </RTooltip.Provider>
  );
}

// ---------------------------------------------------------------- toast

type Toast = { id: number; tone: "success" | "error"; message: string };
const ToastContext = createContext<(tone: Toast["tone"], message: string) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (tone: Toast["tone"], message: string) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, tone, message }]);
      if (tone === "success") setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 grid w-80 gap-2">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={cn(panel, "pointer-events-auto flex items-start gap-3 p-3")}>
            {t.tone === "success" ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            ) : (
              <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
            )}
            <p className="flex-1 text-ink">{t.message}</p>
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="text-muted hover:text-ink">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
