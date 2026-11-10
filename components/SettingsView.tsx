"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { ImagePlus, Save, Shield, UserPlus, X } from "lucide-react";

import { useToast } from "@/components/providers/ToastProvider";
import {
  DEFAULT_ADMIN_SETTINGS,
  adminInitials,
  cachePlatformBranding,
  fetchPlatformBranding,
  loadAdminSettings,
  saveAdminSettings,
  type AdminProfile,
  type AdminSettings,
} from "@/lib/admin";
import { cn } from "@/lib/utils";

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

function Avatar({ profile, size = "md" }: { profile: AdminProfile; size?: "md" | "lg" }) {
  const cls = size === "lg" ? "h-14 w-14 text-sm" : "h-10 w-10 text-xs";
  if (profile.imageDataUrl) {
    return <img src={profile.imageDataUrl} alt="" className={cn(cls, "rounded-full border border-line object-cover")} />;
  }
  return (
    <span className={cn(cls, "flex items-center justify-center rounded-full border border-accent-line bg-accent-soft font-semibold text-accent")}>
      {adminInitials(profile.name || profile.roleLabel)}
    </span>
  );
}

export function SettingsView() {
  const { pushToast } = useToast();
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_ADMIN_SETTINGS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setSettings(loadAdminSettings());
    setMounted(true);
    void (async () => {
      const b = await fetchPlatformBranding();
      if (b) setSettings((prev) => ({ ...prev, platformName: b.platformName, platformLogoDataUrl: b.platformLogoDataUrl ?? undefined }));
    })();
  }, []);

  const savePlatformRemote = async (next: AdminSettings) => {
    try {
      const res = await fetch("/api/platform/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platformName: next.platformName, platformLogoDataUrl: next.platformLogoDataUrl ?? null }),
      });
      if (!res.ok) throw new Error("save failed");
      const data = await res.json().catch(() => ({}));
      cachePlatformBranding({ platformName: data.platformName ?? next.platformName, platformLogoDataUrl: data.platformLogoDataUrl ?? next.platformLogoDataUrl ?? null });
    } catch {
      // keep local cache; remote save best-effort (UI already shows saved locally)
    }
  };

  const persist = (next: AdminSettings, message = "Settings saved") => {
    setSettings(next);
    saveAdminSettings(next);
    window.dispatchEvent(new Event("omnipos-admin-settings"));
    void savePlatformRemote(next);
    pushToast({ title: message, tone: "success" });
  };

  const updateAdmin = (index: 0 | 1, patch: Partial<AdminProfile>) => {
    setSettings((prev) => {
      const admins = [...prev.admins] as AdminSettings["admins"];
      admins[index] = { ...admins[index], ...patch };
      return { ...prev, admins };
    });
  };

  const saveAll = () => persist(settings);

  const onImage = async (index: 0 | 1, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      pushToast({ title: "Please select an image file", tone: "error" });
      return;
    }
    try {
      const dataUrl = await readImage(file);
      const next = {
        ...settings,
        admins: settings.admins.map((a, i) => (i === index ? { ...a, imageDataUrl: dataUrl } : a)) as AdminSettings["admins"],
      };
      persist(next, "Profile image updated");
    } catch {
      pushToast({ title: "Image could not be loaded", tone: "error" });
    }
    e.target.value = "";
  };

  const createSubAdmin = () => {
    if (settings.admins[1].active) return;
    const next: AdminSettings = {
      ...settings,
      admins: [settings.admins[0], { ...settings.admins[1], active: true, name: settings.admins[1].name || "Sub Admin" }],
    };
    persist(next, "Sub Admin created");
  };

  const removeSubAdmin = () => {
    const next: AdminSettings = {
      ...settings,
      admins: [settings.admins[0], { ...settings.admins[1], active: false, name: "", imageDataUrl: undefined }],
    };
    persist(next, "Sub Admin removed");
  };

  if (!mounted) return <div className="h-40 animate-pulse rounded-xl bg-surface-2" />;

  const [superAdmin, subAdmin] = settings.admins;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">Settings</h1>
        <p className="mt-1 text-sm text-muted">Platform and admin profile settings.</p>
      </div>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-base font-semibold text-foreground">Platform</h2>
        <p className="mt-0.5 text-sm text-muted">Platform name and logo appear in the same place across all panels (sidebar). Changes apply everywhere.</p>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="shrink-0">
            <p className="mb-1.5 block text-sm font-medium text-foreground">Logo</p>
            <div className="flex items-center gap-3">
              {settings.platformLogoDataUrl ? (
                <img src={settings.platformLogoDataUrl} alt="" className="h-14 w-14 rounded-lg border border-line bg-surface-2 object-contain" />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-line bg-surface-2 text-xs font-medium text-muted">Logo</span>
              )}
              <div className="flex flex-col gap-2">
                <label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-foreground hover:border-line-strong">
                  <ImagePlus className="h-4 w-4 text-muted" aria-hidden /> Upload logo
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const dataUrl = await readImage(file);
                        persist({ ...settings, platformLogoDataUrl: dataUrl }, "Platform logo updated");
                      } catch {
                        pushToast({ title: "Logo could not be loaded", tone: "error" });
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
                {settings.platformLogoDataUrl ? (
                  <button type="button" onClick={() => persist({ ...settings, platformLogoDataUrl: undefined }, "Platform logo removed")} className="text-left text-xs font-medium text-muted hover:text-foreground">Remove logo</button>
                ) : null}
              </div>
            </div>
          </div>
          <div className="min-w-0 max-w-md flex-1">
            <label htmlFor="platform-name" className="mb-1.5 block text-sm font-medium text-foreground">Platform name</label>
            <input
              id="platform-name"
              value={settings.platformName}
              onChange={(e) => setSettings((p) => ({ ...p, platformName: e.target.value }))}
              className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground"
            />
          </div>
        </div>
        <div className="mt-4">
          <button type="button" onClick={saveAll} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-fg hover:bg-accent-hover">
            <Save className="h-4 w-4" aria-hidden /> Save settings
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Admin profiles</h2>
            <p className="mt-0.5 text-sm text-muted">1 Super Admin and 1 Sub Admin (maximum 2). Change name and profile image.</p>
          </div>
          {!subAdmin.active ? (
            <button type="button" onClick={createSubAdmin} className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-foreground hover:border-line-strong">
              <UserPlus className="h-4 w-4" aria-hidden /> Create Sub Admin
            </button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {/* Super Admin */}
          <div className="rounded-lg border border-line bg-surface-2/40 p-4">
            <div className="flex items-center gap-3">
              <Avatar profile={superAdmin} size="lg" />
              <div>
                <p className="text-sm font-semibold text-foreground">{superAdmin.name || "Super Admin"}</p>
                <p className="flex items-center gap-1 text-xs text-muted"><Shield className="h-3.5 w-3.5 text-accent" aria-hidden /> {superAdmin.roleLabel}</p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="super-name" className="mb-1 block text-xs font-medium text-muted">Name</label>
                <input id="super-name" value={superAdmin.name} onChange={(e) => updateAdmin(0, { name: e.target.value })} className="focus-ring h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-foreground" />
              </div>
              <label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-foreground hover:border-line-strong">
                <ImagePlus className="h-4 w-4 text-muted" aria-hidden /> Change profile image
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => void onImage(0, e)} />
              </label>
            </div>
          </div>

          {/* Sub Admin */}
          <div className={cn("rounded-lg border border-line p-4", subAdmin.active ? "bg-surface-2/40" : "border-dashed bg-surface")}>
            {subAdmin.active ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Avatar profile={subAdmin} size="lg" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{subAdmin.name || "Sub Admin"}</p>
                      <p className="text-xs text-muted">{subAdmin.roleLabel}</p>
                    </div>
                  </div>
                  <button type="button" onClick={removeSubAdmin} className="focus-ring rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-foreground" aria-label="Remove sub admin">
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  <div>
                    <label htmlFor="sub-name" className="mb-1 block text-xs font-medium text-muted">Name</label>
                    <input id="sub-name" value={subAdmin.name} onChange={(e) => updateAdmin(1, { name: e.target.value })} className="focus-ring h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-foreground" />
                  </div>
                  <label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-foreground hover:border-line-strong">
                    <ImagePlus className="h-4 w-4 text-muted" aria-hidden /> Change profile image
                    <input type="file" accept="image/*" className="sr-only" onChange={(e) => void onImage(1, e)} />
                  </label>
                </div>
              </>
            ) : (
              <div className="flex h-full min-h-[140px] flex-col items-center justify-center text-center">
                <p className="text-sm font-medium text-foreground">No Sub Admin</p>
                <p className="mt-1 text-sm text-muted">Super Admin can create 1 Sub Admin.</p>
                <button type="button" onClick={createSubAdmin} className="focus-ring mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-fg hover:bg-accent-hover">
                  <UserPlus className="h-4 w-4" aria-hidden /> Create Sub Admin
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <button type="button" onClick={saveAll} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-fg hover:bg-accent-hover">
            <Save className="h-4 w-4" aria-hidden /> Save profile changes
          </button>
        </div>
      </section>
    </div>
  );
}
