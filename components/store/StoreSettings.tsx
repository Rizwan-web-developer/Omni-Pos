"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ImagePlus, Loader2, Lock, Mail, Save, Store, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Shop = { id: string; uid?: string | null; businessName: string; email?: string | null; phone?: string | null; location?: string | null; logoDataUrl?: string | null };

export function StoreSettings({ businessId }: { businessId: string }) {
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [logo, setLogo] = useState<string | null>(null);

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confPw, setConfPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/profile`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.business) {
        const b = data.business as Shop;
        setShop(b); setName(b.businessName || ""); setPhone(b.phone || ""); setLocation(b.location || ""); setLogo(b.logoDataUrl || null);
      }
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [businessId]);

  const onLogo = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setMsg({ tone: "err", text: "Please select an image file." }); return; }
    if (file.size > 1_800_000) { setMsg({ tone: "err", text: "Image too large (max ~1.5MB). Use a smaller logo." }); return; }
    const reader = new FileReader();
    reader.onload = () => setLogo(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/profile`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessName: name, phone, location, logoDataUrl: logo }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to save");
      setShop((s) => (s ? { ...s, ...data.business } : s));
      window.dispatchEvent(new Event("omnipos-shop-profile"));
      setMsg({ tone: "ok", text: "Shop profile saved." });
    } catch (e) { setMsg({ tone: "err", text: e instanceof Error ? e.message : "Failed to save" }); }
    finally { setSaving(false); }
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPw !== confPw) { setPwMsg({ tone: "err", text: "New password and confirm password do not match." }); return; }
    setPwSaving(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/change-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to change password");
      setCurPw(""); setNewPw(""); setConfPw("");
      setPwMsg({ tone: "ok", text: "Password updated successfully." });
    } catch (e) { setPwMsg({ tone: "err", text: e instanceof Error ? e.message : "Failed to change password" }); }
    finally { setPwSaving(false); }
  };

  if (loading) return <div className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading settings…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted">Manage your shop profile and password. Email cannot be changed.</p>
      </div>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><Store className="h-4 w-4 text-accent" /> Shop profile</h2>
        <form onSubmit={saveProfile} className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full">
              {logo ? <img src={logo} alt="" className="h-16 w-16 rounded-full object-cover" /> : <span className="text-lg font-semibold text-accent">{(name || "S").slice(0, 2).toUpperCase()}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm font-medium text-foreground hover:border-line-strong">
                <ImagePlus className="h-4 w-4" /> Attach logo
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => onLogo(e.target.files?.[0] || null)} />
              </label>
              {logo ? <button type="button" onClick={() => setLogo(null)} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-foreground"><Trash2 className="h-4 w-4" /> Remove</button> : null}
              <span className="text-xs text-muted">Fits in circle, transparent supported.</span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm"><span className="mb-1 block font-medium text-foreground">Shop / outlet name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground" />
            </label>
            <label className="text-sm"><span className="mb-1 flex items-center gap-1 font-medium text-foreground"><Mail className="h-3.5 w-3.5" /> Email (cannot change)</span>
              <input value={shop?.email || ""} readOnly disabled className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-muted" />
            </label>
            <label className="text-sm"><span className="mb-1 block font-medium text-foreground">Phone</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground" />
            </label>
            <label className="text-sm"><span className="mb-1 block font-medium text-foreground">Location</span>
              <input value={location} onChange={(e) => setLocation(e.target.value)} className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground" />
            </label>
          </div>

          {msg ? <div className={cn("rounded-lg border px-3 py-2 text-sm", msg.tone === "ok" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300")}>{msg.text}</div> : null}
          <button type="submit" disabled={saving} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save profile
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><Lock className="h-4 w-4 text-accent" /> Change password</h2>
        <p className="mt-0.5 text-sm text-muted">Email cannot be changed. Use this to update your login password.</p>
        <form onSubmit={changePassword} className="mt-4 grid max-w-xl gap-4 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2"><span className="mb-1 block font-medium text-foreground">Current password</span>
            <input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} required autoComplete="current-password" className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground" />
          </label>
          <label className="text-sm"><span className="mb-1 block font-medium text-foreground">New password</span>
            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={8} autoComplete="new-password" className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground" />
          </label>
          <label className="text-sm"><span className="mb-1 block font-medium text-foreground">Confirm new password</span>
            <input type="password" value={confPw} onChange={(e) => setConfPw(e.target.value)} required minLength={8} autoComplete="new-password" className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground" />
          </label>
          {pwMsg ? <div className={cn("rounded-lg border px-3 py-2 text-sm sm:col-span-2", pwMsg.tone === "ok" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300")}>{pwMsg.text}</div> : null}
          <div className="sm:col-span-2">
            <button type="submit" disabled={pwSaving} className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-4 py-2 text-sm font-semibold text-foreground hover:border-line-strong disabled:opacity-60">
              {pwSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Update password
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
