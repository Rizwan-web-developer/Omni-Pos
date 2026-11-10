"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Barcode,
  CheckCircle2,
  CreditCard,
  Package,
  PauseCircle,
  ReceiptText,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Store,
  Trash2,
  Wifi,
  X } from "lucide-react";

import { DialogShell } from "@/components/ui/DialogShell";
import { useToast } from "@/components/providers/ToastProvider";
import { cn, formatImei, formatMoney, isPlausibleSerial, isValidImei } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  DEMO CATALOGUE                                                            */
/* -------------------------------------------------------------------------- */

interface CatalogItem {
  id: string;
  sku: string;
  name: string;
  variant: string;
  price: number;
  stock: number;
  kind: "device" | "accessory";
}

const DEVICES: CatalogItem[] = [
  {
    id: "ip15",
    sku: "APL-IP15P-256",
    name: "iPhone 15 Pro 256GB",
    variant: "Natural Titanium · A2848",
    price: 1099,
    stock: 8,
    kind: "device" },
  {
    id: "s24",
    sku: "SAM-S24U-512",
    name: "Galaxy S24 Ultra 512GB",
    variant: "Titanium Gray · SM-S928U",
    price: 1299,
    stock: 5,
    kind: "device" },
  {
    id: "pixel",
    sku: "GOO-PX8P-128",
    name: "Pixel 8 Pro 128GB",
    variant: "Obsidian · GC3VE",
    price: 899,
    stock: 6,
    kind: "device" },
];

const ACCESSORIES: CatalogItem[] = [
  {
    id: "charger",
    sku: "ANK-65W-BLK",
    name: "Anker 65W GaN Prime Charger",
    variant: "Black · Dual USB-C",
    price: 49.99,
    stock: 40,
    kind: "accessory" },
  {
    id: "case",
    sku: "SPG-MAG-ARM",
    name: "Spigen Mag Armor Case",
    variant: "MagSafe · Matte Black",
    price: 29.99,
    stock: 64,
    kind: "accessory" },
  {
    id: "buds",
    sku: "SON-WF1000-XM5",
    name: "Sony WF-1000XM5 Buds",
    variant: "Platinum Silver",
    price: 149.99,
    stock: 22,
    kind: "accessory" },
];

const DEMO_IMEI = "356892118023415"; // Valid Luhn checksum for demos.
const TAX_RATE = 0.08;

type ScanKind = "IMEI" | "Serial" | "Barcode";

interface ScanCheck {
  state: "idle" | "incomplete" | "valid" | "invalid";
  kind?: ScanKind;
  message: string;
}

interface CartLine {
  id: string;
  item: CatalogItem;
  code: string;
  codeDisplay: string;
  qty: number;
}

interface ScanLog {
  id: string;
  value: string;
  accepted: boolean;
  message: string;
  at: string;
}

function classifyScan(raw: string): ScanCheck {
  const value = raw.trim();
  if (!value) {
    return { state: "idle", message: "Waiting for a 15-digit IMEI or serial scan." };
  }

  const digits = value.replace(/[\s-]/g, "");
  if (/^\d+$/.test(digits)) {
    if (digits.length === 15) {
      return isValidImei(digits)
        ? { state: "valid", kind: "IMEI", message: "Valid IMEI · Luhn checksum verified." }
        : {
            state: "invalid",
            kind: "IMEI",
            message: "Invalid IMEI · Luhn checksum failed." };
    }
    if (digits.length >= 12 && digits.length < 15) {
      return {
        state: "valid",
        kind: "Barcode",
        message: "Barcode recognised · accessory scan." };
    }
    if (digits.length > 15) {
      return {
        state: "invalid",
        kind: "IMEI",
        message: `${digits.length} digits · IMEI must be exactly 15.` };
    }
    return {
      state: "incomplete",
      kind: "IMEI",
      message: `${digits.length}/15 digits · keep scanning.` };
  }

  if (isPlausibleSerial(value)) {
    return {
      state: "valid",
      kind: "Serial",
      message: "Serial accepted · unique stock unit." };
  }

  return {
    state: "invalid",
    message: "Unrecognised scan · use IMEI, serial or product barcode." };
}

