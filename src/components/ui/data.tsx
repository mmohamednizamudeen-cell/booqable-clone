"use client";

import { useState } from "react";
import { Tabs as RTabs, Collapsible } from "radix-ui";
import { ArrowDown, ArrowUp, ChevronsUpDown, ChevronUp, Columns3 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { Checkbox } from "./form";
import { Menu, type MenuItem } from "./overlay";

// ---------------------------------------------------------------- tabs

export function Tabs({
  tabs,
  defaultValue,
  aside,
  children,
}: {
  tabs: { value: string; label: string }[];
  defaultValue?: string;
  aside?: React.ReactNode;
  children?: (value: string) => React.ReactNode;
}) {
  const [value, setValue] = useState(defaultValue ?? tabs[0]!.value);
  return (
    <RTabs.Root value={value} onValueChange={setValue}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 border-b border-line">
        <RTabs.List className="-mb-px flex gap-6 overflow-x-auto">
          {tabs.map((t) => (
            <RTabs.Trigger
              key={t.value}
              value={t.value}
              className="shrink-0 border-b-2 border-transparent pb-2.5 text-sm font-medium text-muted hover:text-ink data-[state=active]:border-accent data-[state=active]:text-ink"
            >
              {t.label}
            </RTabs.Trigger>
          ))}
        </RTabs.List>
        {aside ? <div className="pb-2.5">{aside}</div> : null}
      </div>
      {children
        ? tabs.map((t) => (
            <RTabs.Content key={t.value} value={t.value} className="pt-5 outline-none">
              {children(t.value)}
            </RTabs.Content>
          ))
        : null}
    </RTabs.Root>
  );
}

// ---------------------------------------------------------------- table

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "right";
  className?: string;
};

type Sort = { key: string; dir: "asc" | "desc" } | null;

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  selectable,
  selected,
  onSelectedChange,
  sort,
  onSortChange,
  empty,
  loading,
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (ids: Set<string>) => void;
  sort?: Sort;
  onSortChange?: (sort: Sort) => void;
  empty?: React.ReactNode;
  loading?: boolean;
  caption: string;
}) {
  const sel = selected ?? new Set<string>();
  const all = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const some = rows.some((r) => sel.has(r.id));
  const toggleAll = () => onSelectedChange?.(all ? new Set() : new Set(rows.map((r) => r.id)));
  const toggle = (id: string) => {
    const next = new Set(sel);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange?.(next);
  };

  return (
    <div className="overflow-x-auto rounded-md border border-line bg-surface">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line">
            {selectable ? (
              <th scope="col" className="w-12 px-4 py-3">
                <Checkbox checked={all ? true : some ? "indeterminate" : false} onCheckedChange={toggleAll} aria-label="Select all rows" />
              </th>
            ) : null}
            {columns.map((c) => {
              const active = sort?.key === c.key ? sort.dir : null;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active === "asc" ? "ascending" : active === "desc" ? "descending" : undefined}
                  className={cn("px-4 py-3 font-semibold text-ink", c.align === "right" && "text-right", c.className)}
                >
                  {c.sortable ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-accent"
                      onClick={() => onSortChange?.({ key: c.key, dir: active === "asc" ? "desc" : "asc" })}
                    >
                      {c.header}
                      {active === "asc" ? <ArrowUp className="size-3.5" /> : active === "desc" ? <ArrowDown className="size-3.5" /> : <ChevronsUpDown className="size-3.5 text-muted" />}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 3 }, (_, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  {selectable ? <td className="px-4 py-4" /> : null}
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-4">
                      <span className="block h-3 w-24 animate-pulse rounded-sm bg-neutral-pill" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr key={row.id} className={cn("border-b border-line last:border-0", sel.has(row.id) && "bg-accent-subtle")}>
                  {selectable ? (
                    <td className="px-4 py-3">
                      <Checkbox checked={sel.has(row.id)} onCheckedChange={() => toggle(row.id)} aria-label={`Select row ${row.id}`} />
                    </td>
                  ) : null}
                  {columns.map((c) => (
                    <td key={c.key} className={cn("h-14 px-4 py-2 text-body", c.align === "right" && "text-right tabular-nums", c.className)}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
      {!loading && rows.length === 0 ? empty : null}
    </div>
  );
}

export function ColumnPicker({ columns, visible, onChange }: { columns: { key: string; header: string }[]; visible: Set<string>; onChange: (v: Set<string>) => void }) {
  const items: MenuItem[] = columns.map((c) => ({
    label: `${visible.has(c.key) ? "Hide" : "Show"} ${c.header.toLowerCase()}`,
    onSelect: () => {
      const next = new Set(visible);
      if (next.has(c.key)) next.delete(c.key);
      else next.add(c.key);
      onChange(next);
    },
  }));
  return <Menu items={items} trigger={<Button variant="ghost" size="icon-sm" aria-label="Choose columns"><Columns3 /></Button>} />;
}

// ---------------------------------------------------------------- filters and bulk actions

export function FilterGroup({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <Collapsible.Root defaultOpen={defaultOpen} className="border-b border-line">
      <Collapsible.Trigger className="group flex w-full items-center justify-between px-4 py-3.5 text-sm font-semibold text-ink">
        {title}
        <ChevronUp className="size-4 text-muted transition-transform group-data-[state=closed]:rotate-180" aria-hidden />
      </Collapsible.Trigger>
      <Collapsible.Content className="px-4 pb-4">{children}</Collapsible.Content>
    </Collapsible.Root>
  );
}

export function FilterPanel({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <aside aria-label="Filters" className="hidden w-[var(--layout-filter-panel)] md:flex shrink-0 flex-col border-r border-line bg-bg">
      <div className="flex-1 overflow-y-auto">{children}</div>
      {footer ? <div className="grid gap-2 border-t border-line p-4">{footer}</div> : null}
    </aside>
  );
}

export function BulkBar({ count, total, items, onSelectAll }: { count: number; total: number; items: MenuItem[]; onSelectAll: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Menu
        align="start"
        items={items}
        trigger={
          <Button size="md" disabled={count === 0}>
            Actions
          </Button>
        }
      />
      <span className="text-sm text-body">{count} selected</span>
      {count < total ? (
        <Button variant="link" onClick={onSelectAll}>
          Select all {total}
        </Button>
      ) : null}
    </div>
  );
}
