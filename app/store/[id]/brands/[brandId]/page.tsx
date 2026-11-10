"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Search, Tag } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

type SerialTag = { id: string; serialOrImei: string; isSold?: boolean };
type Product = {
  id: string; name: string; category?: string | null; brand?: string | null; imageUrl?: string | null;
  trackingType?: "QUANTITY_ONLY" | "SERIAL_OR_IMEI"; sellingPrice: number; stockQuantity: number; serialItems?: SerialTag[];
};
type Brand = { id: string; name: string; _count?: { products: number } };

export default function StoreBrandDetailPage({ params }: { params: { id: string; brandId: string } }) {
  const { id: businessId, brandId } = params;
  const [brand, setBrand] = useState<Brand | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, catRes] = await Promise.all([
        fetch(`/api/businesses/${businessId}/brands/${brandId}`, { cache: "no-store" }),
        fetch(`/api/businesses/${businessId}/categories`, { cache: "no-store" }),
      ]);
      const data = await res.json().catch(() => ({}));
      const catData = await catRes.json().catch(() => ({}));
      if (res.ok) {
        setBrand(data.brand ?? null);
        setProducts(Array.isArray(data.products) ? data.products : []);
      } else {
        setBrand(null);
      }
      if (catRes.ok && Array.isArray(catData.categories)) {
        setAllCategories(catData.categories.map((c: any) => String(c?.name || "")).filter(Boolean));
      }
    } finally {
      setLoading(false);
    }
  }, [businessId, brandId]);

  useEffect(() => { void load(); }, [load]);

  const categories = useMemo(() => {
    const set = new Set<string>(allCategories);
    // include any category present on products (legacy/edge)
    for (const p of products) {
      const c = (p.category || "").trim();
      if (c) set.add(c);
    }
    return ["ALL", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [products, allCategories]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return products.filter((p) => {
      if (cat !== "ALL" && (p.category || "").trim() !== cat) return false;
      if (!t) return true;
      return [p.name, p.category, p.brand].some((v) => (v || "").toLowerCase().includes(t));
    });
  }, [products, q, cat]);

  if (loading) return <div className="flex items-center gap-2 py-16 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  if (!brand) {
    return (
      <div className="space-y-3">
        <Link href={`/store/${businessId}/brands`} className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"><ArrowLeft className="h-4 w-4" /> Brands</Link>
        <p className="text-sm text-muted">Brand nahi mila.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/store/${businessId}/brands`} className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"><ArrowLeft className="h-3.5 w-3.5" /> Brands</Link>
          <h1 className="mt-1 flex items-center gap-2 text-[22px] font-semibold tracking-tight text-foreground"><Tag className="h-5 w-5 text-accent" /> {brand.name}</h1>
          <p className="mt-0.5 text-sm text-muted">{products.length} products is brand mein.</p>
        </div>
      </div>

      <section className="rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-medium text-muted">Search (is brand ki product)</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Product search karein…" className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 pl-8 pr-3 text-sm text-foreground placeholder:text-muted" />
            </div>
          </div>
          <div className="w-full sm:w-[240px]">
            <label className="mb-1 block text-xs font-medium text-muted">Product category</label>
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground">
              {categories.map((c) => (
                <option key={c} value={c}>{c === "ALL" ? "All categories" : c}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">Products</h2>
          <p className="text-sm text-muted">{filtered.length} shown</p>
        </div>
        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">
            {products.length === 0 ? "Is brand mein abhi koi product nahi. Product add karte waqt yeh brand select karein." : "Is filter/search se koi product nahi mili."}
          </p>
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
                    <p className="truncate text-xs text-muted">{p.category || "—"} · {serialized ? (soldOut ? "Serial/IMEI (Sold out)" : `Serial/IMEI (${p.stockQuantity})`) : `Stock ${p.stockQuantity}`}</p>
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
