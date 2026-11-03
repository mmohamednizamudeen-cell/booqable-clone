"use client";

import { createContext, useContext, useState } from "react";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, FileText, Gauge, Globe, Inbox, Package, Settings, Ticket, Users } from "lucide-react";
import { Sidebar, type NavItem } from "@/components/ui/shell";
import { ToastProvider } from "@/components/ui/overlay";

const nav: NavItem[][] = [
  [
    { href: "/dashboard", label: "Today", icon: Gauge },
    { href: "/calendar", label: "Calendar", icon: CalendarDays },
  ],
  [
    { href: "/bookings", label: "Bookings", icon: Inbox },
    { href: "/customers", label: "Customers", icon: Users },
    { href: "/inventory", label: "Inventory", icon: Package },
    { href: "/coupons", label: "Coupons", icon: Ticket },
    { href: "/documents", label: "Documents", icon: FileText },
  ],
  [
    { href: "/settings/online-store", label: "Online store", icon: Globe },
    { href: "/reports", label: "Reports", icon: BarChart3 },
    { href: "/settings", label: "Settings", icon: Settings },
  ],
];

/** The active nav item is the longest href that prefixes the path. */
function currentHref(path: string) {
  const all = nav.flat().map((n) => n.href);
  return all.filter((h) => path === h || path.startsWith(h + "/")).sort((a, b) => b.length - a.length)[0] ?? "";
}

const MenuContext = createContext<() => void>(() => {});
export const useOpenMenu = () => useContext(MenuContext);

export function Frame({ orgName, children }: { orgName: string; children: React.ReactNode }) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <MenuContext.Provider value={() => setMenuOpen(true)}>
    <ToastProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <div className="flex h-dvh">
        <Sidebar
          groups={nav}
          current={currentHref(path)}
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          mobileOpen={menuOpen}
          onMobileOpenChange={setMenuOpen}
          setup={{ done: 2, total: 11, href: "/setup" }}
          primary={{ href: "/bookings/new", label: "New booking" }}
          user={{ name: "Sam Rivera" }}
          logo={<span className="truncate text-base font-semibold text-ink">{orgName}</span>}
        />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </ToastProvider>
    </MenuContext.Provider>
  );
}
