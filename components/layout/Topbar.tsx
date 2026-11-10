"use client";

import { usePathname } from "next/navigation";
import { Menu, Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/providers/ThemeProvider";
import { findNavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const THEMES = [
  { key: "light" as const, label: "Light", short: "Light", icon: Sun },
  { key: "dark" as const, label: "Dark", short: "Dark", icon: Moon },
];

export function Topbar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const pathname = usePathname();
  const current = findNavItem(pathname);
  const { theme, setTheme, mounted } = useTheme();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-background/90 backdrop-blur-md">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="focus-ring -ml-1 rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-foreground lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold tracking-tight text-foreground">{current.label}</h2>
        </div>

        <div
          className="flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5"
          role="group"
          aria-label="Color theme"
        >
          {THEMES.map((item) => {
            const Icon = item.icon;
            const active = theme === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTheme(item.key)}
                aria-pressed={active}
                className={cn(
                  "focus-ring flex h-8 items-center justify-center gap-1.5 rounded-md px-2 transition-colors sm:px-2.5",
                  active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-foreground",
                )}
                title={item.label}
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span className="hidden text-xs font-medium sm:inline">{item.short}</span>
                <span className="sr-only">{item.label} theme</span>
              </button>
            );
          })}
        </div>
      </div>

      <span className="sr-only" aria-live="polite">
        {mounted ? `${theme} theme active` : ""}
      </span>
    </header>
  );
}
