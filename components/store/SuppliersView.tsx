"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Truck,
  Wallet,
  X,
} from "lucide-react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn, formatCurrency } from "@/lib/utils";

type LedgerEntry = {
  id: string;
  type: "PURCHASE" | "PAYMENT";
  amountPkr: number;
  paidAmount: number;
  remainingPkr: number;
  isPaid: boolean;
  unitCost: number | null;
  quantity: number | null;
  productId: string | null;
  productName: string | null;
  note?: string | null;
  createdAt: string;
};

type SupplierProduct = {
  id: string;
  name: string;
  imageUrl?: string | null;
  category?: string;
  stockQuantity: number;
  costPrice: number;
  sellingPrice: number;
  soldQuantity: number;
  revenue: number;
};

type Supplier = {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  imageUrl?: string | null;
  purchasesPkr: number;
  paymentsPkr: number;
  balancePkr: number;
  entries: LedgerEntry[];
  products: SupplierProduct[];
};

type SimpleProduct = {
  id: string;
  name: string;
  stockQuantity: number;
  sellingPrice: number;
  trackingType?: "QUANTITY_ONLY" | "SERIAL_OR_IMEI";
};

function parseSerials(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of input.split(/[\n,;\s]+/)) {
    const s = part.trim();
    if (!s) continue;
    if (s.length < 4 || s.length > 40 || !/^[A-Za-z0-9\-]+$/.test(s)) continue;
    const key = s.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

async function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.readAsDataURL(file);
  });
}

