"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ImagePlus, Loader2, Lock, Mail, Save, Store, Trash2, UserPlus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Shop = { id: string; uid?: string | null; businessName: string; email?: string | null; phone?: string | null; location?: string | null; logoDataUrl?: string | null };
type StaffMember = { id: string; name: string; email: string; role: string; isActive: boolean; lastLoginAt?: string | null };

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

  // MULTI_USER: staff accounts
  const [featureKeys, setFeatureKeys] = useState<string[]>([]);
  const [role, setRole] = useState("");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffMsg, setStaffMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [staffBusy, setStaffBusy] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffRole, setStaffRole] = useState("CASHIER");
  const [staffDel, setStaffDel] = useState<StaffMember | null>(null);

  const multiUserEnabled = featureKeys.includes("MULTI_USER");
  const canManageStaff = role === "OWNER" || role === "SUPER_ADMIN" || role === "SUB_ADMIN";

  const loadStaff = async () => {
    setStaffLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/staff`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setStaff(Array.isArray(data.staff) ? data.staff : []);
    } finally {
      setStaffLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const [fRes, pRes] = await Promise.all([
          fetch(`/api/businesses/${businessId}/features`, { cache: "no-store" }),
          fetch(`/api/businesses/${businessId}/profile`, { cache: "no-store" }),
        ]);
        const fData = await fRes.json().catch(() => ({}));
        const pData = await pRes.json().catch(() => ({}));
        if (fRes.ok && Array.isArray(fData.features)) setFeatureKeys(fData.features.map((k: unknown) => String(k)));
        if (pRes.ok && pData.role) setRole(String(pData.role));
      } catch { /* ignore */ }
    })();
  }, [businessId]);

  useEffect(() => {
    if (multiUserEnabled && canManageStaff) void loadStaff();
  }, [multiUserEnabled, canManageStaff]);

  const addStaff = async (e: FormEvent) => {
    e.preventDefault();
    setStaffMsg(null);
    setStaffBusy(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: staffName, email: staffEmail, password: staffPassword, role: staffRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to add staff.");
      setStaff((cur) => [...cur, data.staff as StaffMember]);
      setStaffName(""); setStaffEmail(""); setStaffPassword(""); setStaffRole("CASHIER");
      setStaffMsg({ tone: "ok", text: "Staff account created." });
    } catch (err) {
      setStaffMsg({ tone: "err", text: err instanceof Error ? err.message : "Failed to add staff." });
    } finally {
      setStaffBusy(false);
    }
  };

  const patchStaff = async (member: StaffMember, patch: Record<string, unknown>) => {
    setStaffMsg(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/staff/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to update staff.");
      setStaff((cur) => cur.map((s) => (s.id === member.id ? (data.staff as StaffMember) : s)));
      setStaffMsg({ tone: "ok", text: "Staff account updated." });
    } catch (err) {
      setStaffMsg({ tone: "err", text: err instanceof Error ? err.message : "Failed to update staff." });
    }
  };

  const deleteStaff = async () => {
    if (!staffDel) return;
    setStaffBusy(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/staff/${staffDel.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to delete staff.");
      setStaff((cur) => cur.filter((s) => s.id !== staffDel.id));
      setStaffDel(null);
      setStaffMsg({ tone: "ok", text: "Staff account deleted." });
    } catch (err) {
      setStaffMsg({ tone: "err", text: err instanceof Error ? err.message : "Failed to delete staff." });
    } finally {
      setStaffBusy(false);
    }
  };

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

      {multiUserEnabled && canManageStaff ? (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><Users className="h-4 w-4 text-accent" /> Staff accounts</h2>
          <p className="mt-0.5 text-sm text-muted">Add manager/cashier logins for your team. Staff sign in on /login and land directly in this shop.</p>

          <form onSubmit={addStaff} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm"><span className="mb-1 block font-medium text-foreground">Name</span>
              <input value={staffName} onChange={(e) => setStaffName(e.target.value)} required minLength={2} className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground" />
            </label>
            <label className="text-sm"><span className="mb-1 block font-medium text-foreground">Email</span>
              <input type="email" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} required className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground" />
            </label>
            <label className="text-sm"><span className="mb-1 block font-medium text-foreground">Temporary password</span>
              <input type="password" value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)} required minLength={10} autoComplete="new-password" className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground" />
              <span className="mt-1 block text-[11px] text-muted">Min 10 chars with upper/lowercase + number.</span>
            </label>
            <label className="text-sm"><span className="mb-1 block font-medium text-foreground">Role</span>
              <select value={staffRole} onChange={(e) => setStaffRole(e.target.value)} className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground">
                <option value="CASHIER">Cashier</option>
                <option value="MANAGER">Manager</option>
              </select>
            </label>
            {staffMsg ? <div className={cn("rounded-lg border px-3 py-2 text-sm sm:col-span-2", staffMsg.tone === "ok" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300")}>{staffMsg.text}</div> : null}
            <div className="sm:col-span-2">
              <button type="submit" disabled={staffBusy} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-60">
                {staffBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Add staff account
              </button>
            </div>
          </form>

          <div className="mt-5 overflow-hidden rounded-lg border border-line">
            {staffLoading ? (
              <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading staff…</div>
            ) : staff.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">No staff accounts yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {staff.map((member) => (
                  <li key={member.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{member.name}{member.role === "OWNER" ? <span className="ml-1.5 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">OWNER</span> : null}</p>
                      <p className="truncate text-xs text-muted">{member.email}</p>
                    </div>
                    {member.role !== "OWNER" ? (
                      <>
                        <select value={member.role} onChange={(e) => void patchStaff(member, { role: e.target.value })} className="focus-ring h-8 rounded-md border border-line bg-surface-2 px-2 text-xs text-foreground" aria-label={`Role for ${member.name}`}>
                          <option value="CASHIER">Cashier</option>
                          <option value="MANAGER">Manager</option>
                        </select>
                        <button type="button" onClick={() => void patchStaff(member, { isActive: !member.isActive })} className={cn("focus-ring rounded-md border px-2 py-1 text-xs font-medium", member.isActive ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-line bg-surface-2 text-muted")}>{member.isActive ? "Active" : "Disabled"}</button>
                        <button type="button" onClick={() => setStaffDel(member)} className="focus-ring rounded-md border border-line bg-surface-2 p-1.5 text-muted hover:border-rose-400/40 hover:text-rose-600" aria-label={`Delete ${member.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
                      </>
                    ) : (
                      <span className="text-xs text-muted">Owner</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><Users className="h-4 w-4 text-muted" /> Staff accounts</h2>
          <p className="mt-1 text-sm text-muted">Staff accounts &amp; roles are not enabled for this business. Contact the platform admin to enable <b>Staff accounts</b> from Access.</p>
        </section>
      )}

      <ConfirmDialog
        open={!!staffDel}
        onClose={() => (staffBusy ? undefined : setStaffDel(null))}
        onConfirm={() => void deleteStaff()}
        title="Delete staff account?"
        description={staffDel ? <span>{staffDel.name} ({staffDel.email}) ka login delete ho jayega.</span> : null}
        confirmLabel="Delete"
        tone="danger"
        loading={staffBusy}
      />
    </div>
  );
}
