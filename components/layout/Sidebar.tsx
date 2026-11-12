"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, PanelLeftClose, PanelLeftOpen, ShieldCheck, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useToast } from "@/components/providers/ToastProvider";
import { useBodyScrollLock, useFocusTrap } from "@/hooks/useFocusTrap";
import { DEFAULT_ADMIN_SETTINGS, adminInitials, fetchPlatformBranding, loadAdminSettings, type AdminSettings } from "@/lib/admin";
import { NAV_ITEMS, NAV_SECTIONS } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
}

function SidebarContent({
  onNavigate,
  collapsed,
  onToggleCollapse,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  const isCollapsed = Boolean(collapsed && !onNavigate); // collapse applies to desktop rail
  const [admin, setAdmin] = useState<AdminSettings>(DEFAULT_ADMIN_SETTINGS);
  const [supportOpen, setSupportOpen] = useState(0);
  const supportBaselineRef = useRef<number | null>(null);
  const { pushToast } = useToast();

  useEffect(() => {
    const sync = () => setAdmin(loadAdminSettings());
    sync();
    window.addEventListener("omnipos-admin-settings", sync);
    window.addEventListener("storage", sync);
    void (async () => {
      const b = await fetchPlatformBranding();
      if (b) setAdmin((prev) => ({ ...prev, platformName: b.platformName, platformLogoDataUrl: b.platformLogoDataUrl ?? undefined }));
    })();
    return () => {
      window.removeEventListener("omnipos-admin-settings", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const pollSupport = useCallback(async () => {
    try {
      const res = await fetch("/api/support/tickets?summary=1", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json().catch(() => ({}))) as { openCount?: number };
      const count = typeof data.openCount === "number" ? data.openCount : 0;
      if (supportBaselineRef.current === null) {
        supportBaselineRef.current = count;
      } else if (count > supportBaselineRef.current) {
        const delta = count - supportBaselineRef.current;
        pushToast({
          tone: "warning",
          title: delta === 1 ? "1 new support query" : `${delta} new support queries`,
          description: "A shop sent a support message. Open Support & Tickets to view.",
        });
        supportBaselineRef.current = count;
      } else {
        supportBaselineRef.current = count;
      }
      setSupportOpen(count);
    } catch {
      /* ignore polling errors */
    }
  }, [pushToast]);

  useEffect(() => {
    void pollSupport();
    const id = window.setInterval(pollSupport, 30000);
    const onFocus = () => void pollSupport();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [pollSupport]);

  const superAdmin = admin.admins[0];
  const profileName = superAdmin.name?.trim() || "Rizwan K.";
  const platformName = admin.platformName?.trim() || "Omni Pos";
  const platformMark = platformName.slice(0, 2).toUpperCase();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("border-b border-line", isCollapsed ? "px-2 py-3" : "px-4 py-4")}>
        <div className={cn("flex items-center", isCollapsed ? "justify-center" : "justify-between gap-2")}>
          {!isCollapsed ? (
            <div className="flex min-w-0 items-center gap-2.5">
              {admin.platformLogoDataUrl ? (
                <img src={admin.platformLogoDataUrl} alt="" className="h-12 w-12 shrink-0 object-contain" />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center text-accent" aria-hidden>
                  <ShieldCheck className="h-6 w-6" />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-tight text-foreground">{platformName}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-muted">
                  <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden />
                  Admin
                </p>
              </div>
            </div>
          ) : (
            admin.platformLogoDataUrl ? (
              <img src={admin.platformLogoDataUrl} alt={platformName} className="h-12 w-12 object-contain" title={platformName} />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center text-accent" title={platformName}>
                <ShieldCheck className="h-6 w-6" aria-hidden />
              </span>
            )
          )}
          {onToggleCollapse ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="focus-ring hidden rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-foreground lg:inline-flex"
              aria-label={isCollapsed ? "Open sidebar" : "Close sidebar"}
              title={isCollapsed ? "Open sidebar" : "Close sidebar"}
            >
              {isCollapsed ? <PanelLeftOpen className="h-4 w-4" aria-hidden /> : <PanelLeftClose className="h-4 w-4" aria-hidden />}
            </button>
          ) : null}
        </div>
      </div>

      <nav aria-label="Primary navigation" className={cn("min-h-0 flex-1 overflow-y-auto py-4", isCollapsed ? "px-2" : "px-3")}>
        {NAV_SECTIONS.map((section) => {
          const items = NAV_ITEMS.filter((item) => item.section === section);
          if (items.length === 0) return null;
          return (
            <div key={section} className="mb-4 last:mb-0">
              {!isCollapsed ? (
                <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted">{section}</p>
              ) : null}
              <ul className="space-y-1">
                {items.map((item) => {
                  const itemActive = !item.disabled && isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      {item.disabled ? (
                        <span className={cn("flex cursor-not-allowed items-center gap-3 rounded-lg text-sm text-muted", isCollapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5")} aria-disabled="true" title={item.label}>
                          <Icon className="h-4 w-4 shrink-0" aria-hidden />
                          {!isCollapsed ? <span className="flex-1 truncate">{item.label}</span> : null}
                        </span>
                      ) : (
                        <Link
                          href={item.href}
                          onClick={onNavigate}
                          aria-current={itemActive ? "page" : undefined}
                          title={item.href === "/support" && supportOpen > 0 ? `${item.label} (${supportOpen} open)` : item.label}
                          className={cn(
                            "focus-ring group relative flex items-center gap-3 rounded-lg border text-sm transition-colors",
                            isCollapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
                            itemActive
                              ? "border-accent-line bg-accent-soft font-medium text-foreground"
                              : "border-transparent text-muted hover:border-line hover:bg-surface-2 hover:text-foreground",
                          )}
                        >
                          <span className="relative shrink-0">
                            <Icon className={cn("h-4 w-4", itemActive ? "text-accent" : "text-muted group-hover:text-foreground")} aria-hidden />
                            {isCollapsed && item.href === "/support" && supportOpen > 0 ? (
                              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-accent-fg">
                                {supportOpen > 9 ? "9+" : supportOpen}
                              </span>
                            ) : null}
                          </span>
                          {!isCollapsed ? <span className="min-w-0 flex-1 truncate">{item.label}</span> : null}
                          {!isCollapsed && item.href === "/support" && supportOpen > 0 ? (
                            <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold leading-none text-accent-fg">
                              {supportOpen > 99 ? "99+" : supportOpen}
                            </span>
                          ) : null}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className={cn("border-t border-line", isCollapsed ? "p-2" : "p-3")}>
        <div className={cn("rounded-lg border border-line bg-surface-2/60", isCollapsed ? "p-2" : "p-3")}>
          <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-3")}>
            {superAdmin.imageDataUrl ? (
              <img src={superAdmin.imageDataUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center text-xs font-semibold text-accent">
                {adminInitials(profileName)}
              </span>
            )}
            {!isCollapsed ? (
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-sm font-semibold text-foreground">{profileName}</span>
                <span className="block text-xs text-muted">Super Admin</span>
              </span>
            ) : null}
          </div>
          {!isCollapsed ? (
            <button
              type="button"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
                window.location.href = "/login";
              }}
              className="focus-ring mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-muted hover:border-line-strong hover:text-foreground"
            >
              Log out
            </button>
          ) : (
            <button
              type="button"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
                window.location.href = "/login";
              }}
              className="focus-ring mt-2 flex w-full items-center justify-center rounded-md p-1.5 text-muted hover:bg-surface hover:text-foreground"
              title="Log out"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ mobileOpen, onMobileClose, collapsed, onToggleCollapse }: SidebarProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useBodyScrollLock(mobileOpen);
  useFocusTrap(panelRef, mobileOpen);

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-line bg-surface transition-[width] duration-200 lg:block",
          collapsed ? "w-[72px]" : "w-[272px]",
        )}
      >
        <SidebarContent collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <div className="absolute inset-0 bg-overlay/65 backdrop-blur-sm animate-fade-in" onMouseDown={onMobileClose} aria-hidden />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                onMobileClose();
              }
            }}
            className="relative z-10 h-full w-[288px] max-w-[86vw] border-r border-line bg-surface shadow-panel outline-none animate-slide-in-left"
          >
            <button
              type="button"
              onClick={onMobileClose}
              className="focus-ring absolute right-3 top-4 z-20 rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              aria-label="Close navigation menu"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
            <SidebarContent onNavigate={onMobileClose} />
          </div>
        </div>
      ) : null}
    </>
  );
}