export function SuppliersView({ businessId }: { businessId: string }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [allProducts, setAllProducts] = useState<SimpleProduct[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Add / edit supplier
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editImage, setEditImage] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);

  // Purchase / stock entry
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [productSearch, setProductSearch] = useState("");
  const [productId, setProductId] = useState("");
  const [newName, setNewName] = useState("");
  const [newSellingPrice, setNewSellingPrice] = useState("");
  const [newSerialized, setNewSerialized] = useState(false);
  const [sellPriceEdit, setSellPriceEdit] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [serialText, setSerialText] = useState("");
  const [paidNow, setPaidNow] = useState("");
  const [billNote, setBillNote] = useState("");
  const [billBusy, setBillBusy] = useState(false);

  // Payment
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [payBusy, setPayBusy] = useState(false);

  const [delSupplier, setDelSupplier] = useState<Supplier | null>(null);
  const [delEntry, setDelEntry] = useState<LedgerEntry | null>(null);
  const [delBusy, setDelBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [sRes, pRes] = await Promise.all([
        fetch(`/api/businesses/${businessId}/suppliers`, { cache: "no-store" }),
        fetch(`/api/businesses/${businessId}/products`, { cache: "no-store" }),
      ]);
      const sData = await sRes.json().catch(() => ({}));
      const pData = await pRes.json().catch(() => ({}));
      if (!sRes.ok) throw new Error(sData.message || "Failed to load suppliers.");
      const list = Array.isArray(sData.suppliers) ? (sData.suppliers as Supplier[]) : [];
      setSuppliers(list);
      setAllProducts(Array.isArray(pData.products) ? (pData.products as SimpleProduct[]) : []);
      setSelectedId((cur) => (cur && list.some((s) => s.id === cur) ? cur : list[0]?.id ?? null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load suppliers.");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { void load(); }, [load]);

  const selected = suppliers.find((s) => s.id === selectedId) ?? null;

  const totalPurchases = suppliers.reduce((sum, s) => sum + s.purchasesPkr, 0);
  const totalPaid = suppliers.reduce((sum, s) => sum + s.paymentsPkr, 0);
  const totalRemaining = suppliers.reduce((sum, s) => sum + s.balancePkr, 0);

  const purchaseBills = useMemo(
    () => (selected ? selected.entries.filter((e) => e.type === "PURCHASE") : []),
    [selected],
  );
  const paymentEntries = useMemo(
    () => (selected ? selected.entries.filter((e) => e.type === "PAYMENT") : []),
    [selected],
  );

  const productMatches = useMemo(() => {
    const t = productSearch.trim().toLowerCase();
    const base = allProducts;
    if (!t) return base.slice(0, 6);
    return base.filter((p) => p.name.toLowerCase().includes(t)).slice(0, 8);
  }, [allProducts, productSearch]);

  const chosenProduct = allProducts.find((p) => p.id === productId) ?? null;
  const serials = useMemo(() => parseSerials(serialText), [serialText]);
  const isSerializedEntry = mode === "existing" ? chosenProduct?.trackingType === "SERIAL_OR_IMEI" : newSerialized;
  const effectiveQty = isSerializedEntry ? serials.length : Math.max(0, Math.floor(Number(quantity) || 0));

  const total = useMemo(() => {
    const c = Number(unitCost) || 0;
    return Math.round(effectiveQty * c * 100) / 100;
  }, [effectiveQty, unitCost]);

  const resetBillForm = () => {
    setProductId("");
    setProductSearch("");
    setNewName("");
    setNewSellingPrice("");
    setNewSerialized(false);
    setSellPriceEdit("");
    setQuantity("1");
    setUnitCost("");
    setSerialText("");
    setPaidNow("");
    setBillNote("");
    setMode("existing");
  };

  const openEdit = (supplier: Supplier) => {
    setEditName(supplier.name);
    setEditPhone(supplier.phone ?? "");
    setEditAddress(supplier.address ?? "");
    setEditImage(supplier.imageUrl ?? null);
    setEditOpen(true);
  };

  const onImage = async (e: ChangeEvent<HTMLInputElement>, set: (v: string | null) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Select an image file."); return; }
    try { set(await readImage(file)); } catch { setError("Could not load the image."); }
    e.target.value = "";
  };

  const createSupplier = async () => {
    setError(""); setNotice("");
    if (name.trim().length < 2) { setError("Enter a supplier name."); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/suppliers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, address, imageUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to create supplier.");
      const supplier = data.supplier as Supplier;
      setSuppliers((cur) => [...cur, supplier].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedId(supplier.id);
      setAddOpen(false);
      setName(""); setPhone(""); setAddress(""); setImageUrl(null);
      setNotice("Supplier added.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create supplier.");
    } finally {
      setSaving(false);
    }
  };

  const saveSupplier = async () => {
    if (!selected) return;
    setError(""); setNotice("");
    if (editName.trim().length < 2) { setError("Enter a supplier name."); return; }
    setEditBusy(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/suppliers/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, phone: editPhone, address: editAddress, imageUrl: editImage }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to update supplier.");
      const updated = data.supplier as Supplier;
      setSuppliers((cur) => cur.map((s) => (s.id === updated.id ? updated : s)).sort((a, b) => a.name.localeCompare(b.name)));
      setEditOpen(false);
      setNotice("Supplier updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update supplier.");
    } finally {
      setEditBusy(false);
    }
  };

  const createBill = async () => {
    if (!selected) return;
    setError(""); setNotice("");
    const qty = effectiveQty;
    if (qty <= 0) { setError(isSerializedEntry ? "Add at least one Serial/IMEI." : "Enter a quantity of 1 or more."); return; }
    const cost = Number(unitCost);
    if (!Number.isFinite(cost) || cost < 0) { setError("Enter a valid purchase price."); return; }
    if (mode === "existing" && !productId) { setError("Search and select a product, or add a new product."); return; }
    if (mode === "new" && newName.trim().length < 2) { setError("Enter a name for the new product."); return; }
    if (mode === "new" && (!Number.isFinite(Number(newSellingPrice)) || Number(newSellingPrice) < 0)) {
      setError("Enter a valid selling price for the new product.");
      return;
    }
    const paid = Number(paidNow || 0);
    if (!Number.isFinite(paid) || paid < 0) { setError("Enter a valid paid amount."); return; }
    if (paid > total) { setError("Paid amount cannot be more than the total."); return; }

    setBillBusy(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/suppliers/${selected.id}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "PURCHASE",
          productId: mode === "existing" ? productId : undefined,
          newProduct: mode === "new"
            ? { name: newName, sellingPrice: Number(newSellingPrice || 0) }
            : undefined,
          sellingPrice: mode === "existing" && sellPriceEdit !== "" ? Number(sellPriceEdit) : undefined,
          quantity: qty,
          unitCost: cost,
          serials: isSerializedEntry ? serials : undefined,
          paidNow: paid,
          note: billNote,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to save the stock entry.");
      resetBillForm();
      setNotice("Stock entry saved. Purchases, stock and totals are updated.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save the stock entry.");
    } finally {
      setBillBusy(false);
    }
  };

  const addPayment = async () => {
    if (!selected) return;
    setError(""); setNotice("");
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) { setError("Enter a valid payment amount."); return; }
    setPayBusy(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/suppliers/${selected.id}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "PAYMENT", amountPkr: amount, note: payNote }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to save the payment.");
      setPayAmount(""); setPayNote("");
      setNotice("Payment saved.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save the payment.");
    } finally {
      setPayBusy(false);
    }
  };

  const deleteSupplier = async () => {
    if (!delSupplier) return;
    setDelBusy(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/suppliers/${delSupplier.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to delete supplier.");
      setSuppliers((cur) => cur.filter((s) => s.id !== delSupplier.id));
      if (selectedId === delSupplier.id) setSelectedId(null);
      setDelSupplier(null);
      setNotice("Supplier deleted. Its products stay in inventory.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete supplier.");
    } finally {
      setDelBusy(false);
    }
  };

  const deleteEntry = async () => {
    if (!delEntry || !selected) return;
    setDelBusy(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/suppliers/${selected.id}/entries?entryId=${encodeURIComponent(delEntry.id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to delete entry.");
      setDelEntry(null);
      setNotice(delEntry.type === "PURCHASE" ? "Purchase bill deleted. Stock was reduced." : "Payment deleted.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete entry.");
    } finally {
      setDelBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[22px] font-semibold tracking-tight text-foreground"><Truck className="h-5 w-5 text-accent" /> Suppliers</h1>
          <p className="mt-0.5 text-sm text-muted">The shops or companies you buy stock from. Track purchases, payments and what is still left to pay.</p>
        </div>
        <button type="button" onClick={() => setAddOpen(true)} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg">
          <Plus className="h-4 w-4" /> Add supplier
        </button>
      </div>

      <div className="rounded-xl border border-accent-line bg-accent-soft/50 p-4 text-sm text-foreground">
        <p className="font-semibold">How it works</p>
        <p className="mt-1 text-muted">
          A supplier is the shop you take stock from. Add the supplier, then record a purchase bill for each stock you take.
          If you pay the whole bill right away, it is marked <b className="text-foreground">Paid</b>. If you pay part of it,
          the bill shows the amount paid and the amount still left. Every product you buy stays linked to that supplier,
          so you can see its stock, how much was sold and the revenue it generated.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Suppliers", String(suppliers.length)],
          ["Total purchases", formatCurrency(totalPurchases)],
          ["Total paid", formatCurrency(totalPaid)],
          ["Still to pay", formatCurrency(totalRemaining)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line bg-surface p-4">
            <p className="text-xs font-medium text-muted">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {error ? <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{error}</div> : null}
      {notice ? <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">{notice}</div> : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-12 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading suppliers…</div>
      ) : suppliers.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface px-4 py-12 text-center text-sm text-muted">No suppliers yet. Add your first supplier to start recording purchases.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
          <section className="overflow-hidden rounded-xl border border-line bg-surface">
            <ul className="divide-y divide-line">
              {suppliers.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => { setSelectedId(s.id); setError(""); setNotice(""); }} className={cn("focus-ring flex w-full items-center gap-3 px-4 py-3 text-left", selectedId === s.id ? "bg-accent-soft" : "hover:bg-surface-2/60")}>
                    <SupplierAvatar supplier={s} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">{s.name}</span>
                      <span className="block text-xs text-muted">{s.products.length} products · {s.phone || "No phone"}</span>
                    </span>
                    <span className={cn("shrink-0 text-sm font-semibold tabular-nums", s.balancePkr > 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300")}>{formatCurrency(s.balancePkr)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {selected ? (
            <section className="space-y-4">
              <div className="rounded-xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <SupplierAvatar supplier={selected} size={56} />
                    <div>
                      <h2 className="text-base font-semibold text-foreground">{selected.name}</h2>
                      <p className="text-xs text-muted">{[selected.phone, selected.address].filter(Boolean).join(" · ") || "No contact details"}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => openEdit(selected)} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-muted hover:text-foreground"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                    <button type="button" onClick={() => setDelSupplier(selected)} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-muted hover:border-rose-400/40 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border border-line bg-surface-2 px-3 py-2"><p className="text-[11px] text-muted">Purchases</p><p className="text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400">{formatCurrency(selected.purchasesPkr)}</p></div>
                  <div className="rounded-lg border border-line bg-surface-2 px-3 py-2"><p className="text-[11px] text-muted">Paid</p><p className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{formatCurrency(selected.paymentsPkr)}</p></div>
                  <div className="rounded-lg border border-accent-line bg-accent-soft px-3 py-2"><p className="text-[11px] text-muted">Remaining to pay</p><p className="text-sm font-semibold tabular-nums text-foreground">{formatCurrency(selected.balancePkr)}</p></div>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Add stock entry</h3>
                    <p className="text-xs text-muted">Select a product (or add a new one), enter quantity and prices. Total is calculated automatically.</p>
                  </div>
                  <div className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5" role="group" aria-label="Product mode">
                    <button type="button" onClick={() => setMode("existing")} className={cn("focus-ring rounded-md px-3 py-1.5 text-xs font-medium", mode === "existing" ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground")} aria-pressed={mode === "existing"}>Select product</button>
                    <button type="button" onClick={() => { setMode("new"); setProductId(""); }} className={cn("focus-ring rounded-md px-3 py-1.5 text-xs font-medium", mode === "new" ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground")} aria-pressed={mode === "new"}>New product</button>
                  </div>
                </div>

                <div className="mt-3 grid gap-3">
                  {mode === "existing" ? (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted">Product</label>
                      {productId && chosenProduct ? (
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-accent-line bg-accent-soft px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{chosenProduct.name}</p>
                            <p className="text-xs text-muted">
                              In stock: {chosenProduct.stockQuantity} · Sells at {formatCurrency(chosenProduct.sellingPrice)}
                              {chosenProduct.trackingType === "SERIAL_OR_IMEI" ? " · Serial/IMEI product" : ""}
                            </p>
                          </div>
                          <button type="button" onClick={() => { setProductId(""); setProductSearch(""); setSellPriceEdit(""); setSerialText(""); }} className="focus-ring rounded-md p-1 text-muted hover:text-foreground" aria-label="Clear selected product"><X className="h-4 w-4" /></button>
                        </div>
                      ) : (
                        <div>
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                            <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Search a product by name…" className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 pl-8 pr-3 text-sm text-foreground placeholder:text-muted" />
                          </div>
                          <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-line">
                            {productMatches.length === 0 ? (
                              <p className="px-3 py-4 text-center text-xs text-muted">No product found. Use &quot;New product&quot; to add it first.</p>
                            ) : (
                              <ul className="divide-y divide-line">
                                {productMatches.map((p) => (
                                  <li key={p.id}>
                                    <button type="button" onClick={() => { setProductId(p.id); setProductSearch(""); setSellPriceEdit(String(p.sellingPrice ?? "")); setSerialText(""); }} className="focus-ring flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2">
                                      <span className="min-w-0 truncate text-foreground">{p.name}{p.trackingType === "SERIAL_OR_IMEI" ? <span className="ml-1 text-[11px] text-accent">(Serial/IMEI)</span> : null}</span>
                                      <span className="shrink-0 text-xs text-muted">Stock {p.stockQuantity}</span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-xs font-medium text-muted">New product name *</label>
                        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. iPhone 15 Pro" className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground placeholder:text-muted" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted">Selling price ($) *</label>
                        <input type="number" min="0" step="0.01" value={newSellingPrice} onChange={(e) => setNewSellingPrice(e.target.value)} placeholder="How much you will sell it for" className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm tabular-nums text-foreground placeholder:text-muted" />
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 text-sm text-foreground">
                          <input type="checkbox" checked={newSerialized} onChange={(e) => { setNewSerialized(e.target.checked); setSerialText(""); if (!e.target.checked) setQuantity("1"); }} className="h-4 w-4 accent-[rgb(var(--accent))]" />
                          Has Serial/IMEI
                        </label>
                      </div>
                      <p className="sm:col-span-2 text-xs text-muted">This product will be saved in inventory and linked to {selected.name}.</p>
                    </div>
                  )}

                  {isSerializedEntry ? (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted">Serial / IMEI numbers * (one per line)</label>
                      <textarea value={serialText} onChange={(e) => setSerialText(e.target.value)} rows={3} placeholder="Enter each Serial/IMEI on a new line" className="focus-ring w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted" />
                      <p className="mt-1 text-xs text-muted"><span className="font-semibold tabular-nums text-foreground">{serials.length}</span> item(s) — quantity is set from serial count.</p>
                    </div>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-3">
                    {!isSerializedEntry ? (
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted">Quantity *</label>
                        <input type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm tabular-nums text-foreground" />
                      </div>
                    ) : (
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted">Quantity</label>
                        <div className="flex h-10 items-center rounded-lg border border-line bg-surface-2 px-3 text-sm font-semibold tabular-nums text-foreground">{effectiveQty}</div>
                      </div>
                    )}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted">Purchase price / unit ($) *</label>
                      <input type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="What you pay per item" className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm tabular-nums text-foreground placeholder:text-muted" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted">Total stock amount</label>
                      <div className="flex h-10 items-center justify-between rounded-lg border border-line bg-surface-2 px-3 text-sm">
                        <span className="text-muted">{effectiveQty} × {formatCurrency(Number(unitCost) || 0)}</span>
                        <span className="font-semibold tabular-nums text-foreground">{formatCurrency(total)}</span>
                      </div>
                    </div>
                    {mode === "existing" ? (
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted">Selling price ($)</label>
                        <input type="number" min="0" step="0.01" value={sellPriceEdit} onChange={(e) => setSellPriceEdit(e.target.value)} placeholder="Update selling price" className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm tabular-nums text-foreground placeholder:text-muted" />
                      </div>
                    ) : null}
                    <div className={mode === "existing" ? "sm:col-span-2" : "sm:col-span-3"}>
                      <label className="mb-1 block text-xs font-medium text-muted">Bill note (optional)</label>
                      <input value={billNote} onChange={(e) => setBillNote(e.target.value)} placeholder="Invoice / bill reference" className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground placeholder:text-muted" />
                    </div>
                  </div>

                  <div className="rounded-lg border border-line bg-surface-2 p-3">
                    <p className="text-xs font-semibold text-foreground">Supplier payment for this stock</p>
                    <p className="mt-0.5 text-xs text-muted">Enter how much you paid now. If you pay the full amount it will be marked Paid. If you pay less, the remaining amount is saved.</p>
                    <div className="mt-2 grid gap-3 sm:grid-cols-[220px,1fr] sm:items-end">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted">Paid now ($)</label>
                        <input type="number" min="0" step="0.01" value={paidNow} onChange={(e) => setPaidNow(e.target.value)} placeholder="0" className="focus-ring h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm tabular-nums text-foreground placeholder:text-muted" />
                      </div>
                      <div className="text-sm">
                        {total > 0 ? (
                          Number(paidNow || 0) >= total ? (
                            <p className="font-medium text-emerald-700 dark:text-emerald-300">Full amount paid — this entry will be marked Paid.</p>
                          ) : (
                            <p className="text-muted">Paid <b className="text-foreground">{formatCurrency(Number(paidNow) || 0)}</b> · Remaining <b className="font-semibold text-amber-700 dark:text-amber-300">{formatCurrency(Math.max(0, total - (Number(paidNow) || 0)))}</b></p>
                          )
                        ) : (
                          <p className="text-muted">Enter quantity and purchase price to calculate the total.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button type="button" disabled={billBusy} onClick={() => void createBill()} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-60">
                      {billBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Save stock entry
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-surface p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Wallet className="h-4 w-4 text-accent" /> Record a payment</h3>
                <p className="text-xs text-muted">Use this to pay some or all of the remaining amount later.</p>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="text-xs font-medium text-muted"><span className="mb-1 block">Amount ($)</span>
                    <input type="number" min="0" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0" className="focus-ring h-10 w-32 rounded-lg border border-line bg-surface-2 px-3 text-sm tabular-nums text-foreground placeholder:text-muted" />
                  </label>
                  <label className="min-w-[180px] flex-1 text-xs font-medium text-muted"><span className="mb-1 block">Note (optional)</span>
                    <input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Cash, bank transfer, reference" className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground placeholder:text-muted" />
                  </label>
                  <button type="button" disabled={payBusy} onClick={() => void addPayment()} className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-60">
                    {payBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Save payment
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-line bg-surface">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <h3 className="text-sm font-semibold text-foreground">Purchase bills</h3>
                  <span className="text-xs text-muted">{purchaseBills.length} bills</span>
                </div>
                {purchaseBills.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted">No purchases yet. Add the first purchase bill above.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {purchaseBills.map((entry) => (
                      <li key={entry.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", entry.isPaid ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300")}>
                          {entry.isPaid ? <CheckCircle2 className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{entry.productName || "Purchase"}{entry.note ? <span className="font-normal text-muted"> · {entry.note}</span> : null}</p>
                          <p className="text-[11px] text-muted">
                            {entry.quantity ?? 0} x {formatCurrency(entry.unitCost ?? 0)} · {new Date(entry.createdAt).toLocaleString("en-US")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold tabular-nums text-foreground">{formatCurrency(entry.amountPkr)}</p>
                          {entry.isPaid ? (
                            <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Paid</span>
                          ) : (
                            <p className="text-[11px] text-muted">Paid {formatCurrency(entry.paidAmount)} · Remaining <b className="font-semibold text-amber-700 dark:text-amber-300">{formatCurrency(entry.remainingPkr)}</b></p>
                          )}
                        </div>
                        <button type="button" onClick={() => setDelEntry(entry)} className="focus-ring rounded-md p-1 text-muted hover:text-rose-600" aria-label="Delete purchase bill"><Trash2 className="h-3.5 w-3.5" /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="overflow-hidden rounded-xl border border-line bg-surface">
                <div className="border-b border-line px-4 py-3"><h3 className="text-sm font-semibold text-foreground">Payment history</h3></div>
                {paymentEntries.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted">No extra payments yet.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {paymentEntries.map((entry) => (
                      <li key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><ArrowDownLeft className="h-4 w-4" /></span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">Payment{entry.note ? <span className="font-normal text-muted"> · {entry.note}</span> : null}</p>
                          <p className="text-[11px] text-muted">{new Date(entry.createdAt).toLocaleString("en-US")}</p>
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{formatCurrency(entry.amountPkr)}</span>
                        <button type="button" onClick={() => setDelEntry(entry)} className="focus-ring rounded-md p-1 text-muted hover:text-rose-600" aria-label="Delete payment"><Trash2 className="h-3.5 w-3.5" /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="overflow-hidden rounded-xl border border-line bg-surface">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                  <h3 className="text-sm font-semibold text-foreground">Products from {selected.name}</h3>
                  <span className="text-xs text-muted">{selected.products.length} products</span>
                </div>
                {selected.products.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted">No products linked yet. Add a purchase bill above to link stock to this supplier.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-left text-sm">
                      <thead><tr className="border-b border-line bg-surface-2 text-xs font-semibold uppercase tracking-[0.04em] text-muted">
                        <th className="px-4 py-2.5">Product</th>
                        <th className="px-3 py-2.5 text-right">In stock</th>
                        <th className="px-3 py-2.5 text-right">Sold</th>
                        <th className="px-4 py-2.5 text-right">Revenue</th>
                      </tr></thead>
                      <tbody>
                        {selected.products.map((p) => (
                          <tr key={p.id} className="border-b border-line last:border-b-0">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-8 w-8 rounded-md border border-line object-cover" /> : null}
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-foreground">{p.name}</p>
                                  <p className="text-[11px] text-muted">Cost {formatCurrency(p.costPrice)} · Sells at {formatCurrency(p.sellingPrice)}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{p.stockQuantity}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{p.soldQuantity}</td>
                            <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{formatCurrency(p.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          ) : null}
        </div>
      )}

      {/* Add supplier */}
      {addOpen ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Add supplier">
          <div className="absolute inset-0 bg-overlay/65 backdrop-blur-sm" onMouseDown={() => (saving ? null : setAddOpen(false))} aria-hidden />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl border border-line bg-surface p-5 shadow-panel sm:rounded-2xl">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">Add supplier</h2>
              <button type="button" onClick={() => (saving ? null : setAddOpen(false))} className="rounded-md p-1 text-muted hover:text-foreground" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 grid gap-3">
              <label className="text-sm"><span className="mb-1 block text-xs font-medium text-muted">Supplier name *</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ali Traders" className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground placeholder:text-muted" />
              </label>
              <label className="text-sm"><span className="mb-1 block text-xs font-medium text-muted">Phone number</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 0300 1234567" className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground placeholder:text-muted" />
              </label>
              <div>
                <span className="mb-1 block text-xs font-medium text-muted">Supplier photo</span>
                <div className="flex items-center gap-3">
                  {imageUrl ? (
                    <img src={imageUrl} alt="" className="h-14 w-14 rounded-full border border-line object-cover" />
                  ) : (
                    <span className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-line bg-surface-2 text-[10px] text-muted">Photo</span>
                  )}
                  <label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-foreground hover:border-line-strong">
                    <ImagePlus className="h-4 w-4 text-muted" aria-hidden /> Upload photo
                    <input type="file" accept="image/*" className="sr-only" onChange={(e) => void onImage(e, setImageUrl)} />
                  </label>
                  {imageUrl ? <button type="button" onClick={() => setImageUrl(null)} className="text-xs font-medium text-muted hover:text-foreground">Remove</button> : null}
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" disabled={saving} onClick={() => setAddOpen(false)} className="focus-ring rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-medium text-foreground disabled:opacity-50">Cancel</button>
              <button type="button" disabled={saving} onClick={() => void createSupplier()} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add supplier
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Edit supplier */}
      {editOpen ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Edit supplier">
          <div className="absolute inset-0 bg-overlay/65 backdrop-blur-sm" onMouseDown={() => (editBusy ? null : setEditOpen(false))} aria-hidden />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl border border-line bg-surface p-5 shadow-panel sm:rounded-2xl">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">Edit supplier</h2>
              <button type="button" onClick={() => (editBusy ? null : setEditOpen(false))} className="rounded-md p-1 text-muted hover:text-foreground" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 grid gap-3">
              <div>
                <span className="mb-1 block text-xs font-medium text-muted">Supplier photo</span>
                <div className="flex items-center gap-3">
                  {editImage ? (
                    <img src={editImage} alt="" className="h-14 w-14 rounded-full border border-line object-cover" />
                  ) : (
                    <span className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-line bg-surface-2 text-[10px] text-muted">Photo</span>
                  )}
                  <label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-foreground hover:border-line-strong">
                    <ImagePlus className="h-4 w-4 text-muted" aria-hidden /> Upload photo
                    <input type="file" accept="image/*" className="sr-only" onChange={(e) => void onImage(e, setEditImage)} />
                  </label>
                  {editImage ? <button type="button" onClick={() => setEditImage(null)} className="text-xs font-medium text-muted hover:text-foreground">Remove</button> : null}
                </div>
              </div>
              <label className="text-sm"><span className="mb-1 block text-xs font-medium text-muted">Supplier name *</span>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground" />
              </label>
              <label className="text-sm"><span className="mb-1 block text-xs font-medium text-muted">Phone</span>
                <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground" />
              </label>
              <label className="text-sm"><span className="mb-1 block text-xs font-medium text-muted">Address</span>
                <input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground" />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" disabled={editBusy} onClick={() => setEditOpen(false)} className="focus-ring rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-medium text-foreground disabled:opacity-50">Cancel</button>
              <button type="button" disabled={editBusy} onClick={() => void saveSupplier()} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-60">
                {editBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save changes
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!delSupplier}
        onClose={() => (delBusy ? undefined : setDelSupplier(null))}
        onConfirm={() => void deleteSupplier()}
        title="Delete supplier?"
        description={delSupplier ? <span>{delSupplier.name} and all of its purchase and payment records will be deleted. Its products stay in inventory but are no longer linked to a supplier.</span> : null}
        confirmLabel="Delete"
        tone="danger"
        loading={delBusy}
      />

      <ConfirmDialog
        open={!!delEntry}
        onClose={() => (delBusy ? undefined : setDelEntry(null))}
        onConfirm={() => void deleteEntry()}
        title={delEntry?.type === "PURCHASE" ? "Delete purchase bill?" : "Delete payment?"}
        description={
          delEntry ? (
            delEntry.type === "PURCHASE" ? (
              <span>This purchase bill of {formatCurrency(delEntry.amountPkr)} will be deleted and the stock quantity will be reduced by {delEntry.quantity ?? 0}.</span>
            ) : (
              <span>This payment of {formatCurrency(delEntry.amountPkr)} will be deleted.</span>
            )
          ) : null
        }
        confirmLabel="Delete"
        tone="danger"
        loading={delBusy}
      />
    </div>
  );
}

function SupplierAvatar({ supplier, size }: { supplier: { name: string; imageUrl?: string | null }; size: number }) {
  const initials = supplier.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  if (supplier.imageUrl) {
    return <img src={supplier.imageUrl} alt={supplier.name} width={size} height={size} className="shrink-0 rounded-full border border-line object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 text-xs font-semibold text-muted"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {initials || "S"}
    </span>
  );
}
