"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Boxes,
  CheckCircle2,
  Hash,
  LayoutDashboard,
  Loader2,
  Minus,
  Moon,
  PackagePlus,
  Plus,
  Printer,
  ReceiptText,
  RefreshCw,
  ScanBarcode,
  Search,
  ShoppingCart,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { AddProductModal, type CreatedProduct } from "@/components/store/AddProductModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Business = { id: string; uid?: string | null; businessName: string; slug?: string | null; status: string; industryType?: string; location?: string | null; ownerName?: string | null; phone?: string | null; logoDataUrl?: string | null };
type SerialTag = { id: string; serialOrImei: string; isSold?: boolean; warrantyDays?: number };
type Product = {
  id: string; name: string; sku?: string | null; barcode?: string | null; category?: string | null; categoryId?: string | null;
  brand?: string | null; brandId?: string | null; imageUrl?: string | null;
  trackingType?: "QUANTITY_ONLY" | "SERIAL_OR_IMEI"; costPrice: number; sellingPrice: number;
  stockQuantity: number; minStockAlert: number; isActive?: boolean; serialItems?: SerialTag[];
  batchNumber?: string | null; expiryDate?: string | null; prescriptionRequired?: boolean;
  shadeCode?: string | null; paintBase?: string | null; packSize?: string | null;
  unitLabel?: string | null; installmentAvailable?: boolean; serviceItem?: boolean;
};
type ProductFeatureFlags = {
  serialEnabled: boolean; batchExpiry: boolean; prescription: boolean; paintShade: boolean;
  installments: boolean; serviceJobs: boolean; barcodeFast: boolean; multiUnit: boolean;
  supplierLedger: boolean; offlineSync: boolean; advancedAnalytics: boolean; multiUser: boolean;
  discounts: boolean; warranty: boolean;
};
const DEFAULT_FLAGS: ProductFeatureFlags = {
  serialEnabled: false, batchExpiry: false, prescription: false, paintShade: false,
  installments: false, serviceJobs: false, barcodeFast: false, multiUnit: false,
  supplierLedger: false, offlineSync: false, advancedAnalytics: false, multiUser: false,
  discounts: false, warranty: false,
};
// A cart line is either a bulk quantity line or a single serialized unit locked to a specific serial.
type CartLine = { product: Product; quantity: number; serialItemId?: string; serialOrImei?: string };
type InvoiceItem = { id: string; quantity: number; unitPrice: number; lineTotal: number; serialOrImei?: string | null; productName?: string | null; brandName?: string | null; imageUrl?: string | null; batchNumber?: string | null; expiryDate?: string | null; shadeCode?: string | null; unitLabel?: string | null; product?: { name: string; brand?: string | null; imageUrl?: string | null } };
type Invoice = { id: string; invoiceNumber: string; customerName?: string | null; subtotalPkr?: number; discountPkr?: number; totalAmount: number; downPaymentPkr?: number; duePkr?: number; paymentMethod: string; prescriptionNote?: string | null; clientRef?: string | null; createdAt: string; items: InvoiceItem[] };

type OfflineSale = {
  clientRef: string;
  payload: Record<string, unknown>;
  total: number;
  customerName: string;
  createdAt: string;
};

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function buildSalesSeries(invoices: Invoice[], startIso: string, endIso: string) {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T23:59:59.999`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [] as Array<{ date: string; label: string; revenue: number }>;
  const days = Math.min(366, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    buckets.set(isoDate(d), 0);
  }
  for (const inv of invoices) {
    const d = new Date(inv.createdAt);
    if (d < start || d > end) continue;
    const k = isoDate(d);
    if (buckets.has(k)) buckets.set(k, (buckets.get(k) || 0) + (Number(inv.totalAmount) || 0));
  }
  const points = Array.from(buckets.entries()).map(([date, revenue]) => {
    const d = new Date(`${date}T00:00:00`);
    return { date, label: d.toLocaleDateString("en-PK", { day: "2-digit", month: "short" }), revenue };
  });
  if (points.length <= 40) return points;
  const step = Math.ceil(points.length / 36);
  return points.filter((_, i) => i % step === 0 || i === points.length - 1);
}

function SalesChart({ series }: { series: Array<{ label: string; revenue: number }> }) {
  if (series.length === 0) return <p className="py-10 text-center text-sm text-muted">Select a valid date range to view analytics.</p>;
  const w = 820, h = 240, pad = { l: 54, r: 14, t: 16, b: 30 };
  const innerW = w - pad.l - pad.r, innerH = h - pad.t - pad.b;
  const values = series.map((s) => s.revenue);
  const rawMax = Math.max(...values, 1), rawMin = Math.min(...values, 0);
  const span = Math.max(1, rawMax - rawMin);
  const min = Math.max(0, Math.floor((rawMin - span * 0.12) / 100) * 100);
  const max = Math.ceil((rawMax + span * 0.12) / 100) * 100 || 100;
  const range = Math.max(1, max - min);
  const x = (i: number) => pad.l + (i / Math.max(1, series.length - 1)) * innerW;
  const y = (v: number) => pad.t + innerH - ((v - min) / range) * innerH;
  const line = series.map((s, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(s.revenue).toFixed(2)}`).join(" ");
  const area = `${line} L ${x(series.length - 1).toFixed(2)} ${(pad.t + innerH).toFixed(2)} L ${x(0).toFixed(2)} ${(pad.t + innerH).toFixed(2)} Z`;
  const labelStep = Math.max(1, Math.ceil(series.length / 8));
  const last = series[series.length - 1];
  const orange = "rgb(var(--accent))";
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-[240px] w-full min-w-[560px]" role="img" aria-label="Shop sales trend">
        <defs>
          <linearGradient id="shopRevFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={orange} stopOpacity="0.22" />
            <stop offset="100%" stopColor={orange} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {Array.from({ length: 5 }, (_, i) => {
          const t = i / 4; const gy = pad.t + innerH * t; const val = Math.round(max - range * t);
          return (
            <g key={i}>
              <line x1={pad.l} x2={w - pad.r} y1={gy} y2={gy} stroke="rgb(var(--line))" strokeWidth="1" opacity={i === 4 ? 0.9 : 0.5} />
              <text x={pad.l - 8} y={gy + 3.5} textAnchor="end" fontSize="9.5" fill="rgb(var(--muted))">{formatCurrency(val, true)}</text>
            </g>
          );
        })}
        <path d={area} fill="url(#shopRevFill)" />
        <path d={line} fill="none" stroke={orange} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        {series.map((s, i) =>
          i % labelStep === 0 || i === series.length - 1 ? (
            <text key={i} x={x(i)} y={h - 8} textAnchor="middle" fontSize="9.5" fill="rgb(var(--muted))">{s.label}</text>
          ) : null,
        )}
        {last ? (
          <g>
            <circle cx={x(series.length - 1)} cy={y(last.revenue)} r="3.5" fill={orange} />
            <rect x={w - pad.r - 72} y={y(last.revenue) - 10} width="72" height="20" rx="4" fill={orange} />
            <text x={w - pad.r - 36} y={y(last.revenue) + 3.5} textAnchor="middle" fontSize="10" fontWeight="700" fill="white">{formatCurrency(last.revenue, true)}</text>
          </g>
        ) : null}
      </svg>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted"><span className="inline-flex h-2.5 w-2.5 rounded-full bg-accent" aria-hidden /> Sales ($)</div>
    </div>
  );
}

