"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { Tenant } from "@/lib/types";

interface OnboardingState {
  open: boolean;
  tenant: Tenant | null;
}

interface OverlayContextValue {
  paletteOpen: boolean;
  onboarding: OnboardingState;
  drawerTenantId: string | null;
  anyOverlayOpen: boolean;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  openOnboarding: (tenant?: Tenant | null) => void;
  closeOnboarding: () => void;
  openTenant: (id: string) => void;
  closeTenant: () => void;
  closeAll: () => void;
}

const OverlayContext = createContext<OverlayContextValue | null>(null);

/**
 * Overlays are mutually exclusive by design: opening one closes the others.
 */
export function OverlayProvider({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [onboarding, setOnboarding] = useState<OnboardingState>({
    open: false,
    tenant: null,
  });
  const [drawerTenantId, setDrawerTenantId] = useState<string | null>(null);

  const closeAll = useCallback(() => {
    setPaletteOpen(false);
    setOnboarding({ open: false, tenant: null });
    setDrawerTenantId(null);
  }, []);

  const openPalette = useCallback(() => {
    setOnboarding({ open: false, tenant: null });
    setDrawerTenantId(null);
    setPaletteOpen(true);
  }, []);

  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const togglePalette = useCallback(() => {
    setPaletteOpen((open) => {
      if (!open) {
        setOnboarding({ open: false, tenant: null });
        setDrawerTenantId(null);
      }
      return !open;
    });
  }, []);

  const openOnboarding = useCallback((tenant: Tenant | null = null) => {
    setPaletteOpen(false);
    setDrawerTenantId(null);
    setOnboarding({ open: true, tenant });
  }, []);

  const closeOnboarding = useCallback(
    () => setOnboarding({ open: false, tenant: null }),
    [],
  );

  const openTenant = useCallback((id: string) => {
    setPaletteOpen(false);
    setOnboarding({ open: false, tenant: null });
    setDrawerTenantId(id);
  }, []);

  const closeTenant = useCallback(() => setDrawerTenantId(null), []);

  const anyOverlayOpen =
    paletteOpen || onboarding.open || drawerTenantId !== null;

  const value = useMemo<OverlayContextValue>(
    () => ({
      paletteOpen,
      onboarding,
      drawerTenantId,
      anyOverlayOpen,
      openPalette,
      closePalette,
      togglePalette,
      openOnboarding,
      closeOnboarding,
      openTenant,
      closeTenant,
      closeAll,
    }),
    [
      paletteOpen,
      onboarding,
      drawerTenantId,
      anyOverlayOpen,
      openPalette,
      closePalette,
      togglePalette,
      openOnboarding,
      closeOnboarding,
      openTenant,
      closeTenant,
      closeAll,
    ],
  );

  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>;
}

export function useOverlays(): OverlayContextValue {
  const context = useContext(OverlayContext);
  if (!context) throw new Error("useOverlays must be used inside <OverlayProvider>");
  return context;
}
