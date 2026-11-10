"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { CommandPalette } from "@/components/CommandPalette";
import { TenantDrawer } from "@/components/TenantDrawer";
import { TenantOnboardingModal } from "@/components/TenantOnboardingModal";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { cn } from "@/lib/utils";

/**
 * Application chrome.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = pathname === "/login" || pathname === "/signup";
  const isStoreRoute = pathname?.startsWith("/store");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);

  // Move focus to the new screen after client-side navigation.
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    setMobileNavOpen(false);
    const id = window.requestAnimationFrame(() => {
      mainRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(id);
  }, [pathname]);

  if (isAuthRoute) {
    return <div className="min-h-dvh bg-background">{children}</div>;
  }

  // Store panel: separate window/page (no Super Admin sidebar chrome)
  if (isStoreRoute) {
    return (
      <div className="min-h-dvh bg-background">
        <main id="main-content" tabIndex={-1} className="min-h-dvh focus:outline-none">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="flex min-h-dvh">
        <Sidebar
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        />

        <div className={cn("flex min-w-0 flex-1 flex-col", sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-[272px]")}>
          <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />

          <main
            ref={mainRef}
            id="main-content"
            tabIndex={-1}
            className="mx-auto w-full max-w-[1600px] flex-1 px-4 pb-10 pt-8 focus:outline-none sm:px-6 lg:px-8"
          >
            {children}
          </main>
        </div>
      </div>

      <CommandPalette />
      <TenantOnboardingModal />
      <TenantDrawer />
    </div>
  );
}
