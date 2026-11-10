"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { AccountType, IndustryKey, PlanKey, Tenant, TenantDraft, TenantStatus } from "@/lib/types";

interface TenantContextValue {
  tenants: Tenant[];
  loading: boolean;
  refresh: () => Promise<void>;
  addTenant: (draft: TenantDraft) => Tenant; // local optimistic (legacy)
  insertTenant: (tenant: Tenant) => void;
  updateTenant: (id: string, patch: Partial<Tenant>) => void;
  setTenantStatus: (id: string, status: TenantStatus) => void;
  deleteTenant: (id: string) => void;
}

const TenantContext = createContext<TenantContextValue | null>(null);

const STATUS: Record<string, TenantStatus> = { ACTIVE: "active", TRIAL: "trial", DEACTIVE: "deactive" };
const INDUSTRY: Record<string, IndustryKey> = {
  MOBILE_ACCESSORIES: "mobile", PHARMACY: "pharmacy", GROCERY: "grocery", ELECTRONICS: "electronics",
  HARDWARE_SHOP: "hardware-shop", PAINT_SHOP: "paint-shop", COSMETICS_SHOP: "cosmetics-shop",
};
const PLAN: Record<string, PlanKey> = { STARTER: "starter", PRO: "pro", ENTERPRISE: "enterprise" };
const ACCT: Record<string, AccountType> = { REAL: "real", DEMO: "demo" };

function fmtDate(v?: string | Date | null): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

export function mapBusinessToTenant(b: any): Tenant {
  return {
    id: String(b.id),
    uid: b.uid || "",
    name: b.businessName || b.name || "",
    slug: b.slug || "",
    industry: INDUSTRY[String(b.industryType)] || "electronics",
    plan: PLAN[String(b.subscriptionTier)] || "starter",
    accountType: ACCT[String(b.accountType)] || "real",
    trialEndsAt: b.trialEndsAt ?? null,
    status: STATUS[String(b.status)] || "active",
    mrr: typeof b.mrr === "object" && b.mrr?.toNumber ? b.mrr.toNumber() : Number(b.mrr || 0),
    terminals: Number(b.terminals || 0),
    staff: Number(b.staff || 0),
    owner: b.ownerName || b.businessName || "",
    email: b.email || "",
    phone: b.phone || "",
    location: b.location || "",
    createdAt: fmtDate(b.createdAt),
    lastSync: "—",
    sync: "synced",
    latencyMs: 0,
    uptime: 0,
    mrrDelta: 0,
  };
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/businesses", { cache: "no-store" });
      if (!res.ok) return; // e.g. unauth
      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data?.businesses) ? data.businesses : [];
      setTenants(list.map(mapBusinessToTenant));
    } catch {
      /* keep current state */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // Local optimistic add (legacy) — real creates should be followed by refresh()/insertTenant of DB record
  const addTenant = useCallback((draft: TenantDraft): Tenant => {
    const now = new Date();
    const plan = (draft.plan ?? "starter") as Tenant["plan"];
    const slug = (draft.slug || draft.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "business";
    const tenant: Tenant = {
      id: `local-${now.getTime()}`, uid: "", name: draft.name.trim(), slug, industry: draft.industry, plan,
      status: draft.accountType === "demo" ? "trial" : "active", accountType: draft.accountType, mrr: 0,
      terminals: 0, staff: 1, owner: (draft.owner || draft.name).trim(), email: draft.email.trim(), phone: draft.phone.trim(),
      location: draft.location.trim(), createdAt: fmtDate(now), lastSync: "just now", sync: "synced", latencyMs: 0, uptime: 0, mrrDelta: 0,
    };
    setTenants((current) => [tenant, ...current]);
    return tenant;
  }, []);

  const insertTenant = useCallback((tenant: Tenant) => {
    setTenants((current) => [tenant, ...current.filter((t) => t.id !== tenant.id && (tenant.uid ? t.uid !== tenant.uid : true))]);
  }, []);

  const updateTenant = useCallback((id: string, patch: Partial<Tenant>) => {
    setTenants((current) => current.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const setTenantStatus = useCallback((id: string, status: TenantStatus) => {
    setTenants((current) => current.map((t) => (t.id === id ? { ...t, status } : t)));
  }, []);

  const deleteTenant = useCallback((id: string) => {
    setTenants((current) => current.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(
    () => ({ tenants, loading, refresh, addTenant, insertTenant, updateTenant, setTenantStatus, deleteTenant }),
    [tenants, loading, refresh, addTenant, insertTenant, updateTenant, setTenantStatus, deleteTenant],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenants(): TenantContextValue {
  const context = useContext(TenantContext);
  if (!context) throw new Error("useTenants must be used inside <TenantProvider>");
  return context;
}