const TABS = [
  { key: "pos", label: "POS / Sell", icon: ShoppingCart },
  { key: "inventory", label: "Inventory / Stock", icon: Boxes },
  { key: "sales", label: "Sales / Invoices", icon: ReceiptText },
  { key: "overview", label: "Overview", icon: LayoutDashboard },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/* ---------- Offline checkout queue (OFFLINE_SYNC feature) ---------- */
const offlineKey = (businessId: string) => `omnipos:offline:${businessId}`;

function readOfflineQueue(businessId: string): OfflineSale[] {
  try {
    const raw = window.localStorage.getItem(offlineKey(businessId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as OfflineSale[]) : [];
  } catch {
    return [];
  }
}

function writeOfflineQueue(businessId: string, list: OfflineSale[]) {
  try { window.localStorage.setItem(offlineKey(businessId), JSON.stringify(list)); } catch { /* storage unavailable */ }
}

function makeClientRef(): string {
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `offline-${rand}`;
}

export function StorePanel({ businessId, section }: { businessId: string; section?: TabKey }) {
  const [tab, setTab] = useState<TabKey>(section ?? "pos");
  const { theme, setTheme } = useTheme();
  const [business, setBusiness] = useState<Business | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [upgradeLocked, setUpgradeLocked] = useState(false);

  // Inventory: modal-driven add (hybrid tracking)
  const [addOpen, setAddOpen] = useState(false);

  // POS
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");
  const [discountInput, setDiscountInput] = useState("");
  const [downPaymentInput, setDownPaymentInput] = useState("");
  const [rxNote, setRxNote] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<Invoice | null>(null);
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  // Serial/IMEI selection when a SERIAL_OR_IMEI product is added to cart
  const [serialPick, setSerialPick] = useState<Product | null>(null);
  const [serialQuery, setSerialQuery] = useState("");
  // Feature access granted by the platform admin (Access page).
  const [features, setFeatures] = useState<ProductFeatureFlags>(DEFAULT_FLAGS);
  const serialEnabled = features.serialEnabled;
  const [pendingOffline, setPendingOffline] = useState(0);
  // Internal dialogs (no native confirm/prompt)
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [qtyPrompt, setQtyPrompt] = useState<Product | null>(null);
  const [qtyValue, setQtyValue] = useState("0");

  const flash = (tone: "ok" | "err", text: string, upgrade = false) => {
    if (upgrade) setUpgradeLocked(true);
    setNotice({ tone, text });
    setTimeout(() => setNotice(null), upgrade ? 7000 : 3500);
  };
  const apiMessage = (data: any, fallback: string) => {
    const upgrade = !!(data && (data.code === "UPGRADE_REQUIRED" || data.upgrade));
    const msg = (data && typeof data.message === "string" && data.message) || fallback;
    return { msg, upgrade };
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [bRes, pRes, iRes] = await Promise.all([
        fetch(`/api/businesses/${businessId}`, { cache: "no-store" }),
        fetch(`/api/businesses/${businessId}/products`, { cache: "no-store" }),
        fetch(`/api/businesses/${businessId}/invoices`, { cache: "no-store" }),
      ]);
      if (bRes.status === 404) { setError("Business not found in database. Create this business from the admin panel first."); setLoading(false); return; }
      if (bRes.status === 401) { setError("Unauthorized. Please sign in as Super Admin."); setLoading(false); return; }
      const bData = await bRes.json().catch(() => ({}));
      const pData = await pRes.json().catch(() => ({}));
      const iData = await iRes.json().catch(() => ({}));
      setBusiness(bData.business ?? null);
      setProducts(Array.isArray(pData.products) ? pData.products : []);
      setFeatures({ ...DEFAULT_FLAGS, ...(pData?.features ?? {}) });
      setInvoices(Array.isArray(iData.invoices) ? iData.invoices : []);
      setPendingOffline(readOfflineQueue(businessId).length);
      const biz = bData.business ?? null;
      const expiredDemo = !!biz && String(biz.accountType) === "DEMO" && biz.trialEndsAt && new Date(biz.trialEndsAt).getTime() <= Date.now();
      const lockedStatus = !!biz && (String(biz.status) === "DEACTIVE" || String(biz.status) === "TRIAL");
      const locked = expiredDemo || (lockedStatus && String(biz.status) === "DEACTIVE") || (!!biz && biz.subscriptionPaidUntil && new Date(biz.subscriptionPaidUntil).getTime() <= Date.now());
      if (locked) setUpgradeLocked(true);
    } catch {
      setError("Failed to load store data.");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { void loadAll(); }, [loadAll]);
  useEffect(() => { if (section) setTab(section); }, [section]);

  const filteredProducts = useMemo(() => {
    const t = q.trim().toLowerCase();
    const active = products.filter((p) => p.isActive !== false);
    if (!t) return active;
    return active.filter((p) => {
      const base = [p.name, p.sku, p.barcode, p.category, p.brand].some((v) => (v || "").toLowerCase().includes(t));
      if (base) return true;
      return (p.serialItems || []).some((s) => s.serialOrImei.toLowerCase().includes(t));
    });
  }, [products, q]);

  const cartTotal = cart.reduce((s, l) => s + l.product.sellingPrice * l.quantity, 0);
  const cartDiscount = features.discounts ? Math.min(Math.max(0, Number(discountInput) || 0), cartTotal) : 0;
  const cartGrand = Math.max(0, cartTotal - cartDiscount);
  const cartDownPayment = features.installments ? Math.min(Math.max(0, Number(downPaymentInput) || 0), cartGrand) : 0;
  const cartDue = Math.max(0, cartGrand - cartDownPayment);
  const cartHasRx = cart.some((l) => l.product.prescriptionRequired);

  const todayIso = useMemo(() => isoDate(new Date()), []);
  const [salesStart, setSalesStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 29); return isoDate(d);
  });
  const [salesEnd, setSalesEnd] = useState(() => isoDate(new Date()));
  const salesSeries = useMemo(() => buildSalesSeries(invoices, salesStart, salesEnd), [invoices, salesStart, salesEnd]);
  const salesRangeTotal = useMemo(() => salesSeries.reduce((s, p) => s + p.revenue, 0), [salesSeries]);
  const recentSold = useMemo(() => {
    const rows: Array<{ key: string; name: string; qty: number; amount: number; invoice: string; at: string }> = [];
    for (const inv of invoices) {
      for (const it of inv.items || []) {
        rows.push({ key: `${inv.id}-${it.id}`, name: it.product?.name || "Item", qty: it.quantity, amount: Number(it.lineTotal) || 0, invoice: inv.invoiceNumber, at: inv.createdAt });
      }
      if (rows.length >= 20) break;
    }
    return rows.slice(0, 20);
  }, [invoices]);

  const addToCart = (p: Product) => {
    const isService = Boolean(p.serviceItem);
    if (!isService && p.stockQuantity <= 0) { flash("err", `"${p.name}" is out of stock.`); return; }
    // SERIAL/IMEI tracked (and feature granted): require selecting a specific available serial tag
    if (serialEnabled && p.trackingType === "SERIAL_OR_IMEI") {
      const available = (p.serialItems || []).filter((s) => !s.isSold);
      if (available.length === 0) { flash("err", `No available Serial/IMEI for "${p.name}". Add serials in Inventory.`); return; }
      setSerialQuery("");
      setSerialPick(p);
      return;
    }
    // QUANTITY_ONLY: increment bulk quantity
    setCart((cur) => {
      const ex = cur.find((l) => l.product.id === p.id && !l.serialItemId);
      if (ex) {
        if (!isService && ex.quantity >= p.stockQuantity) { flash("err", "No more stock available for this item."); return cur; }
        return cur.map((l) => (l.product.id === p.id && !l.serialItemId ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...cur, { product: p, quantity: 1 }];
    });
  };

  /** BARCODE_FAST: scan an exact barcode and add the matching product to the cart. */
  const addByBarcode = (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    const match = products.find((p) => p.isActive !== false && (p.barcode ?? "").trim() === code);
    if (!match) { flash("err", `No product with barcode "${code}".`); return; }
    addToCart(match);
    setBarcodeInput("");
  };

  const addSerialToCart = (p: Product, serial: SerialTag) => {
    setCart((cur) => {
      if (cur.some((l) => l.serialItemId === serial.id)) { flash("err", "That Serial/IMEI is already in the cart."); return cur; }
      return [...cur, { product: p, quantity: 1, serialItemId: serial.id, serialOrImei: serial.serialOrImei }];
    });
    setSerialPick(null);
    setSerialQuery("");
  };

  const setCartQty = (key: string, qty: number) => {
    setCart((cur) => cur.flatMap((l) => {
      const lineKey = l.serialItemId || l.product.id;
      if (lineKey !== key) return [l];
      // Serialized lines are locked to 1 unit; qty change removes or keeps
      if (l.serialItemId) return qty <= 0 ? [] : [l];
      const cap = l.product.serviceItem ? Number.MAX_SAFE_INTEGER : l.product.stockQuantity;
      const n = Math.max(0, Math.min(qty, cap));
      return n === 0 ? [] : [{ ...l, quantity: n }];
    }));
  };

  const triggerPrint = (inv: Invoice) => {
    setPrintInvoice(inv);
    // Let the print DOM render, then open the browser print dialog (prints receipt only via @media print).
    setTimeout(() => {
      window.print();
    }, 200);
  };

  const applyLocalSaleToState = (items: CartLine[]) => {
    setProducts((cur) => cur.map((p) => {
      const lines = items.filter((l) => l.product.id === p.id);
      if (lines.length === 0) return p;
      if (p.serviceItem) return p;
      const bulkQty = lines.filter((l) => !l.serialItemId).reduce((s, l) => s + l.quantity, 0);
      const soldSerialIds = new Set(lines.filter((l) => l.serialItemId).map((l) => l.serialItemId as string));
      const remainingSerials = (p.serialItems || []).filter((s) => !soldSerialIds.has(s.id));
      const nextQty = Math.max(0, p.stockQuantity - bulkQty - soldSerialIds.size);
      return { ...p, stockQuantity: nextQty, serialItems: p.serialItems ? remainingSerials : undefined };
    }));
  };

  const checkout = async () => {
    if (cart.length === 0) return;
    if (features.prescription && cartHasRx && !rxNote.trim()) {
      flash("err", "Prescription product in cart: enter doctor / prescription details first.");
      return;
    }
    setCheckingOut(true);

    // Group serialized lines by product -> serialItemIds; keep bulk lines as quantity
    const serialGroups = new Map<string, string[]>();
    const bulk: Array<{ productId: string; quantity: number }> = [];
    for (const l of cart) {
      if (l.serialItemId) {
        const arr = serialGroups.get(l.product.id) ?? [];
        arr.push(l.serialItemId);
        serialGroups.set(l.product.id, arr);
      } else {
        bulk.push({ productId: l.product.id, quantity: l.quantity });
      }
    }
    const items = [
      ...bulk,
      ...Array.from(serialGroups.entries()).map(([productId, serialItemIds]) => ({ productId, serialItemIds })),
    ];
    const clientRef = makeClientRef();
    const payload = {
      items,
      paymentMethod: payMethod,
      customerName: customer,
      customerPhone,
      discountPkr: cartDiscount,
      downPaymentPkr: cartDownPayment,
      prescriptionNote: rxNote.trim() || null,
      clientRef,
    };

    let networkFailure = false;
    try {
      const res = await fetch(`/api/businesses/${businessId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { const m = apiMessage(data, "Checkout failed"); const err: any = new Error(m.msg); err.upgrade = m.upgrade; throw err; }
      const inv = data.invoice as Invoice;
      setLastInvoice(inv);
      setCart([]);
      setCustomer("");
      setCustomerPhone("");
      setDiscountInput("");
      setDownPaymentInput("");
      setRxNote("");
      flash("ok", data.duplicate ? `Sale already recorded: ${inv.invoiceNumber}` : `Sale complete: ${inv.invoiceNumber}`);
      triggerPrint(inv);
      await loadAll();
    } catch (e) {
      networkFailure = e instanceof TypeError || (e instanceof Error && /fetch|network|load failed/i.test(e.message));
      if (networkFailure && features.offlineSync) {
        // Save the sale locally and replay it automatically when the connection returns.
        const sale: OfflineSale = {
          clientRef,
          payload,
          total: cartGrand,
          customerName: customer || "Walk-in",
          createdAt: new Date().toISOString(),
        };
        const queue = [...readOfflineQueue(businessId), sale];
        writeOfflineQueue(businessId, queue);
        setPendingOffline(queue.length);
        const localInvoice: Invoice = {
          id: clientRef,
          invoiceNumber: `OFFLINE-${clientRef.slice(-6).toUpperCase()}`,
          customerName: sale.customerName,
          subtotalPkr: cartTotal,
          discountPkr: cartDiscount,
          totalAmount: cartGrand,
          downPaymentPkr: cartDownPayment,
          duePkr: cartDue,
          paymentMethod: payMethod,
          prescriptionNote: rxNote.trim() || null,
          clientRef,
          createdAt: sale.createdAt,
          items: cart.map((l) => ({
            id: `${clientRef}-${l.serialItemId || l.product.id}`,
            quantity: l.quantity,
            unitPrice: l.product.sellingPrice,
            lineTotal: l.product.sellingPrice * l.quantity,
            serialOrImei: l.serialOrImei ?? null,
            productName: l.product.name,
            brandName: l.product.brand ?? null,
            imageUrl: l.product.imageUrl ?? null,
            batchNumber: l.product.batchNumber ?? null,
            expiryDate: l.product.expiryDate ?? null,
            shadeCode: l.product.shadeCode ?? null,
            unitLabel: l.product.unitLabel ?? null,
          })),
        };
        applyLocalSaleToState(cart);
        setLastInvoice(localInvoice);
        setCart([]);
        setCustomer("");
        setCustomerPhone("");
        setDiscountInput("");
        setDownPaymentInput("");
        setRxNote("");
        flash("ok", `Saved offline (${queue.length} pending). It will sync automatically when online.`);
      } else {
        flash("err", e instanceof Error ? e.message : "Checkout failed", !!(e as any)?.upgrade);
      }
    } finally {
      setCheckingOut(false);
    }
  };

  /** Replay offline sales (idempotent via clientRef). */
  const flushOffline = useCallback(async () => {
    const queue = readOfflineQueue(businessId);
    if (queue.length === 0) { setPendingOffline(0); return; }
    const remaining: OfflineSale[] = [];
    let synced = 0;
    for (const sale of queue) {
      try {
        const res = await fetch(`/api/businesses/${businessId}/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sale.payload),
        });
        if (res.ok) { synced += 1; continue; }
        // Client errors are permanent (bad data / feature removed); keep only retryable failures.
        if (res.status >= 500) remaining.push(sale);
      } catch {
        remaining.push(sale);
      }
    }
    writeOfflineQueue(businessId, remaining);
    setPendingOffline(remaining.length);
    if (synced > 0) {
      setNotice({ tone: "ok", text: `${synced} offline sale(s) synced with the server.` });
      setTimeout(() => setNotice(null), 3500);
      await loadAll();
    }
  }, [businessId, loadAll]);

  useEffect(() => {
    if (!features.offlineSync) return;
    void flushOffline();
    const onOnline = () => { void flushOffline(); };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [features.offlineSync, flushOffline]);

  const adjustStock = async (p: Product, delta: number) => {
    try {
      const res = await fetch(`/api/businesses/${businessId}/products/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adjustStock: delta }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { const m = apiMessage(data, "Update failed"); const err: any = new Error(m.msg); err.upgrade = m.upgrade; throw err; }
      setProducts((cur) => cur.map((x) => (x.id === p.id ? (data.product as Product) : x)));
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "Stock update failed", !!(e as any)?.upgrade);
    }
  };

  const updateProductField = async (p: Product, patch: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/businesses/${businessId}/products/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Update failed");
      setProducts((cur) => cur.map((x) => (x.id === p.id ? (data.product as Product) : x)));
      flash("ok", "Product updated.");
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "Update failed", !!(e as any)?.upgrade);
    }
  };

  const doDeleteProduct = async (p: Product) => {
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/products/${p.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { const m = apiMessage(data, "Delete failed"); const err: any = new Error(m.msg); err.upgrade = m.upgrade; throw err; }
      setProducts((cur) => cur.filter((x) => x.id !== p.id));
      flash("ok", "Product deleted.");
      setConfirmDelete(null);
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "Delete failed", !!(e as any)?.upgrade);
    } finally {
      setDeleteBusy(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center text-sm text-muted"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading store panel…</div>;
  }
  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-line bg-surface p-6 text-center">
          <p className="text-sm font-semibold text-foreground">Store panel unavailable</p>
          <p className="mt-1 text-sm text-muted">{error}</p>
          <Link href="/login" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-fg"><ArrowLeft className="h-4 w-4" /> Back to login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={section ? "" : "min-h-dvh bg-background"}>
      {!section ? (<header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/tenants" className="focus-ring rounded-lg border border-line bg-surface-2 p-2 text-muted hover:text-foreground" aria-label="Back to businesses"><ArrowLeft className="h-4 w-4" /></Link>
            <div>
              <p className="text-xs font-medium text-muted">Store Management Panel</p>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">{business?.businessName || "Store"} <span className="ml-1 font-mono text-xs font-normal text-muted">{business?.uid || ""}</span></h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void loadAll()} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm font-medium text-foreground"><RefreshCw className="h-4 w-4" /> Refresh</button>
          </div>
        </div>
        <div className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} type="button" onClick={() => setTab(t.key)} className={cn("focus-ring inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors", active ? "bg-accent-soft text-accent border border-accent-line" : "text-muted hover:bg-surface-2 hover:text-foreground border border-transparent")}>
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </div>
      </header>) : null}

      {upgradeLocked ? (
        <div className="mx-auto mt-3 max-w-[1600px] px-4 sm:px-6">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            <p className="font-semibold">Upgrade to Pro</p>
            <p className="mt-0.5 text-xs sm:text-sm">Your 7-day free trial or subscription period has ended. Your data is preserved, but selling, adding stock, and other actions are paused until you upgrade.</p>
          </div>
        </div>
      ) : null}
      {notice ? (
        <div className={cn("mx-auto mt-3 max-w-[1600px] px-4 sm:px-6")}>
          <div className={cn("rounded-lg border px-3 py-2 text-sm", notice.tone === "ok" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300")}>{notice.text}</div>
        </div>
      ) : null}

      <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        {tab === "pos" ? (
          <div className="grid gap-4 lg:grid-cols-[1fr,380px]">
            <section className="rounded-xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-foreground">Products (select to sell)</h2>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  {features.barcodeFast ? (
                    <div className="relative w-full sm:w-64">
                      <ScanBarcode className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-accent" />
                      <input
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addByBarcode(barcodeInput); } }}
                        placeholder="Scan barcode + Enter"
                        className="focus-ring h-9 w-full rounded-lg border border-accent-line bg-accent-soft/40 pl-8 pr-3 text-sm text-foreground placeholder:text-muted"
                      />
                    </div>
                  ) : null}
                  <div className="relative w-full max-w-xs">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, category, brand, serial/IMEI…" className="focus-ring h-9 w-full rounded-lg border border-line bg-surface-2 pl-8 pr-3 text-sm text-foreground placeholder:text-muted" />
                  </div>
                </div>
              </div>
              {products.length === 0 ? (
                <p className="mt-6 text-sm text-muted">No products yet. Add stock in <button type="button" onClick={() => setTab("inventory")} className="font-medium text-accent underline">Inventory / Stock</button>.</p>
              ) : (
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredProducts.map((p) => {
                    const serialized = serialEnabled && p.trackingType === "SERIAL_OR_IMEI";
                    const isService = Boolean(p.serviceItem);
                    const available = serialized ? (p.serialItems || []).filter((s) => !s.isSold).length : isService ? Number.MAX_SAFE_INTEGER : p.stockQuantity;
                    const expired = features.batchExpiry && p.expiryDate ? new Date(p.expiryDate).getTime() < Date.now() : false;
                    return (
                      <button key={p.id} type="button" onClick={() => addToCart(p)} disabled={available <= 0 || expired} className="focus-ring rounded-lg border border-line bg-surface-2 p-3 text-left transition-colors hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-50">
                        <div className="flex items-start gap-2.5">
                          {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-md border border-line object-cover" /> : null}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                            <p className="mt-0.5 truncate text-xs text-muted">
                              {[p.brand, p.category].filter(Boolean).join(" · ") || "—"} · {isService ? <span className="text-accent">Service</span> : serialized ? <span className="text-accent">Serial/IMEI ({available})</span> : <>Stock {p.stockQuantity}{p.unitLabel ? ` ${p.unitLabel}` : ""}</>}
                            </p>
                            {features.paintShade && p.shadeCode ? <p className="mt-0.5 text-[11px] text-muted">Shade {p.shadeCode}{p.packSize ? ` · ${p.packSize}` : ""}</p> : null}
                            {expired ? <p className="mt-0.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">Expired — cannot sell</p> : null}
                          </div>
                        </div>
                        <p className="mt-2 text-sm font-semibold tabular-nums text-accent">{formatCurrency(p.sellingPrice)}{p.unitLabel ? <span className="text-[11px] font-normal text-muted"> / {p.unitLabel}</span> : null}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <aside className="rounded-xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-foreground">Cart / Checkout</h2>
                {features.offlineSync ? (
                  <span className={cn("rounded-md border px-2 py-0.5 text-[11px] font-medium", pendingOffline > 0 ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300")}>
                    {pendingOffline > 0 ? `${pendingOffline} offline sale(s) pending` : "Offline sync ready"}
                  </span>
                ) : null}
              </div>
              {cart.length === 0 ? (
                <p className="mt-4 text-sm text-muted">Select products to add them to cart.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {cart.map((l) => {
                    const lineKey = l.serialItemId || l.product.id;
                    return (
                      <div key={lineKey} className="rounded-lg border border-line bg-surface-2 p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{l.product.name}</p>
                            {l.serialOrImei ? (
                              <p className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-accent"><Hash className="h-3 w-3" /> {l.serialOrImei}</p>
                            ) : (
                              <p className="text-xs tabular-nums text-muted">{formatCurrency(l.product.sellingPrice)} each{l.product.unitLabel ? ` / ${l.product.unitLabel}` : ""}</p>
                            )}
                            {features.batchExpiry && l.product.batchNumber ? <p className="mt-0.5 text-[11px] text-muted">Batch {l.product.batchNumber}{l.product.expiryDate ? ` · exp ${new Date(l.product.expiryDate).toLocaleDateString("en-PK")}` : ""}</p> : null}
                            {features.paintShade && l.product.shadeCode ? <p className="mt-0.5 text-[11px] text-muted">Shade {l.product.shadeCode}</p> : null}
                          </div>
                          <button type="button" onClick={() => setCartQty(lineKey, 0)} className="rounded p-1 text-muted hover:text-rose-500" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          {l.serialItemId ? (
                            <span className="rounded-md border border-accent-line bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">Serial locked (1)</span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => setCartQty(lineKey, l.quantity - 1)} className="rounded border border-line bg-surface p-1 text-foreground"><Minus className="h-3.5 w-3.5" /></button>
                              <span className="w-8 text-center text-sm font-semibold tabular-nums text-foreground">{l.quantity}</span>
                              <button type="button" onClick={() => setCartQty(lineKey, l.quantity + 1)} className="rounded border border-line bg-surface p-1 text-foreground"><Plus className="h-3.5 w-3.5" /></button>
                            </div>
                          )}
                          <span className="text-sm font-semibold tabular-nums text-foreground">{formatCurrency(l.product.sellingPrice * l.quantity)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mt-4 space-y-2 border-t border-line pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Customer name" className="focus-ring h-9 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground placeholder:text-muted" />
                  <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone (optional)" className="focus-ring h-9 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground placeholder:text-muted" />
                </div>
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="focus-ring h-9 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground">
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="BANK">Bank transfer</option>
                  <option value="OTHER">Other</option>
                </select>
                {features.discounts ? (
                  <label className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm">
                    <span className="text-muted">Discount</span>
                    <input type="number" min="0" step="0.01" value={discountInput} onChange={(e) => setDiscountInput(e.target.value)} placeholder="0" className="focus-ring h-7 w-28 rounded-md border border-line bg-surface px-2 text-right text-sm tabular-nums text-foreground" />
                  </label>
                ) : null}
                {features.installments ? (
                  <label className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm">
                    <span className="text-muted">Down payment</span>
                    <input type="number" min="0" step="0.01" value={downPaymentInput} onChange={(e) => setDownPaymentInput(e.target.value)} placeholder="0" className="focus-ring h-7 w-28 rounded-md border border-line bg-surface px-2 text-right text-sm tabular-nums text-foreground" />
                  </label>
                ) : null}
                {features.prescription && cartHasRx ? (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.07] p-2">
                    <label className="mb-1 block text-[11px] font-semibold text-amber-800 dark:text-amber-300">Prescription details (required for Rx items)</label>
                    <textarea value={rxNote} onChange={(e) => setRxNote(e.target.value)} rows={2} placeholder="Doctor name / Rx number / note" className="focus-ring w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-foreground placeholder:text-muted" />
                  </div>
                ) : null}
                <div className="space-y-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
                  {cartDiscount > 0 || cartDownPayment > 0 ? (
                    <div className="flex items-center justify-between text-muted"><span>Subtotal</span><span className="tabular-nums">{formatCurrency(cartTotal)}</span></div>
                  ) : null}
                  {cartDiscount > 0 ? (
                    <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300"><span>Discount</span><span className="tabular-nums">− {formatCurrency(cartDiscount)}</span></div>
                  ) : null}
                  <div className="flex items-center justify-between">
                    <span className="text-muted">{cartDownPayment > 0 ? "Total" : "Grand total"}</span>
                    <span className="text-lg font-semibold tabular-nums text-foreground">{formatCurrency(cartGrand)}</span>
                  </div>
                  {cartDownPayment > 0 ? (
                    <>
                      <div className="flex items-center justify-between text-muted"><span>Down payment</span><span className="tabular-nums">{formatCurrency(cartDownPayment)}</span></div>
                      <div className="flex items-center justify-between font-semibold text-amber-700 dark:text-amber-300"><span>Balance due</span><span className="tabular-nums">{formatCurrency(cartDue)}</span></div>
                    </>
                  ) : null}
                </div>
                <button type="button" onClick={() => void checkout()} disabled={cart.length === 0 || checkingOut} className="focus-ring flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg disabled:opacity-50">
                  {checkingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Checkout &amp; deduct stock
                </button>
                {features.offlineSync ? <p className="text-center text-[11px] text-muted">Internet drop ho to sale offline save hogi aur khud sync ho jayegi.</p> : null}
              </div>
              {lastInvoice ? (
                <div className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">Last sale: {lastInvoice.invoiceNumber}</p>
                      <p className="text-muted">{formatCurrency(lastInvoice.totalAmount)} · stock deducted</p>
                      {(lastInvoice.downPaymentPkr ?? 0) > 0 ? <p className="text-xs text-amber-700 dark:text-amber-300">Down {formatCurrency(lastInvoice.downPaymentPkr || 0)} · Due {formatCurrency(lastInvoice.duePkr || 0)}</p> : null}
                    </div>
                    <button type="button" onClick={() => triggerPrint(lastInvoice)} className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-foreground hover:border-accent/40">
                      <Printer className="h-3.5 w-3.5" /> Print receipt
                    </button>
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-muted">
                    {lastInvoice.items.map((it) => {
                      const pname = it.productName || it.product?.name || "Item";
                      const bname = it.brandName || it.product?.brand || "";
                      return (
                        <li key={it.id}>
                          {bname ? `${bname} — ` : ""}{pname} ×{it.quantity} · {formatCurrency(it.lineTotal)}
                          {it.serialOrImei ? <span className="ml-1 font-mono text-accent">[S/N: {it.serialOrImei}]</span> : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </aside>
          </div>
        ) : null}

        {tab === "inventory" ? (
          <div className="space-y-4">
            <section className="rounded-xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><PackagePlus className="h-4 w-4 text-accent" /> Add product / stock</h2>
                  <p className="mt-0.5 text-sm text-muted">{serialEnabled ? "Hybrid inventory: bulk quantity items or Serial/IMEI-tracked items (warranty/anti-theft)." : "Bulk quantity inventory. IMEI/Serial tracking can be enabled by the platform admin."}</p>
                </div>
                <button type="button" onClick={() => setAddOpen(true)} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg">
                  <Plus className="h-4 w-4" /> Add product
                </button>
              </div>
            </section>

            {features.batchExpiry ? (() => {
              const now = Date.now();
              const soonLimit = now + 30 * 86400000;
              const soon = products.filter((p) => p.expiryDate && new Date(p.expiryDate).getTime() <= soonLimit);
              if (soon.length === 0) return null;
              return (
                <section className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-4">
                  <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-300">Expiry alert ({soon.length})</h2>
                  <ul className="mt-2 grid gap-1 text-xs text-amber-900/90 dark:text-amber-200/90 sm:grid-cols-2">
                    {soon.slice(0, 8).map((p) => {
                      const expired = new Date(p.expiryDate as string).getTime() < now;
                      return <li key={p.id}>{p.name} — <b>{expired ? "EXPIRED" : "expiring"}</b> {new Date(p.expiryDate as string).toLocaleDateString("en-PK")}{p.batchNumber ? ` (batch ${p.batchNumber})` : ""}</li>;
                    })}
                  </ul>
                </section>
              );
            })() : null}

            <section className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className="border-b border-line px-4 py-3">
                <h2 className="text-base font-semibold text-foreground">Products &amp; stock</h2>
                <p className="text-sm text-muted">Bulk items use quantity. Serial/IMEI items are tracked per unit (add serials to increase stock).</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead><tr className="border-b border-line bg-surface-2 text-xs font-semibold uppercase tracking-[0.04em] text-muted">
                    <th className="px-4 py-2.5">Product</th><th className="px-3 py-2.5">Tracking</th><th className="px-3 py-2.5 text-right">Price</th><th className="px-3 py-2.5 text-right">Stock</th><th className="px-4 py-2.5 text-right">Manage</th>
                  </tr></thead>
                  <tbody>
                    {products.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted">No products yet. Click &quot;Add product&quot; above.</td></tr>
                    ) : products.map((p) => {
                      const serialized = serialEnabled && p.trackingType === "SERIAL_OR_IMEI";
                      const soldOut = p.stockQuantity <= 0;
                      const inactive = p.isActive === false;
                      return (
                        <tr key={p.id} className={cn("border-b border-line last:border-b-0", inactive && "opacity-60")}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-md border border-line object-cover" /> : null}
                              <div className="min-w-0">
                                <p className="font-medium text-foreground">
                                  {p.name}
                                  {serialized && soldOut ? <span className="ml-2 rounded bg-rose-500/10 px-1.5 py-0.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">Sold out</span> : null}
                                  {!serialized && soldOut ? <span className="ml-2 rounded bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">Out of stock</span> : null}
                                  {inactive ? <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted">Off</span> : null}
                                </p>
                                <p className="text-xs text-muted">{[p.brand, p.category].filter(Boolean).join(" · ") || p.sku || "—"}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-1">
                                  {p.serviceItem ? <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">SERVICE</span> : null}
                                  {features.batchExpiry && p.batchNumber ? <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">Batch {p.batchNumber}</span> : null}
                                  {features.batchExpiry && p.expiryDate ? (
                                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", new Date(p.expiryDate).getTime() < Date.now() ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-300")}>
                                      Exp {new Date(p.expiryDate).toLocaleDateString("en-PK")}
                                    </span>
                                  ) : null}
                                  {features.paintShade && p.shadeCode ? <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">Shade {p.shadeCode}{p.packSize ? ` · ${p.packSize}` : ""}</span> : null}
                                  {features.multiUnit && p.unitLabel ? <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">per {p.unitLabel}</span> : null}
                                  {features.prescription && p.prescriptionRequired ? <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">Rx</span> : null}
                                  {features.installments && p.installmentAvailable ? <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">Installments</span> : null}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            {p.serviceItem ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-accent-line bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">Service</span>
                            ) : serialized ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-accent-line bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent"><Hash className="h-3 w-3" /> Serial/IMEI</span>
                            ) : (
                              <span className="rounded-md border border-line bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">Quantity</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <input
                              type="number" min="0" step="0.01" defaultValue={p.sellingPrice}
                              onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v !== p.sellingPrice) void updateProductField(p, { sellingPrice: v }); }}
                              className="focus-ring h-8 w-28 rounded-md border border-line bg-surface-2 px-2 text-right text-sm tabular-nums text-foreground"
                            />
                          </td>
                          <td className={cn("px-3 py-3 text-right font-semibold tabular-nums", p.serviceItem ? "text-muted" : soldOut ? "text-rose-600 dark:text-rose-400" : p.stockQuantity <= p.minStockAlert ? "text-amber-700 dark:text-amber-300" : "text-foreground")}>
                            {p.serviceItem ? "—" : serialized && soldOut ? "Sold out" : p.stockQuantity}
                            {p.serviceItem ? <span className="block text-[11px] font-normal text-muted">no stock</span> : serialized && !soldOut ? <span className="block text-[11px] font-normal text-muted">available</span> : p.unitLabel ? <span className="block text-[11px] font-normal text-muted">{p.unitLabel}</span> : null}
                          </td>
                          <td className="px-4 py-3">
                            {serialized ? (
                              <div className="text-xs">
                                <p className="font-medium text-muted">Serial ya IMEI</p>
                                {soldOut ? (
                                  <p className="mt-1 font-medium text-rose-600 dark:text-rose-400">Sold out</p>
                                ) : (p.serialItems || []).length > 0 ? (
                                  <ul className="mt-1 space-y-0.5">
                                    {(p.serialItems || []).map((s) => (
                                      <li key={s.id} className="font-mono text-foreground">{s.serialOrImei}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="mt-1 text-muted">—</p>
                                )}
                                <div className="mt-2 flex justify-end">
                                  <button type="button" onClick={() => setConfirmDelete(p)} className="focus-ring rounded-md border border-line bg-surface-2 px-2 py-1 text-[11px] font-medium text-muted hover:border-rose-400/40 hover:text-rose-600">Delete</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                <button type="button" onClick={() => void adjustStock(p, -1)} className="focus-ring rounded-md border border-line bg-surface-2 p-1.5 text-foreground hover:border-rose-400/40" aria-label="Deduct 1"><Minus className="h-3.5 w-3.5" /></button>
                                <button type="button" onClick={() => void adjustStock(p, +1)} className="focus-ring rounded-md border border-line bg-surface-2 p-1.5 text-foreground hover:border-emerald-400/40" aria-label="Add 1"><Plus className="h-3.5 w-3.5" /></button>
                                <button type="button" onClick={() => { setQtyValue("0"); setQtyPrompt(p); }} className="focus-ring rounded-md border border-accent-line bg-accent-soft px-2 py-1 text-xs font-medium text-accent">Add qty</button>
                                <button type="button" onClick={() => void updateProductField(p, { isActive: inactive ? true : false })} className={cn("focus-ring rounded-md border px-2 py-1 text-xs font-medium", inactive ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-line bg-surface-2 text-foreground")}>{inactive ? "On" : "Off"}</button>
                                <button type="button" onClick={() => setConfirmDelete(p)} className="focus-ring rounded-md border border-line bg-surface-2 px-2 py-1 text-xs font-medium text-muted hover:border-rose-400/40 hover:text-rose-600">Delete</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : null}

        {tab === "sales" ? (
          <section className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="border-b border-line px-4 py-3">
              <h2 className="text-base font-semibold text-foreground">Sales / Invoices</h2>
              <p className="text-sm text-muted">Completed checkouts (stock deducted on sale).</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead><tr className="border-b border-line bg-surface-2 text-xs font-semibold uppercase tracking-[0.04em] text-muted">
                  <th className="px-4 py-2.5">Invoice</th><th className="px-3 py-2.5">Customer</th><th className="px-3 py-2.5">Payment</th><th className="px-3 py-2.5">Items</th><th className="px-4 py-2.5 text-right">Total</th>
                </tr></thead>
                <tbody>
                  {invoices.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted">No sales yet. Complete a checkout in POS / Sell.</td></tr>
                  ) : invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-line last:border-b-0">
                      <td className="px-4 py-3"><p className="font-mono text-xs font-medium text-foreground">{inv.invoiceNumber}</p><p className="text-xs text-muted">{new Date(inv.createdAt).toLocaleString("en-PK")}</p></td>
                      <td className="px-3 py-3 text-foreground">{inv.customerName || "—"}</td>
                      <td className="px-3 py-3 text-muted">{inv.paymentMethod}</td>
                      <td className="px-3 py-3 text-muted">{inv.items.map((it) => `${it.product?.name || "Item"} x${it.quantity}${it.serialOrImei ? ` [${it.serialOrImei}]` : ""}`).join(", ")}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                        {formatCurrency(inv.totalAmount)}
                        {(inv.duePkr ?? 0) > 0 ? <span className="block text-[11px] font-medium text-amber-700 dark:text-amber-300">Due {formatCurrency(inv.duePkr || 0)}</span> : null}
                        {(inv.discountPkr ?? 0) > 0 ? <span className="block text-[11px] font-normal text-emerald-700 dark:text-emerald-300">Disc {formatCurrency(inv.discountPkr || 0)}</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {tab === "overview" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-end">
              <div className="flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5" role="group" aria-label="Color theme">
                {([
                  { key: "light" as const, label: "Light", Icon: Sun },
                  { key: "dark" as const, label: "Dark", Icon: Moon },
                ] as const).map(({ key, label, Icon }) => {
                  const active = theme === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTheme(key)}
                      aria-pressed={active}
                      className={cn(
                        "focus-ring flex h-8 items-center justify-center gap-1.5 rounded-md px-2.5 transition-colors",
                        active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-foreground",
                      )}
                      title={label}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                      <span className="text-xs font-medium">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Products", String(products.length), "in catalog"],
                ["Total stock units", String(products.reduce((s, p) => s + p.stockQuantity, 0)), "across products"],
                ["Sales (invoices)", String(invoices.length), "recorded"],
                ["Sales total", formatCurrency(invoices.reduce((s, i) => s + i.totalAmount, 0)), "USD"],
              ].map(([label, value, hint]) => (
                <div key={label} className="rounded-xl border border-line bg-surface p-4">
                  <p className="text-xs font-medium text-muted">{label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
                  <p className="mt-0.5 text-xs text-muted">{hint}</p>
                </div>
              ))}
            </div>

            {features.advancedAnalytics ? (
              <section aria-label="Analytics" className="rounded-xl border border-line bg-surface p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Analytics</h2>
                    <p className="mt-0.5 text-sm text-muted">This shop&apos;s sales trend. Select a date range.</p>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="text-xs font-medium text-muted">
                      <span className="mb-1 block">From</span>
                      <input type="date" value={salesStart} max={salesEnd} onChange={(e) => setSalesStart(e.target.value)} className="focus-ring h-9 rounded-lg border border-line bg-surface-2 px-2.5 text-sm text-foreground" />
                    </label>
                    <label className="text-xs font-medium text-muted">
                      <span className="mb-1 block">To</span>
                      <input type="date" value={salesEnd} min={salesStart} max={todayIso} onChange={(e) => setSalesEnd(e.target.value)} className="focus-ring h-9 rounded-lg border border-line bg-surface-2 px-2.5 text-sm text-foreground" />
                    </label>
                    <div className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs">
                      <span className="text-muted">Range total: </span>
                      <span className="font-semibold tabular-nums text-foreground">{formatCurrency(salesRangeTotal)}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-5">
                  <SalesChart series={salesSeries} />
                </div>
              </section>
            ) : (
              <section aria-label="Analytics locked" className="rounded-xl border border-line bg-surface p-5">
                <h2 className="text-base font-semibold text-foreground">Analytics</h2>
                <p className="mt-1 text-sm text-muted">Advanced analytics (profit, trends, best sellers) is not enabled for this business. Contact the platform admin to enable <b>Advanced analytics</b> from Access.</p>
              </section>
            )}

            <section className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className="border-b border-line px-4 py-3">
                <h2 className="text-base font-semibold text-foreground">Recently sold products</h2>
                <p className="text-sm text-muted">Latest items sold from this shop (from recent invoices).</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead><tr className="border-b border-line bg-surface-2 text-xs font-semibold uppercase tracking-[0.04em] text-muted">
                    <th className="px-4 py-2.5">Product</th><th className="px-3 py-2.5 text-right">Qty</th><th className="px-3 py-2.5 text-right">Amount</th><th className="px-3 py-2.5">Invoice</th><th className="px-4 py-2.5">Date &amp; time</th>
                  </tr></thead>
                  <tbody>
                    {recentSold.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted">No sales yet. Sold products will appear here after checkout.</td></tr>
                    ) : recentSold.map((r) => (
                      <tr key={r.key} className="border-b border-line last:border-b-0">
                        <td className="px-4 py-3 font-medium text-foreground">{r.name}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-foreground">{r.qty}</td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums text-foreground">{formatCurrency(r.amount)}</td>
                        <td className="px-3 py-3 font-mono text-xs text-muted">{r.invoice}</td>
                        <td className="px-4 py-3 text-xs text-muted">{new Date(r.at).toLocaleString("en-PK")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="rounded-xl border border-accent-line bg-accent-soft p-4">
              <p className="text-sm font-semibold text-foreground">Store management</p>
              <p className="mt-1 text-sm text-muted">Use <b>Inventory / Stock</b> to add products, update prices, and adjust/deduct stock (bulk quantity or Serial/IMEI). Use <b>POS / Sell</b> to select products and checkout — serial-tracked items require selecting/scanning the specific Serial/IMEI; stock is deducted automatically on sale.</p>
            </div>
          </div>
        ) : null}
      </main>

      {/* Hybrid inventory: add product modal (Mobile Accessories & general) */}
      <AddProductModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        businessId={businessId}
        features={features}
        onCreated={(p) => {
          setProducts((cur) => [p as Product, ...cur]);
          flash("ok", `Product added${p.trackingType === "SERIAL_OR_IMEI" ? ` (${p.stockQuantity} serials)` : ""}.`);
        }}
      />

      {/* POS: select/scan Serial or IMEI for a serialized product */}
      {serialPick ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Select Serial or IMEI">
          <div className="absolute inset-0 bg-overlay/65 backdrop-blur-sm" onMouseDown={() => setSerialPick(null)} aria-hidden />
          <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-hidden rounded-t-2xl border border-line bg-surface shadow-panel sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Select Serial / IMEI</p>
                <p className="truncate text-xs text-muted">{serialPick.name} · {formatCurrency(serialPick.sellingPrice)}</p>
              </div>
              <button type="button" onClick={() => setSerialPick(null)} className="focus-ring rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-3">
              <div className="relative">
                <ScanBarcode className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  autoFocus
                  value={serialQuery}
                  onChange={(e) => setSerialQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const t = serialQuery.trim().toLowerCase();
                      const pool = (serialPick.serialItems || []).filter((s) => !s.isSold && !cart.some((l) => l.serialItemId === s.id));
                      const exact = pool.find((s) => s.serialOrImei.toLowerCase() === t);
                      const match = exact || (pool.filter((s) => s.serialOrImei.toLowerCase().includes(t)).length === 1 ? pool.find((s) => s.serialOrImei.toLowerCase().includes(t)) : null);
                      if (match) addSerialToCart(serialPick, match);
                    }
                  }}
                  placeholder="Scan or type to find Serial/IMEI (Enter to select exact match)"
                  className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 pl-8 pr-3 text-sm text-foreground placeholder:text-muted"
                />
              </div>
            </div>
            <ul className="max-h-[50vh] overflow-y-auto border-t border-line">
              {(() => {
                const t = serialQuery.trim().toLowerCase();
                const pool = (serialPick.serialItems || [])
                  .filter((s) => !s.isSold && !cart.some((l) => l.serialItemId === s.id))
                  .filter((s) => !t || s.serialOrImei.toLowerCase().includes(t));
                if (pool.length === 0) return <li className="px-4 py-8 text-center text-sm text-muted">No available Serial/IMEI matches.</li>;
                return pool.map((s) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => addSerialToCart(serialPick, s)} className="focus-ring flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-surface-2">
                      <span className="font-mono text-sm font-medium text-foreground">{s.serialOrImei}</span>
                      <span className="text-xs text-muted">Warranty {s.warrantyDays || 0}d</span>
                    </button>
                  </li>
                ));
              })()}
            </ul>
            <div className="border-t border-line px-4 py-2 text-xs text-muted">Select the specific unit being sold (anti-theft &amp; warranty tracking).</div>
          </div>
        </div>
      ) : null}

      {/* Internal confirm (no native browser dialog) */}
      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => (deleteBusy ? undefined : setConfirmDelete(null))}
        onConfirm={() => (confirmDelete ? void doDeleteProduct(confirmDelete) : undefined)}
        title="Delete product?"
        description={confirmDelete ? <span>“{confirmDelete.name}” delete ho jayega. Out of stock ya sales history wali product bhi delete ho sakti hai (record history ke liye safe rahega).</span> : null}
        confirmLabel="Delete"
        tone="danger"
        loading={deleteBusy}
      />

      {/* Internal qty prompt (no native prompt) */}
      {qtyPrompt ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Add stock quantity">
          <div className="absolute inset-0 bg-overlay/65 backdrop-blur-sm" onMouseDown={() => setQtyPrompt(null)} aria-hidden />
          <div className="relative z-10 w-full max-w-sm rounded-t-2xl border border-line bg-surface p-5 shadow-panel sm:rounded-2xl">
            <h3 className="text-base font-semibold text-foreground">Add stock quantity</h3>
            <p className="mt-0.5 text-sm text-muted">{qtyPrompt.name}</p>
            <input
              autoFocus
              type="number"
              step="1"
              value={qtyValue}
              onChange={(e) => setQtyValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const n = Math.floor(Number(qtyValue));
                  if (Number.isFinite(n) && n !== 0) void adjustStock(qtyPrompt, n);
                  setQtyPrompt(null);
                }
                if (e.key === "Escape") setQtyPrompt(null);
              }}
              className="focus-ring mt-3 h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground"
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setQtyPrompt(null)} className="focus-ring rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-medium text-foreground hover:border-line-strong">Cancel</button>
              <button type="button" onClick={() => { const n = Math.floor(Number(qtyValue)); if (Number.isFinite(n) && n !== 0) void adjustStock(qtyPrompt, n); setQtyPrompt(null); }} className="focus-ring rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg">Add</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Print-only receipt (black & white). Shown only during printing. */}
      {printInvoice ? (
        <div id="invoice-print-area" aria-hidden className="hidden">
          <div style={{ width: "100%", maxWidth: 380, margin: "0 auto", padding: "12px 10px", fontFamily: "Arial, Helvetica, sans-serif", color: "#000", background: "#fff", fontSize: 12, lineHeight: 1.35 }}>
            <div style={{ textAlign: "center", borderBottom: "1px dashed #000", paddingBottom: 8, marginBottom: 8 }}>
              {business?.logoDataUrl ? (
                <img src={business.logoDataUrl} alt="" style={{ height: 48, width: 48, objectFit: "contain", margin: "0 auto 4px", display: "block", filter: "grayscale(100%) contrast(1.15)" }} />
              ) : null}
              <div style={{ fontSize: 15, fontWeight: 700 }}>{business?.businessName || "Shop"}</div>
              {business?.location ? <div style={{ fontSize: 10 }}>{business.location}</div> : null}
              {business?.ownerName || (business as any)?.phone ? <div style={{ fontSize: 10 }}>{[business?.ownerName, (business as any)?.phone].filter(Boolean).join(" · ")}</div> : null}
            </div>
            <div style={{ fontSize: 11, marginBottom: 6 }}>
              <div><b>Invoice:</b> {printInvoice.invoiceNumber}</div>
              <div><b>Date:</b> {new Date(printInvoice.createdAt).toLocaleString("en-PK")}</div>
              {printInvoice.customerName ? <div><b>Customer:</b> {printInvoice.customerName}</div> : null}
              <div><b>Payment:</b> {printInvoice.paymentMethod}</div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #000", padding: "3px 0" }}>Item</th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #000", padding: "3px 0", whiteSpace: "nowrap" }}>Qty</th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #000", padding: "3px 0", whiteSpace: "nowrap" }}>Price</th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #000", padding: "3px 0", whiteSpace: "nowrap" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {printInvoice.items.map((it) => {
                  const pname = it.productName || it.product?.name || "Item";
                  const bname = it.brandName || it.product?.brand || "";
                  const img = it.imageUrl || it.product?.imageUrl || null;
                  return (
                    <tr key={it.id}>
                      <td style={{ padding: "4px 0", verticalAlign: "top", borderBottom: "1px dotted #888" }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                          {img ? <img src={img} alt="" style={{ width: 28, height: 28, objectFit: "cover", border: "1px solid #000", flexShrink: 0, filter: "grayscale(100%) contrast(1.15)" }} /> : null}
                          <div>
                            {bname ? <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>{bname}</div> : null}
                            <div style={{ fontWeight: 600 }}>{pname}</div>
                            {it.serialOrImei ? <div style={{ fontSize: 9 }}>S/N / IMEI: {it.serialOrImei}</div> : null}
                            {it.shadeCode ? <div style={{ fontSize: 9 }}>Shade: {it.shadeCode}</div> : null}
                            {it.batchNumber ? <div style={{ fontSize: 9 }}>Batch: {it.batchNumber}{it.expiryDate ? ` · Exp ${new Date(it.expiryDate).toLocaleDateString("en-PK")}` : ""}</div> : null}
                            {it.unitLabel && it.unitLabel !== "piece" ? <div style={{ fontSize: 9 }}>{it.quantity} × {it.unitLabel}</div> : null}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "4px 0", textAlign: "right", verticalAlign: "top", borderBottom: "1px dotted #888" }}>{it.quantity}</td>
                      <td style={{ padding: "4px 0", textAlign: "right", verticalAlign: "top", borderBottom: "1px dotted #888", whiteSpace: "nowrap" }}>{formatCurrency(it.unitPrice, true)}</td>
                      <td style={{ padding: "4px 0", textAlign: "right", verticalAlign: "top", borderBottom: "1px dotted #888", whiteSpace: "nowrap" }}>{formatCurrency(it.lineTotal, true)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ borderTop: "1px solid #000", marginTop: 6, paddingTop: 6, fontSize: 11 }}>
              {(printInvoice.discountPkr ?? 0) > 0 ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal</span><span>{formatCurrency(printInvoice.subtotalPkr ?? printInvoice.totalAmount)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Discount</span><span>- {formatCurrency(printInvoice.discountPkr || 0)}</span></div>
                </>
              ) : null}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, marginTop: 2 }}>
                <span>Grand Total</span>
                <span>{formatCurrency(printInvoice.totalAmount)}</span>
              </div>
              {(printInvoice.downPaymentPkr ?? 0) > 0 ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}><span>Down payment</span><span>{formatCurrency(printInvoice.downPaymentPkr || 0)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}><span>Balance due</span><span>{formatCurrency(printInvoice.duePkr || 0)}</span></div>
                </>
              ) : null}
              {printInvoice.prescriptionNote ? <div style={{ marginTop: 4, fontSize: 9 }}>Rx: {printInvoice.prescriptionNote}</div> : null}
            </div>
            <div style={{ textAlign: "center", marginTop: 10, fontSize: 10, borderTop: "1px dashed #000", paddingTop: 6 }}>Thank you for your purchase</div>
          </div>
        </div>
      ) : null}
      <style>{`@media print { body * { visibility: hidden !important; } #invoice-print-area, #invoice-print-area * { visibility: visible !important; } #invoice-print-area { display: block !important; position: absolute; inset: 0; width: 100%; background: #fff; } }`}</style>
    </div>
  );
}
