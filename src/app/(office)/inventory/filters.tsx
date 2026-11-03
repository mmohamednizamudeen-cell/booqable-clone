"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { SearchInput, CheckboxRow } from "@/components/ui/form";
import { FilterGroup, FilterPanel } from "@/components/ui/data";

/** Search box that updates ?q= as you type (debounced by the transition). */
export function ListSearch({ placeholder, defaultValue, className }: { placeholder: string; defaultValue?: string; className?: string }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [, start] = useTransition();
  return (
    <SearchInput
      className={className}
      placeholder={placeholder}
      defaultValue={defaultValue}
      onChange={(e) => {
        const next = new URLSearchParams(params);
        if (e.target.value) next.set("q", e.target.value);
        else next.delete("q");
        start(() => router.replace(`${path}?${next}`));
      }}
    />
  );
}

const labels: Record<string, string> = { rental: "Rental", service: "Service", sales_item: "For sale" };

export function TypeFilter({ current, counts }: { current?: string; counts: Record<string, number> }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const set = (type?: string) => {
    const next = new URLSearchParams(params);
    if (type) next.set("type", type);
    else next.delete("type");
    router.replace(`${path}?${next}`);
  };
  return (
    <FilterPanel>
      <FilterGroup title="Product type">
        {Object.entries(labels).map(([value, label]) => (
          <CheckboxRow key={value} label={label} count={counts[value] ?? 0} checked={current === value} onCheckedChange={(c) => set(c ? value : undefined)} />
        ))}
      </FilterGroup>
    </FilterPanel>
  );
}
