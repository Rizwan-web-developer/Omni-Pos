"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  CornerDownLeft,
  MoonStar,
  Plus,
  Search,
  Sun,
  type LucideIcon,
} from "lucide-react";

import { DialogShell } from "@/components/ui/DialogShell";
import { IndustryGlyph } from "@/components/ui/Badges";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { useTenants } from "@/components/providers/TenantProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { INDUSTRY_BY_KEY, INDUSTRY_ICONS, STATUS_META } from "@/lib/data";
import { NAV_ITEMS } from "@/lib/navigation";
import type { Tenant } from "@/lib/types";
import { cn } from "@/lib/utils";

type ItemGroup = "Actions" | "Navigate" | "Businesses";

interface PaletteItem {
  id: string;
  group: ItemGroup;
  label: string;
  hint: string;
  icon: LucideIcon;
  tenant?: Tenant;
  action: () => void;
}

const GROUP_ORDER: Record<ItemGroup, number> = {
  Actions: 0,
  Navigate: 1,
  Businesses: 2,
};

function scoreItem(item: PaletteItem, query: string): number {
  if (!query) return 0;
  const label = item.label.toLowerCase();
  const haystack = `${label} ${item.hint} ${item.group} ${item.tenant?.uid ?? ""} ${
    item.tenant?.slug ?? ""
  } ${item.tenant?.owner ?? ""}`.toLowerCase();

  if (label.startsWith(query)) return 0;
  if (haystack.split(/[\s·]+/).some((word) => word.startsWith(query))) return 1;
  if (haystack.includes(query)) return 2;
  return -1;
}

export function CommandPalette() {
  const router = useRouter();
  const { paletteOpen, closePalette, openOnboarding, openTenant } = useOverlays();
  const { tenants } = useTenants();
  const { theme, setTheme } = useTheme();

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const allItems = useMemo<PaletteItem[]>(() => {
    const actions: PaletteItem[] = [
      {
        id: "action-onboard",
        group: "Actions",
        label: "Create new business",
        hint: "Set up a business profile and select its category panel",
        icon: Plus,
        action: () => openOnboarding(),
      },
      {
        id: "action-theme",
        group: "Actions",
        label: theme === "dark" ? "Use light theme" : "Use dark theme",
        hint: "Applies instantly across every screen",
        icon: theme === "dark" ? Sun : MoonStar,
        action: () => setTheme(theme === "dark" ? "light" : "dark"),
      },
    ];

    const navigation: PaletteItem[] = NAV_ITEMS.filter((item) => !item.disabled).map(
      (item) => ({
        id: `nav-${item.href}`,
        group: "Navigate",
        label: item.label,
        hint: item.description,
        icon: item.icon,
        action: () => router.push(item.href),
      }),
    );

    const businessItems: PaletteItem[] = tenants.map((tenant) => ({
      id: `tenant-${tenant.id}`,
      group: "Businesses",
      label: tenant.name,
      hint: `${INDUSTRY_BY_KEY[tenant.industry]?.label ?? tenant.industry} · ${
        STATUS_META[tenant.status].label
      } · ${tenant.uid}`,
      icon: INDUSTRY_ICONS[tenant.industry] ?? Plus,
      tenant,
      action: () => openTenant(tenant.id),
    }));

    return [...actions, ...navigation, ...businessItems];
  }, [theme, tenants, openOnboarding, setTheme, router, openTenant]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const scored = allItems
      .map((item) => ({ item, score: scoreItem(item, q) }))
      .filter((entry) => entry.score >= 0);

    if (q) scored.sort((a, b) => a.score - b.score || GROUP_ORDER[a.item.group] - GROUP_ORDER[b.item.group]);
    else scored.sort((a, b) => GROUP_ORDER[a.item.group] - GROUP_ORDER[b.item.group]);

    return scored.slice(0, 12).map((entry) => entry.item);
  }, [allItems, query]);

  const activeItem = results[activeIndex];

  useEffect(() => {
    if (!paletteOpen) return;
    setQuery("");
    setActiveIndex(0);
  }, [paletteOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (activeIndex > results.length - 1) {
      setActiveIndex(Math.max(0, results.length - 1));
    }
  }, [results.length, activeIndex]);

  useEffect(() => {
    if (!paletteOpen || !activeItem) return;
    document
      .getElementById(`palette-item-${activeItem.id}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [paletteOpen, activeItem]);

  const runItem = (item: PaletteItem | undefined) => {
    if (!item) return;
    closePalette();
    item.action();
  };

  const move = (delta: number) => {
    if (results.length === 0) return;
    setActiveIndex((current) => {
      const next = current + delta;
      if (next < 0) return results.length - 1;
      if (next >= results.length) return 0;
      return next;
    });
  };

  return (
    <DialogShell
      open={paletteOpen}
      onClose={closePalette}
      labelledBy="command-palette-title"
      initialFocusRef={inputRef}
      zClass="z-[100]"
      widthClass="max-w-[660px]"
      panelClassName="overflow-hidden"
    >
      <h2 id="command-palette-title" className="sr-only">
        Command palette
      </h2>

      <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
        <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              move(1);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              move(-1);
            } else if (event.key === "Home") {
              event.preventDefault();
              setActiveIndex(0);
            } else if (event.key === "End") {
              event.preventDefault();
              setActiveIndex(Math.max(0, results.length - 1));
            } else if (event.key === "Enter") {
              event.preventDefault();
              runItem(activeItem);
            }
          }}
          role="combobox"
          aria-expanded="true"
          aria-controls="command-palette-listbox"
          aria-activedescendant={activeItem ? `palette-item-${activeItem.id}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          placeholder="Search businesses, jump to a screen, or run an action…"
          className="h-8 w-full bg-transparent text-base text-foreground placeholder:text-muted focus:outline-none"
        />
      </div>

      <div
        id="command-palette-listbox"
        role="listbox"
        aria-label="Commands and businesses"
        className="max-h-[min(56vh,420px)] overflow-y-auto p-2"
      >
        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
            <Search className="h-6 w-6 text-muted" aria-hidden />
            <p className="text-sm font-medium text-foreground">No matches for “{query}”</p>
            <p className="text-sm text-muted">
              Try “business”, “pharmacy”, “Aura” or “theme”.
            </p>
          </div>
        ) : (
          results.map((item, index) => {
            const isActive = index === activeIndex;
            const showGroup = index === 0 || results[index - 1].group !== item.group;

            return (
              <div key={item.id}>
                {showGroup ? (
                  <p
                    role="presentation"
                    className="px-2.5 pb-1 pt-3 text-xs font-semibold uppercase tracking-[0.06em] text-muted first:pt-1"
                  >
                    {item.group}
                  </p>
                ) : null}

                <div
                  id={`palette-item-${item.id}`}
                  role="option"
                  aria-selected={isActive}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => runItem(item)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                    isActive
                      ? "border-accent-line bg-accent-soft"
                      : "border-transparent hover:bg-surface-2",
                  )}
                >
                  {item.tenant ? (
                    <IndustryGlyph industry={item.tenant.industry} size="sm" />
                  ) : (
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                        isActive ? "bg-accent/15 text-accent" : "bg-surface-2 text-muted",
                      )}
                    >
                      <item.icon className="h-4 w-4" aria-hidden />
                    </span>
                  )}

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {item.label}
                    </span>
                    <span className="block truncate text-sm text-muted">{item.hint}</span>
                  </span>

                  {isActive ? (
                    <CornerDownLeft className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </DialogShell>
  );
}
