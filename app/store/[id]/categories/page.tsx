"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Layers, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Category = { id: string; name: string; _count?: { products: number } };

export default function StoreCategoriesPage({ params }: { params: { id: string } }) {
  const businessId = params.id;
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [edit, setEdit] = useState<Category | null>(null);
  const [editName, setEditName] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [del, setDel] = useState<Category | null>(null);
  const [delBusy, setDelBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/categories`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setCategories(Array.isArray(data.categories) ? data.categories : []);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { void load(); }, [load]);

  const flashErr = (m: string) => { setError(m); setNotice(""); };
  const flashOk = (m: string) => { setNotice(m); setError(""); };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    flashOk(""); setError("");
    const n = name.trim();
    if (n.length < 2) { flashErr("Category name likhein."); return; }
    setAdding(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Category add nahi ho saki.");
      setCategories((cur) => [...cur, data.category as Category].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      flashOk("Category add ho gayi.");
    } catch (err) {
      flashErr(err instanceof Error ? err.message : "Category add nahi ho saki.");
    } finally {
      setAdding(false);
    }
  };

  const saveEdit = async () => {
    if (!edit) return;
    const n = editName.trim();
    if (n.length < 2) { flashErr("Category name likhein."); return; }
    setEditBusy(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/categories/${edit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Update nahi ho saka.");
      setCategories((cur) => cur.map((c) => (c.id === edit.id ? { ...c, ...(data.category || {}), name: n } : c)).sort((a, b) => a.name.localeCompare(b.name)));
      setEdit(null);
      flashOk("Category update ho gayi.");
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
      const res = await fetch(`/api/businesses/${businessId}/categories/${del.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Delete nahi ho saka.");
      setCategories((cur) => cur.filter((c) => c.id !== del.id));
      setDel(null);
      flashOk("Category delete ho gayi.");
    } catch (err) {
      flashErr(err instanceof Error ? err.message : "Delete nahi ho saka.");
    } finally {
      setDelBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-[22px] font-semibold tracking-tight text-foreground"><Layers className="h-5 w-5 text-accent" /> Categories</h1>
        <p className="mt-0.5 text-sm text-muted">Categories add, rename ya delete karein. Product add karte waqt category select hogi.</p>
      </div>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">Add category</h2>
        <form onSubmit={add} className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <label htmlFor="cat-name" className="mb-1 block text-xs font-medium text-muted">Category name</label>
            <input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. AirPods, Cables, Covers, Chargers" className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground placeholder:text-muted" />
          </div>
          <button type="submit" disabled={adding} className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-60">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add category
          </button>
        </form>
        {error ? <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
        {notice ? <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">{notice}</p> : null}
      </section>

      <section className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">All categories</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : categories.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">Abhi koi category nahi. Upar se category add karein.</p>
        ) : (
          <ul className="divide-y divide-line">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center gap-2 px-4 py-3 hover:bg-surface-2/60">
                <Link href={`/store/${businessId}/categories/${c.id}`} className="focus-ring min-w-0 flex-1">
                  <p className="font-medium text-foreground">{c.name}</p>
                  <p className="text-xs text-muted">{c._count?.products ?? 0} products</p>
                </Link>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => { setEdit(c); setEditName(c.name); }} className="focus-ring rounded-md border border-line bg-surface p-1.5 text-muted hover:text-foreground" aria-label="Edit category" title="Edit"><Pencil className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setDel(c)} className="focus-ring rounded-md border border-line bg-surface p-1.5 text-muted hover:border-rose-400/40 hover:text-rose-600" aria-label="Delete category" title="Delete"><Trash2 className="h-4 w-4" /></button>
                  <Link href={`/store/${businessId}/categories/${c.id}`} className="rounded-md p-1.5 text-muted hover:text-foreground" aria-label="Open"><ChevronRight className="h-4 w-4" /></Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {edit ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Edit category">
          <div className="absolute inset-0 bg-overlay/65 backdrop-blur-sm" onMouseDown={() => (editBusy ? null : setEdit(null))} aria-hidden />
          <div className="relative z-10 w-full max-w-sm rounded-t-2xl border border-line bg-surface p-5 shadow-panel sm:rounded-2xl">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base font-semibold text-foreground">Edit category</h3>
              <button type="button" onClick={() => (editBusy ? null : setEdit(null))} className="rounded-md p-1 text-muted hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void saveEdit(); if (e.key === "Escape" && !editBusy) setEdit(null); }} className="focus-ring mt-3 h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground" />
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
        title="Delete category?"
        description={del ? <span>“{del.name}” delete ho jayegi. Is category ki products rehengi (category unse hat jayegi).</span> : null}
        confirmLabel="Delete"
        tone="danger"
        loading={delBusy}
      />
    </div>
  );
}
