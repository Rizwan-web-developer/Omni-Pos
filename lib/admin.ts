export type AdminRole = "super_admin" | "sub_admin";

export interface AdminProfile {
  id: "super" | "sub";
  role: AdminRole;
  roleLabel: string;
  name: string;
  imageDataUrl?: string;
  active: boolean;
}

export interface AdminSettings {
  platformName: string;
  platformLogoDataUrl?: string;
  admins: [AdminProfile, AdminProfile];
}

const STORAGE_KEY = "omnipos-admin-settings";

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  platformName: "OmniPos Hub",
  platformLogoDataUrl: undefined,
  admins: [
    { id: "super", role: "super_admin", roleLabel: "Super Admin", name: "Rizwan K.", active: true },
    { id: "sub", role: "sub_admin", roleLabel: "Sub Admin", name: "", active: false },
  ],
};

export function loadAdminSettings(): AdminSettings {
  if (typeof window === "undefined") return DEFAULT_ADMIN_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ADMIN_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AdminSettings>;
    if (!parsed || !Array.isArray(parsed.admins)) return DEFAULT_ADMIN_SETTINGS;
    return {
      platformName: typeof parsed.platformName === "string" && parsed.platformName.trim() ? parsed.platformName : DEFAULT_ADMIN_SETTINGS.platformName,
      platformLogoDataUrl: typeof parsed.platformLogoDataUrl === "string" && parsed.platformLogoDataUrl ? parsed.platformLogoDataUrl : undefined,
      admins: [
        { ...DEFAULT_ADMIN_SETTINGS.admins[0], ...(parsed.admins[0] ?? {}), id: "super", role: "super_admin", roleLabel: "Super Admin", active: true },
        { ...DEFAULT_ADMIN_SETTINGS.admins[1], ...(parsed.admins[1] ?? {}), id: "sub", role: "sub_admin", roleLabel: "Sub Admin", active: Boolean(parsed.admins[1]?.active) },
      ],
    };
  } catch {
    return DEFAULT_ADMIN_SETTINGS;
  }
}

export function saveAdminSettings(settings: AdminSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function cachePlatformBranding(branding: { platformName?: string | null; platformLogoDataUrl?: string | null }): void {
  if (typeof window === "undefined") return;
  const current = loadAdminSettings();
  const next: AdminSettings = {
    ...current,
    platformName:
      typeof branding.platformName === "string" && branding.platformName.trim()
        ? branding.platformName.trim()
        : current.platformName,
    platformLogoDataUrl:
      branding.platformLogoDataUrl === null
        ? undefined
        : typeof branding.platformLogoDataUrl === "string" && branding.platformLogoDataUrl
          ? branding.platformLogoDataUrl
          : current.platformLogoDataUrl,
  };
  saveAdminSettings(next);
  window.dispatchEvent(new Event("omnipos-admin-settings"));
}

export async function fetchPlatformBranding(): Promise<{ platformName: string; platformLogoDataUrl: string | null } | null> {
  try {
    const res = await fetch("/api/platform/settings", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as { platformName?: string; platformLogoDataUrl?: string | null };
    const branding = {
      platformName: typeof data.platformName === "string" && data.platformName.trim() ? data.platformName.trim() : "OmniPos Hub",
      platformLogoDataUrl: typeof data.platformLogoDataUrl === "string" && data.platformLogoDataUrl ? data.platformLogoDataUrl : null,
    };
    cachePlatformBranding(branding);
    return branding;
  } catch {
    return null;
  }
}

export function adminInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}
