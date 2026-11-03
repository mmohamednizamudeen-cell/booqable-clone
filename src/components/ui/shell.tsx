"use client";

import { Collapsible, Dialog as RDialog } from "radix-ui";
import { ChevronRight, ChevronUp, ChevronsLeft, ChevronsRight, GripVertical, Menu as MenuIcon, PanelLeft, Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { Avatar } from "./pill";
import { Tooltip } from "./overlay";

// ---------------------------------------------------------------- banner

export function Banner({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div role="region" aria-label="Account notice" className="flex min-h-10 items-center justify-center gap-4 bg-accent px-4 py-1.5 text-sm text-on-accent">
      <p>{children}</p>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------- sidebar

export type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

export function Sidebar({
  groups,
  current,
  collapsed,
  onToggle,
  setup,
  primary,
  user,
  logo,
  mobileOpen = false,
  onMobileOpenChange,
}: {
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  groups: NavItem[][];
  current: string;
  collapsed?: boolean;
  onToggle?: () => void;
  setup?: { done: number; total: number; href: string };
  primary?: { href: string; label: string };
  user: { name: string };
  logo: React.ReactNode;
}) {
  const item = (href: string, label: string, Icon: NavItem["icon"], extra?: string) => {
    const active = href === current;
    const link = (
      <a
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-9 items-center gap-3 rounded-md px-2.5 text-sm text-body hover:bg-surface-muted hover:text-ink",
          active && "bg-accent-subtle font-medium text-accent hover:bg-accent-subtle hover:text-accent",
          collapsed && "justify-center px-0",
          extra,
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className={collapsed ? "sr-only" : undefined}>{label}</span>
      </a>
    );
    return collapsed ? (
      <Tooltip key={href} content={label}>
        {link}
      </Tooltip>
    ) : (
      <div key={href}>{link}</div>
    );
  };

  const header = (closeButton: React.ReactNode) => (
    <div className={cn("flex h-[var(--layout-header)] shrink-0 items-center border-b border-line px-4", collapsed ? "justify-center" : "justify-between")}>
      {collapsed ? null : logo}
      {closeButton}
    </div>
  );

  const body = (
    <>
      {setup ? (
        <a href={setup.href} className={cn("flex items-center gap-3 border-b border-line px-4 py-3 hover:bg-surface-muted", collapsed && "justify-center px-0")}>
          <ProgressRing value={setup.done / setup.total} />
          <span className={collapsed ? "sr-only" : "grid"}>
            <span className="text-sm font-medium text-accent">Finish setting up</span>
            <span className="text-xs text-muted">
              {setup.done} of {setup.total} steps done
            </span>
          </span>
        </a>
      ) : null}
      <div className="flex-1 overflow-y-auto">
        {primary ? <div className="border-b border-line p-2">{item(primary.href, primary.label, Plus, "text-accent font-medium")}</div> : null}
        {groups.map((g, i) => (
          <div key={i} className="grid gap-0.5 border-b border-line p-2 last:border-0">
            {g.map((n) => item(n.href, n.label, n.icon))}
          </div>
        ))}
      </div>
      <div className={cn("flex items-center gap-3 border-t border-line p-3", collapsed && "justify-center")}>
        <Avatar name={user.name} size={24} />
        <span className={collapsed ? "sr-only" : "truncate text-sm text-ink"}>{user.name}</span>
      </div>
    </>
  );

  return (
    <>
      <nav
        aria-label="Main"
        className={cn(
          "hidden h-full shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-[var(--motion-base)] lg:flex",
          collapsed ? "w-[var(--layout-sidebar-collapsed)]" : "w-[var(--layout-sidebar)]",
        )}
      >
        {header(
          <Button variant="ghost" size="icon-sm" onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
          </Button>,
        )}
        {body}
      </nav>
      {/* below lg the same navigation slides in as a drawer */}
      <RDialog.Root open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <RDialog.Portal>
          <RDialog.Overlay className="fixed inset-0 z-40 bg-overlay/40 lg:hidden" />
          <RDialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[min(18rem,85vw)] flex-col bg-surface shadow-modal lg:hidden">
            <RDialog.Title className="sr-only">Main menu</RDialog.Title>
            <RDialog.Description className="sr-only">Go to another part of the back office.</RDialog.Description>
            <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col">
              {header(
                <RDialog.Close asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Close menu">
                    <X />
                  </Button>
                </RDialog.Close>,
              )}
              {body}
            </nav>
          </RDialog.Content>
        </RDialog.Portal>
      </RDialog.Root>
    </>
  );
}

function ProgressRing({ value }: { value: number }) {
  const r = 11;
  const c = 2 * Math.PI * r;
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden className="shrink-0 -rotate-90">
      <circle cx="14" cy="14" r={r} fill="none" stroke="var(--c-border)" strokeWidth="3" />
      <circle cx="14" cy="14" r={r} fill="none" stroke="var(--c-accent)" strokeWidth="3" strokeDasharray={c} strokeDashoffset={c * (1 - value)} strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------- page header

export function PageHeader({
  title,
  breadcrumb,
  search,
  actions,
  onTogglePanel,
  onOpenMenu,
}: {
  onOpenMenu?: () => void;
  title: string;
  breadcrumb?: string[];
  search?: React.ReactNode;
  actions?: React.ReactNode;
  onTogglePanel?: () => void;
}) {
  return (
    <header className="flex h-[var(--layout-header)] shrink-0 items-center gap-3 border-b border-line bg-surface px-4 md:gap-4 md:px-6">
      {onOpenMenu ? (
        <Button size="icon" className="lg:hidden" onClick={onOpenMenu} aria-label="Open menu">
          <MenuIcon />
        </Button>
      ) : null}
      {onTogglePanel ? (
        <Button size="icon" className="hidden md:inline-flex" onClick={onTogglePanel} aria-label="Toggle filters">
          <PanelLeft />
        </Button>
      ) : null}
      <h1 className="flex min-w-0 items-center gap-2 text-xl text-ink md:text-display">
        {breadcrumb?.map((b) => (
          <span key={b} className="hidden items-center gap-2 font-normal text-body md:flex">
            <span className="truncate">{b}</span>
            <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
          </span>
        ))}
        <span className={cn("truncate", breadcrumb?.length && "font-semibold")}>{title}</span>
      </h1>
      <div className="flex flex-1 justify-center">{search ? <div className="hidden w-full max-w-72 md:block">{search}</div> : null}</div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

// ---------------------------------------------------------------- settings section

export function SettingsSection({
  title,
  description,
  learnMore,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  learnMore?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-6 border-b border-line py-8 first:pt-0 last:border-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div className="grid content-start gap-2">
        <h2 className="text-lg text-ink">{title}</h2>
        {description ? <p className="text-sm text-body">{description}</p> : null}
        {learnMore ? (
          <a href={learnMore} className="text-sm text-link underline-offset-4 hover:underline">
            Read the guide
          </a>
        ) : null}
      </div>
      <div className="grid content-start gap-4">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------- link list and aside sections

export function LinkList({ items }: { items: { href: string; label: string; icon?: React.ComponentType<{ className?: string }>; hint?: string }[] }) {
  return (
    <ul className="divide-y divide-line">
      {items.map(({ href, label, icon: Icon, hint }) => (
        <li key={href}>
          <a href={href} className="flex items-center gap-3 px-6 py-3.5 hover:bg-surface-muted">
            {Icon ? <Icon className="size-4 text-body" /> : null}
            <span className="grid flex-1">
              <span className="text-sm font-medium text-ink">{label}</span>
              {hint ? <span className="text-xs text-muted">{hint}</span> : null}
            </span>
            <ChevronRight className="size-4 text-muted" aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  );
}

export function AsideSection({ title, badge, children, defaultOpen = true }: { title: string; badge?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <Collapsible.Root defaultOpen={defaultOpen} className="border-b border-line bg-surface">
      <Collapsible.Trigger className="group flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold text-ink">
        <GripVertical className="size-4 text-muted" aria-hidden />
        <span className="flex-1 text-left">{title}</span>
        {badge}
        <ChevronUp className="size-4 text-muted transition-transform group-data-[state=closed]:rotate-180" aria-hidden />
      </Collapsible.Trigger>
      <Collapsible.Content className="grid gap-2 px-4 pb-4">{children}</Collapsible.Content>
    </Collapsible.Root>
  );
}
