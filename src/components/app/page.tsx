"use client";

import { PageHeader } from "@/components/ui/shell";
import { useOpenMenu } from "./frame";

/** Page header wired to the mobile menu, plus the scrolling main region. */
export function Page({
  title,
  breadcrumb,
  search,
  actions,
  children,
  flush,
}: {
  title: string;
  breadcrumb?: string[];
  search?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  flush?: boolean;
}) {
  const openMenu = useOpenMenu();
  return (
    <>
      <PageHeader title={title} breadcrumb={breadcrumb} search={search} actions={actions} onOpenMenu={openMenu} />
      <main id="main" className="min-h-0 flex-1 overflow-y-auto">
        {flush ? children : <div className="mx-auto grid max-w-[var(--layout-content-max)] gap-6 p-4 md:p-6">{children}</div>}
      </main>
    </>
  );
}
