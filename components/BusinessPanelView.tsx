import Link from "next/link";
import { ArrowRight, Boxes, LayoutGrid, Package, ReceiptText, Settings2 } from "lucide-react";

import { IndustryGlyph } from "@/components/ui/Badges";
import { INDUSTRY_BY_KEY } from "@/lib/data";
import type { IndustryKey } from "@/lib/types";

const PANEL_FEATURES: Record<string, Array<{ title: string; description: string }>> = {
  electronics: [
    { title: "Products & serials", description: "Manage electronics inventory with serial/warranty tracking." },
    { title: "Sales & billing", description: "Counter billing, invoices, returns and customer records." },
    { title: "Installments & service", description: "Installment plans, warranties and repair tickets." },
  ],
  "hardware-shop": [
    { title: "Products & units", description: "Manage hardware items, sizes, units and bulk stock." },
    { title: "Fast counter billing", description: "Quick billing for walk-in hardware purchases." },
    { title: "Suppliers & stock", description: "Track suppliers, purchases and low-stock items." },
  ],
  "paint-shop": [
    { title: "Shades & formulas", description: "Manage paint shades, mixing formulas and color codes." },
    { title: "Containers & pricing", description: "Sell by can/bucket size and custom quantities." },
    { title: "Paint billing", description: "Billing workflow tailored for paint shop sales." },
  ],
  "cosmetics-shop": [
    { title: "Products & variants", description: "Manage cosmetics with brands, shades and variants." },
    { title: "Beauty retail billing", description: "Checkout flow for cosmetics and personal care." },
    { title: "Stock & batches", description: "Track stock and batches/expiry where applicable." },
  ],
  grocery: [
    { title: "Products & categories", description: "Manage grocery catalog, categories and barcodes." },
    { title: "Fast checkout", description: "High-speed billing for supermarket operations." },
    { title: "Stock & promotions", description: "Inventory control, bundles and promotions." },
  ],
  mobile: [
    { title: "Devices & accessories", description: "Manage gadgets, accessories and stock." },
    { title: "IMEI/serial sales", description: "Serialized checkout and warranty records." },
    { title: "Repairs & trade-ins", description: "Service and trade-in workflows." },
  ],
  pharmacy: [
    { title: "Medicines & batches", description: "Manage formulations, batches and expiry." },
    { title: "Dispensing", description: "FEFO dispensing with verification." },
    { title: "Compliance", description: "Audit trail and regulated workflows." },
  ],
};

export function BusinessPanelView({ category }: { category: string }) {
  const key = category as IndustryKey;
  const mod = INDUSTRY_BY_KEY[key];

  if (!mod) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6">
        <h1 className="text-xl font-semibold text-foreground">Panel not found</h1>
        <p className="mt-1 text-sm text-muted">This business category panel is not available.</p>
        <Link href="/dashboard" className="mt-4 inline-flex text-sm font-medium text-accent hover:underline">Back to dashboard</Link>
      </div>
    );
  }

  const features = PANEL_FEATURES[key] ?? [
    { title: "Products", description: "Manage products for this business category." },
    { title: "Billing", description: "Sales and billing workflow for this category." },
    { title: "Settings", description: "Panel settings customized for this business." },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <IndustryGlyph industry={key} size="lg" />
          <div>
            <p className="text-xs font-medium text-muted">Business panel</p>
            <h1 className="mt-0.5 text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">{mod.label} Panel</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">{mod.description}</p>
          </div>
        </div>
        <Link
          href="/tenants"
          className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-medium text-muted hover:border-line-strong hover:text-foreground"
        >
          View businesses
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <div className="rounded-xl border border-accent-line bg-accent-soft px-4 py-3 text-sm text-foreground">
        This panel is <span className="font-semibold">customized for {mod.label}</span>. Products, billing, and workflows for this category are separate from other business types (e.g. cosmetics vs. paint).
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        {features.map((f, i) => {
          const Icon = [Package, ReceiptText, Boxes, LayoutGrid, Settings2][i] ?? LayoutGrid;
          return (
            <div key={f.title} className="rounded-xl border border-line bg-surface p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 text-muted">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-3 text-base font-semibold text-foreground">{f.title}</h2>
              <p className="mt-1 text-sm text-muted">{f.description}</p>
            </div>
          );
        })}
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Quick access</h2>
            <p className="mt-0.5 text-sm text-muted">Open the right workspace for this business category.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/tenants" className="focus-ring inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-fg hover:bg-accent-hover">
            Manage businesses &amp; open store panels <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <p className="w-full text-sm text-muted">Each business has its own separate store management panel (inventory, stock add/update/deduct, POS &amp; checkout). Open it from a business in the directory.</p>
        </div>
      </section>
    </div>
  );
}
