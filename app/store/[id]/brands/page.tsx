"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { ChevronRight, ImagePlus, Loader2, Pencil, Plus, Tag, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Brand = { id: string; name: string; imageUrl?: string | null; _count?: { products: number } };

async function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

export default function StoreBrandsPage({ params }: { params: { id: string } }) {
  const businessId = params.id;
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [edit, setEdit] = useState<Brand | null>(null);
  const [editName, setEditName] = useState("");
  const [editImage, setEditImage] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [del, setDel] = useState<Brand | null>(null);
  const [delBusy, setDelBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/brands`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setBrands(Array.isArray(data.brands) ? data.brands : []);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { void load(); }, [load]);

  const flashErr = (m: string) => { setError(m); setNotice(""); };
  const flashOk = (m: string) => { setNotice(m); setError(""); };

  const onImage = async (e: ChangeEvent<HTMLInputElement>, set: (v: string | null) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { flashErr("Image file select karein."); return; }
    try { set(await readImage(file)); } catch { flashErr("Image load nahi ho saki."); }
    e.target.value = "";
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    flashOk(""); setError("");
    const n = name.trim();
    if (n.length < 2) { flashErr("Brand name likhein."); return; }
    setAdding(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/brands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n, imageUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Brand add nahi ho saka.");
      setBrands((cur) => [...cur, data.brand as Brand].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setImageUrl(null);
      flashOk("Brand add ho gaya.");
    } catch (err) {
      flashErr(err instanceof Error ? err.message : "Brand add nahi ho saka.");
    } finally {
      setAdding(false);
    }
  };

  const openEdit = (b: Brand) => { setEdit(b); setEditName(b.name); setEditImage(b.imageUrl ?? null); };

  const saveEdit = async () => {
    if (!edit) return;
    const n = editName.trim();
    if (n.length < 2) { flashErr("Brand name likhein."); return; }
    setEditBusy(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/brands/${edit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n, imageUrl: editImage }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Update nahi ho saka.");
      setBrands((cur) => cur.map((b) => (b.id === edit.id ? { ...b, ...(data.brand || {}), name: n, imageUrl: editImage } : b)).sort((a, b) => a.name.localeCompare(b.name)));
      setEdit(null);
      flashOk("Brand update ho gaya.");
    } catch (err) {
      flashErr(err instanceof Error ? err.message : "Update nahi ho saka.");
    } finally {
      setEditBusy(false);
    }
  };

  const doDelete = async () => {
    if (!del) return;
    setDelBusy(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/brands/${del.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Delete nahi ho saka.");
      setBrands((cur) => cur.filter((b) => b.id !== del.id));
      setDel(null);
      flashOk("Brand delete ho gaya.");
    } catch (err) {
      flashErr(err instanceof Error ? err.message : "Delete nahi ho saka.");
    } finally {
      setDelBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-[22px] font-semibold tracking-tight text-foreground"><Tag className="h-5 w-5 text-accent" /> Brands</h1>
        <p className="mt-0.5 text-sm text-muted">Brands add, rename, photo upload ya delete karein. Product add karte waqt brand select hoga.</p>
      </div>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">Add brand</h2>
        <form onSubmit={add} className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2">
            {imageUrl ? (
              <img src={imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg border border-line object-cover" />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-line bg-surface-2 text-[10px] text-muted">Photo</span>
            )}
            <div className="flex flex-col gap-1">
              <label className="focus-ring inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground hover:border-line-strong">
                <ImagePlus className="h-3.5 w-3.5 text-muted" /> Upload photo
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => void onImage(e, setImageUrl)} />
              </label>
              {imageUrl ? <button type="button" onClick={() => setImageUrl(null)} className="text-[11px] font-medium text-muted hover:text-foreground">Remove</button> : null}
            </div>
          </div>
          <div className="min-w-[220px] flex-1">
            <label htmlFor="brand-name" className="mb-1 block text-xs font-medium text-muted">Brand name</label>
            <input id="brand-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Apple, Samsung, Oraimo" className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground placeholder:text-muted" />
          </div>
          <button type="submit" disabled={adding} className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-60">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add brand
          </button>
        </form>
        {error ? <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
        {notice ? <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">{notice}</p> : null}
      </section>

      <section className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">All brands</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : brands.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">Abhi koi brand nahi. Upar se brand + photo add karein (Apple, Samsung, etc.).</p>
        ) : (
          <ul className="divide-y divide-line">
            {brands.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
                {b.imageUrl ? (
                  <img src={b.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-line object-cover" />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-line bg-surface-2 text-[10px] text-muted">Photo</span>
                )}
                <Link href={`/store/${businessId}/brands/${b.id}`} className="focus-ring min-w-0 flex-1">
                  <p className="font-medium text-foreground">{b.name}</p>
                  <p className="text-xs text-muted">{b._count?.products ?? 0} products</p>
                </Link>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => openEdit(b)} className="focus-ring rounded-md border border-line bg-surface p-1.5 text-muted hover:text-foreground" aria-label="Edit brand" title="Edit"><Pencil className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setDel(b)} className="focus-ring rounded-md border border-line bg-surface p-1.5 text-muted hover:border-rose-400/40 hover:text-rose-600" aria-label="Delete brand" title="Delete"><Trash2 className="h-4 w-4" /></button>
                  <Link href={`/store/${businessId}/brands/${b.id}`} className="rounded-md p-1.5 text-muted hover:text-foreground" aria-label="Open"><ChevronRight className="h-4 w-4" /></Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Internal edit modal (no native prompt) */}
      {edit ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Edit brand">
          <div className="absolute inset-0 bg-overlay/65 backdrop-blur-sm" onMouseDown={() => (editBusy ? null : setEdit(null))} aria-hidden />
          <div className="relative z-10 w-full max-w-sm rounded-t-2xl border border-line bg-surface p-5 shadow-panel sm:rounded-2xl">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base font-semibold text-foreground">Edit brand</h3>
              <button type="button" onClick={() => (editBusy ? null : setEdit(null))} className="rounded-md p-1 text-muted hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              {editImage ? (
                <img src={editImage} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-line object-cover" />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-line bg-surface-2 text-[10px] text-muted">Photo</span>
              )}
              <div className="flex flex-col gap-1">
                <label className="focus-ring inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground hover:border-line-strong">
                  <ImagePlus className="h-3.5 w-3.5 text-muted" /> Upload photo
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => void onImage(e, setEditImage)} />
                </label>
                {editImage ? <button type="button" onClick={() => setEditImage(null)} className="text-[11px] font-medium text-muted hover:text-foreground">Remove photo</button> : null}
              </div>
            </div>
            <label className="mt-3 mb-1 block text-xs font-medium text-muted">Brand name</label>
            <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void saveEdit(); if (e.key === "Escape" && !editBusy) setEdit(null); }} className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground" />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" disabled={editBusy} onClick={() => setEdit(null)} className="focus-ring rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-medium text-foreground disabled:opacity-50">Cancel</button>
              <button type="button" disabled={editBusy} onClick={() => void saveEdit()} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-60">{editBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Save</button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!del}
        onClose={() => (delBusy ? undefined : setDel(null))}
        onConfirm={() => void doDelete()}
        title="Delete brand?"
        description={del ? <span>“{del.name}” delete ho jayega. Is brand ki products rehengi (brand unse hat jayega).</span> : null}
        confirmLabel="Delete"
        tone="danger"
        loading={delBusy}
      />
    </div>
  );
}
