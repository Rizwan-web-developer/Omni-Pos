"use client";

import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { OverlayProvider } from "@/components/providers/OverlayProvider";
import { TenantProvider } from "@/components/providers/TenantProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <TenantProvider>
          <OverlayProvider>
            <AppShell>{children}</AppShell>
          </OverlayProvider>
        </TenantProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
