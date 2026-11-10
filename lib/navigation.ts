import {
  Activity,
  Building2,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  Settings2,
  type LucideIcon,
} from "lucide-react";

export type NavSection = "Main";

export interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  section: NavSection;
  disabled?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    shortLabel: "Dashboard",
    description: "Analytics and business overview",
    icon: LayoutDashboard,
    section: "Main",
  },
  {
    href: "/tenants",
    label: "Business",
    shortLabel: "Business",
    description: "Manage businesses and tenants",
    icon: Building2,
    section: "Main",
  },
  {
    href: "/billing",
    label: "Subscriptions & Billing",
    shortLabel: "Billing",
    description: "Plans, subscriptions, invoices and MRR (PKR)",
    icon: CreditCard,
    section: "Main",
  },
  {
    href: "/health",
    label: "Sync & System Health",
    shortLabel: "Health",
    description: "Offline sync status, queues and logs",
    icon: Activity,
    section: "Main",
  },
  {
    href: "/support",
    label: "Support & Tickets",
    shortLabel: "Support",
    description: "Tickets and broadcast announcements",
    icon: LifeBuoy,
    section: "Main",
  },
  {
    href: "/settings",
    label: "Settings",
    shortLabel: "Settings",
    description: "Platform and admin profile settings",
    icon: Settings2,
    section: "Main",
  },
];

export const NAV_SECTIONS: NavSection[] = ["Main"];

export function findNavItem(pathname: string): NavItem {
  return (
    NAV_ITEMS.find(
      (item) =>
        !item.disabled &&
        (pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href))),
    ) ?? NAV_ITEMS[0]
  );
}
