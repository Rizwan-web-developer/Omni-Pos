"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Layers, Loader2, Search } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type SerialTag = { id: string; serialOrImei: string; isSold?: boolean };
type Product = {
  id: string; name: string; category?: string | null; brand?: string | null; imageUrl?: string | null;
  trackingType?: "QUANTITY_ONLY" | "SERIAL_OR_IMEI"; sellingPrice: number; stockQuantity: number; serialItems?: SerialTag[];
};
type Category = { id: string; name: string; _count?: { products: number } };

export default function StoreCategoryDetailPage({ params }: { params: { id: string; categoryId: string } }) {
  const { id: businessId, categoryId } = params;
  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [brandFilter, setBrandFilter] = useState("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/categories/${categoryId}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCategory(data.category ?? null);
        setProducts(Array.isArray(data.products) ? data.products : []);
      } else {
        setCategory(null);
      }
    } finally {
      setLoading(false);
    }
  }, [businessId, categoryId]);

  useEffect(() => { void load(); }, [load]);

  const brands = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) { const b = (p.brand || "").trim(); if (b) set.add(b); }
    return ["ALL", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [products]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return products.filter((p) => {
      if (brandFilter !== "ALL" && (p.brand || "").trim() !== brandFilter) return false;
      if (!t) return true;
      return [p.name, p.brand, p.category].some((v) => (v || "").toLowerCase().includes(t));
    });
  }, [products, q, brandFilter]);

  if (loading) return <div className="flex items-center gap-2 py-16 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  if (!category) {
    return (
      <div className="space-y-3">
        <Link href={`/store/${businessId}/categories`} className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"><ArrowLeft className="h-4 w-4" /> Categories</Link>
        <p className="text-sm text-muted">Category nahi mili.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/store/${businessId}/categories`} className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"><ArrowLeft className="h-3.5 w-3.5" /> Categories</Link>
        <h1 className="mt-1 flex items-center gap-2 text-[22px] font-semibold tracking-tight text-foreground"><Layers className="h-5 w-5 text-accent" /> {category.name}</h1>
        <p className="mt-0.5 text-sm text-muted">{products.length} products (har brand ki) is category mein.</p>
      </div>

      <section className="rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-medium text-muted">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Product search karein…" className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 pl-8 pr-3 text-sm text-foreground placeholder:text-muted" />
            </div>
          </div>
          <div className="w-full sm:w-[240px]">
            <label className="mb-1 block text-xs font-medium text-muted">Brand</label>
            <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground">
              {brands.map((b) => <option key={b} value={b}>{b === "ALL" ? "All brands" : b}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="border-b border-line px-4 py-3"><h2 className="text-base font-semibold text-foreground">Products</h2><p className="text-sm text-muted">{filtered.length} shown</p></div>
        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">{products.length === 0 ? "Is category mein abhi koi product nahi. Product add karte waqt yeh category select karein." : "Is filter/search se koi product nahi mili."}</p>
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((p) => {
              const serialized = p.trackingType === "SERIAL_OR_IMEI";
              const soldOut = serialized && p.stockQuantity <= 0;
              return (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                  {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-md border border-line object-cover" /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-dashed border-line bg-surface-2 text-[10px] text-muted">IMG</span>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{p.name} {soldOut ? <span className="ml-1 rounded bg-rose-500/10 px-1.5 py-0.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">Sold out</span> : null}</p>
                    <p className="truncate text-xs text-muted">{p.brand || "—"} · {serialized ? `Serial/IMEI (${p.stockQuantity})` : `Stock ${p.stockQuantity}`}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{formatCurrency(p.sellingPrice)}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