function matchCatalog(check: ScanCheck, raw: string): CatalogItem | null {
  if (check.state !== "valid" || !check.kind) return null;

  if (check.kind === "IMEI") {
    const digits = raw.replace(/\D/g, "");
    if (digits.startsWith("35")) return DEVICES[0];
    if (digits.startsWith("99")) return DEVICES[1];
    return DEVICES[Number(digits.slice(-1)) % DEVICES.length];
  }

  const upper = raw.toUpperCase();
  if (upper.includes("ANK") || upper.includes("CHG")) return ACCESSORIES[0];
  if (upper.includes("CASE") || upper.includes("MAG")) return ACCESSORIES[1];
  if (upper.includes("BUD") || upper.includes("SON")) return ACCESSORIES[2];

  const digits = raw.replace(/\D/g, "");
  const seed = digits ? Number(digits.slice(-1)) : upper.length;
  return ACCESSORIES[seed % ACCESSORIES.length];
}

function normalizeCode(raw: string, kind?: ScanKind): string {
  const value = raw.trim().toUpperCase();
  return kind === "IMEI" ? value.replace(/\D/g, "") : value;
}

/* -------------------------------------------------------------------------- */
/*  PAGE                                                                      */
/* -------------------------------------------------------------------------- */

export function MobileAccessoriesPOS() {
  const { pushToast } = useToast();

  const [scanValue, setScanValue] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [payment, setPayment] = useState<"cash" | "card" | "upi">("card");
  const [receiptNo, setReceiptNo] = useState("—");

  const scanRef = useRef<HTMLInputElement>(null);
  const completeRef = useRef<HTMLButtonElement>(null);

  const check = useMemo(() => classifyScan(scanValue), [scanValue]);
  const subtotal = cart.reduce((sum, line) => sum + line.item.price * line.qty, 0);
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;

  const usedFor = (itemId: string) =>
    cart.reduce((sum, line) => (line.item.id === itemId ? sum + line.qty : sum), 0);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => scanRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, []);

  const addScan = () => {
    const current = classifyScan(scanValue);
    if (current.state !== "valid" || !current.kind) {
      setLogs((entries) =>
        [
          {
            id: `${Date.now()}-invalid`,
            value: scanValue || "empty scan",
            accepted: false,
            message: current.message,
            at: new Date().toLocaleTimeString("en-US", { hour12: false }) },
          ...entries,
        ].slice(0, 5),
      );
      pushToast({
        tone: "error",
        title: "Scan rejected",
        description: current.message });
      scanRef.current?.focus();
      return;
    }

    const item = matchCatalog(current, scanValue);
    if (!item) return;

    const code = normalizeCode(scanValue, current.kind);
    if (cart.some((line) => line.code === code)) {
      pushToast({
        tone: "warning",
        title: "Already in this sale",
        description: `${current.kind} ${scanValue.trim()} is already attached to another line.` });
      scanRef.current?.select();
      return;
    }

    if (usedFor(item.id) >= item.stock) {
      pushToast({
        tone: "error",
        title: `${item.name} is out of stock`,
        description: "Restock this SKU before attaching another serial." });
      return;
    }

    const line: CartLine = {
      id: `${code}-${Date.now()}`,
      item,
      code,
      codeDisplay:
        current.kind === "IMEI" ? formatImei(scanValue) : scanValue.trim().toUpperCase(),
      qty: 1 };

    setCart((lines) => [...lines, line]);
    setLogs((entries) =>
      [
        {
          id: `${line.id}-ok`,
          value: line.codeDisplay,
          accepted: true,
          message: `${current.kind} verified · ${item.name}`,
          at: new Date().toLocaleTimeString("en-US", { hour12: false }) },
        ...entries,
      ].slice(0, 5),
    );
    setScanValue("");
    pushToast({
      tone: "success",
      title: `${item.name} attached`,
      description: `${current.kind} ${line.codeDisplay} validated and reserved from stock.` });
    window.requestAnimationFrame(() => scanRef.current?.focus());
  };

  const openReceipt = () => {
    if (cart.length === 0) {
      pushToast({
        tone: "warning",
        title: "Cart is empty",
        description: "Scan at least one IMEI or serial before charging." });
      scanRef.current?.focus();
      return;
    }
    setReceiptNo(`MBL-${Math.floor(1000 + Math.random() * 9000)}`);
    setReceiptOpen(true);
  };

  const completeSale = () => {
    pushToast({
      tone: "success",
      title: `Sale ${receiptNo} completed`,
      description: `${cart.length} serialised item(s) · ${formatMoney(total)} paid by ${payment}.` });
    setCart([]);
    setPayment("card");
    setReceiptOpen(false);
    window.requestAnimationFrame(() => scanRef.current?.focus());
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    setCart([]);
    pushToast({
      tone: "info",
      title: "Cart cleared",
      description: "All serialised reservations were released." });
    scanRef.current?.focus();
  };



  const validationTone =
    check.state === "valid"
      ? "text-emerald-700 dark:text-emerald-400"
      : check.state === "invalid"
        ? "text-rose-700 dark:text-rose-400"
        : check.state === "incomplete"
          ? "text-amber-700 dark:text-amber-400"
          : "text-muted";

  return (
    <div className="space-y-4">
      {/* Terminal strip */}
      <section className="rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Smartphone className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  Mobile &amp; IMEI Terminal
                </h1>
                <span className="flex items-center gap-1.5 rounded-full border border-emerald-600/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <span className="h-1 w-1 rounded-full bg-emerald-500" />
                  Terminal online
                </span>
              </div>
              <p className="mt-0.5 text-sm text-muted">
                Register #04 · MBL-8802 · Cashier S. Martinez · Staff #104
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-muted">
              <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden />
              GSMA validation ready
            </span>
            <span className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-muted">
              <Wifi className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
              Sync 14ms
            </span>
            <span className="hidden items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-muted sm:flex">
              <Store className="h-4 w-4 text-muted" aria-hidden />
              Aura Mobile Hub
            </span>
          </div>
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-3">
          {/* Scanner */}
          <section
            className="relative overflow-hidden rounded-xl border border-line bg-surface p-4"
            aria-labelledby="scanner-title"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Barcode className="h-4 w-4 text-accent" aria-hidden />
                <h2 id="scanner-title" className="text-base font-semibold text-foreground">
                  Dedicated hardware IMEI &amp; serial scanner
                </h2>
              </div>
              <span className="hidden text-xs text-muted sm:flex">Scan and attach serialised items</span>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                addScan();
              }}
              className="mt-3"
            >
              <label htmlFor="scan-input" className="sr-only">
                Scan IMEI, serial number or barcode
              </label>
              <div
                className={cn(
                  "flex items-center gap-2 rounded-xl border-2 bg-surface-2 px-3.5 transition-colors",
                  check.state === "valid"
                    ? "border-emerald-500/50"
                    : check.state === "invalid"
                      ? "border-rose-500/50"
                      : check.state === "incomplete"
                        ? "border-amber-500/40"
                        : "border-accent/30 focus-within:border-accent",
                )}
              >
                <ScanLine className="h-5 w-5 shrink-0 text-muted" aria-hidden />
                <input
                  ref={scanRef}
                  id="scan-input"
                  value={scanValue}
                  onChange={(event) => setScanValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.stopPropagation();
                      if (scanValue) {
                        setScanValue("");
                      } else {
                        event.currentTarget.blur();
                      }
                    }
                  }}
                  placeholder="Scan 15-digit IMEI, serial number or barcode…"
                  autoComplete="off"
                  spellCheck={false}
                  inputMode="text"
                  aria-invalid={check.state === "invalid"}
                  aria-describedby="scan-validation scan-help"
                  className="h-12 w-full bg-transparent font-mono text-base tracking-wide text-foreground placeholder:font-sans placeholder:tracking-normal placeholder:text-muted focus:outline-none"
                />
                <button
                  type="submit"
                  className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-fg"
                >
                  Add to cart
                </button>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span
                  id="scan-validation"
                  role="status"
                  className={cn("flex items-center gap-1.5 text-xs font-medium", validationTone)}
                >
                  {check.state === "valid" ? (
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  ) : check.state === "invalid" ? (
                    <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <ScanLine className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {check.message}
                </span>
                {check.kind === "IMEI" && scanValue.replace(/\D/g, "").length === 15 ? (
                  <span className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-muted">
                    {formatImei(scanValue)}
                  </span>
                ) : null}
                <span id="scan-help" className="text-xs text-muted">
                  Demo:{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setScanValue(DEMO_IMEI);
                      scanRef.current?.focus();
                    }}
                    className="focus-ring rounded font-mono text-accent underline-offset-2 hover:underline"
                  >
                    356892 11 802341 5
                  </button>
                </span>
              </div>
            </form>
          </section>

          {/* Cart */}
          <section
            className="overflow-hidden rounded-xl border border-line bg-surface"
            aria-labelledby="cart-title"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted" aria-hidden />
                <h2 id="cart-title" className="text-base font-semibold text-foreground">
                  Registered items in cart
                </h2>
                <span className="rounded-full border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-muted">
                  {cart.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    pushToast({
                      tone: "info",
                      title: "Transaction held",
                      description: "The sale is parked and the scanner is ready for the next customer." })
                  }
                  className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-muted hover:text-foreground"
                >
                  <PauseCircle className="h-3 w-3" aria-hidden />
                  Hold
                </button>
                <button
                  type="button"
                  onClick={clearCart}
                  disabled={cart.length === 0}
                  className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Clear
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </div>
            </div>

            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface-2 text-muted">
                  <ScanLine className="h-5 w-5" aria-hidden />
                </span>
                <p className="text-sm font-medium text-foreground">No serials attached</p>
                <p className="max-w-xs text-sm text-muted">
                  Scan a 15-digit IMEI to verify the TAC and Luhn checksum, or scan an
                  accessory serial.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {cart.map((line) => (
                  <li
                    key={line.id}
                    className="flex flex-wrap items-start gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-muted">
                      {line.item.kind === "device" ? (
                        <Smartphone className="h-4 w-4" aria-hidden />
                      ) : (
                        <Package className="h-4 w-4" aria-hidden />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {line.item.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">{line.item.variant}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-xs text-muted">
                        <span className="text-muted">
                          {line.item.kind === "device" ? "IMEI" : "SER"}:
                        </span>
                        <span className="text-foreground">{line.codeDisplay}</span>
                        <span className="flex items-center gap-0.5 rounded border border-emerald-500/25 bg-emerald-500/10 px-1 py-0.5 text-xs font-semibold uppercase tracking-[0.04em] text-emerald-700 dark:text-emerald-300">
                          <BadgeCheck className="h-2.5 w-2.5" aria-hidden />
                          verified
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="text-right">
                        <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                          {formatMoney(line.item.price * line.qty)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">QTY {line.qty}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCart((lines) => lines.filter((entry) => entry.id !== line.id))}
                        className="focus-ring rounded-md p-1.5 text-muted transition-colors hover:bg-rose-500/10 hover:text-rose-700 dark:hover:text-rose-400"
                        aria-label={`Remove ${line.item.name} (${line.codeDisplay})`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-2 px-4 py-3 text-xs text-muted">
              <span>Scan a code to add it to the cart.</span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 text-accent" aria-hidden />
                Duplicate IMEI blocked
              </span>
            </div>
          </section>
        </div>

        {/* Right rail */}
        <div className="space-y-3">
          <section className="rounded-xl border border-line bg-surface p-4" aria-labelledby="totals-title">
            <div className="flex items-center justify-between">
              <h2 id="totals-title" className="text-base font-semibold text-foreground">
                Sale summary
              </h2>
              <span className="font-mono text-xs text-muted">{cart.length} lines</span>
            </div>

            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="font-mono tabular-nums text-foreground">{formatMoney(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Tax (8%)</dt>
                <dd className="font-mono tabular-nums text-foreground">{formatMoney(tax)}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-line pt-2">
                <dt className="text-sm font-semibold text-foreground">Total due</dt>
                <dd className="font-mono text-xl font-semibold tabular-nums text-foreground">
                  {formatMoney(total)}
                </dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={openReceipt}
              disabled={cart.length === 0}
              className="focus-ring mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3.5 py-3 text-sm font-semibold text-accent-fg transition-opacity hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ReceiptText className="h-4 w-4" aria-hidden />
              Charge &amp; receipt
            </button>
            <p className="mt-2 text-center text-xs text-muted">
              Card terminal paired · receipt prints to Register #04
            </p>
          </section>

          <section className="rounded-xl border border-line bg-surface p-4" aria-labelledby="stock-title">
            <div className="flex items-center justify-between">
              <h2 id="stock-title" className="flex items-center gap-2 text-base font-semibold text-foreground">
                <Package className="h-3.5 w-3.5 text-muted" aria-hidden />
                Live stock counter
              </h2>
              <span className="text-xs font-semibold uppercase tracking-[0.04em] text-emerald-700 dark:text-emerald-400">
                3 SKUs
              </span>
            </div>
            <ul className="mt-3 space-y-3">
              {[...DEVICES, ...ACCESSORIES].slice(0, 5).map((item) => {
                const available = item.stock - usedFor(item.id);
                const ratio = Math.max(0, (available / item.stock) * 100);
                return (
                  <li key={item.id}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-muted">{item.name}</span>
                      <span
                        className={cn(
                          "shrink-0 font-mono",
                          available <= 2
                            ? "text-amber-700 dark:text-amber-400"
                            : "text-foreground",
                        )}
                      >
                        {available}/{item.stock}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                      <span
                        className={cn(
                          "block h-full rounded-full",
                          available <= 2 ? "bg-amber-500" : "bg-accent/80",
                        )}
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-xl border border-line bg-surface p-4" aria-labelledby="scan-log-title">
            <div className="flex items-center justify-between">
              <h2 id="scan-log-title" className="text-base font-semibold text-foreground">
                Validation log
              </h2>
              <span className="font-mono text-xs text-muted">last 5</span>
            </div>
            {logs.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-line px-3 py-5 text-center text-sm text-muted">
                Scanner events will appear here with validation status.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {logs.map((log) => (
                  <li
                    key={log.id}
                    className="flex items-start gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2.5"
                  >
                    {log.accepted ? (
                      <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" aria-hidden />
                    ) : (
                      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-rose-500" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-xs text-foreground">
                        {log.value}
                      </span>
                      <span className="block truncate text-xs text-muted">{log.message}</span>
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted">{log.at}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* Receipt drawer */}
      <DialogShell
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        labelledBy="receipt-title"
        side="right"
        initialFocusRef={completeRef}
        panelClassName="flex flex-col"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">
              Receipt preview // {receiptNo}
            </p>
            <h2 id="receipt-title" className="mt-1 text-xl font-semibold text-foreground">
              Charge {formatMoney(total)}
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Aura Mobile Hub · Register #04 · S. Martinez
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReceiptOpen(false)}
            className="focus-ring -m-1 rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-foreground"
            aria-label="Close receipt"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <ul className="space-y-2.5">
            {cart.map((line) => (
              <li key={line.id} className="rounded-lg border border-line bg-surface-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {line.item.name}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-xs text-muted">
                      {line.codeDisplay}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-sm font-semibold text-foreground">
                    {formatMoney(line.item.price * line.qty)}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 rounded-lg border border-line bg-surface-2 p-3.5">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="font-mono text-foreground">{formatMoney(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Tax</dt>
                <dd className="font-mono text-foreground">{formatMoney(tax)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-1.5">
                <dt className="font-semibold text-foreground">Total</dt>
                <dd className="font-mono font-semibold text-foreground">{formatMoney(total)}</dd>
              </div>
            </dl>
          </div>

          <fieldset className="mt-4">
            <legend className="mb-2.5 text-sm font-medium text-muted">
              Payment method
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { key: "cash", label: "Cash", icon: ReceiptText },
                  { key: "card", label: "Card", icon: CreditCard },
                  { key: "upi", label: "UPI", icon: Smartphone },
                ] as const
              ).map((method, index) => {
                const Icon = method.icon;
                const selected = payment === method.key;
                return (
                  <button
                    key={method.key}
                    type="button"
                    onClick={() => setPayment(method.key)}
                    aria-pressed={selected}
                    className={cn(
                      "focus-ring flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-sm font-semibold transition-colors",
                      selected
                        ? "border-accent-line bg-accent-soft text-accent"
                        : "border-line bg-surface text-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {method.label}
                    
                  </button>
                );
              })}
            </div>
          </fieldset>

          <p className="mt-4 flex items-start gap-1.5 rounded-lg border border-emerald-600/20 bg-emerald-500/[0.06] px-3 py-2.5 text-sm text-muted">
            <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" aria-hidden />
            {cart.length} IMEI/serial reservation(s) will be committed and the warranty
            ledger created on completion.
          </p>
        </div>

        <div className="border-t border-line bg-surface px-5 py-4">
          <button
            ref={completeRef}
            type="button"
            onClick={completeSale}
            className="focus-ring flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3.5 py-3 text-sm font-semibold text-accent-fg transition-opacity hover:bg-accent-hover"
          >
            Complete sale · {formatMoney(total)}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </button>
          <p className="mt-2.5 flex items-center justify-center gap-1 text-xs text-muted"><ShieldCheck className="h-3 w-3" aria-hidden /> Secure checkout</p>
        </div>
      </DialogShell>
    </div>
  );
}
