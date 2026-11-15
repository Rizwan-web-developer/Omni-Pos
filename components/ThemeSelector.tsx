"use client";

import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const THEME_PRESETS = [
  "Omni Pos",
  "Omni Pos Retail",
  "Omni Pos Pharma",
  "Omni Pos Electronics",
  "Omni Pos Paint",
  "Omni Pos Hardware",
  "Omni Pos Cosmetics",
  "Omni Pos Mobile",
] as const;

export function ThemeSelector() {
  const [platformName, setPlatformName] = useState<string>("");
  const [customName, setCustomName] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/platform/settings", { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as {
          platformName?: string;
          platformLogoDataUrl?: string | null;
        };
        const name = data.platformName || "Omni Pos";
        setPlatformName(name);
        setSelected(name);
      } catch {
        /* keep defaults */
      }
    })();
  }, []);

  const saveTheme = () => {
    const name = customName.trim() || selected;
    if (!name) return;
    setPlatformName(name);
    setSelected(name);
    setIsOpen(false);
    void fetch("/api/platform/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platformName: name, platformLogoDataUrl: null }),
    }).catch(() => {
      /* best-effort */
    });
  };

  const toggle = () => setIsOpen((v) => !v);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "focus-ring flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-line-strong",
        )}
        title="Change platform theme / name"
      >
        <Settings className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate max-w-[120px]">{platformName || "Theme"}</span>
        <span className="text-[10px] text-muted ml-1">Theme</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-56 rounded-lg border border-line bg-surface shadow-panel z-50">
          <div className="p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
              Select Theme / Platform Name
            </p>
            <div className="space-y-1.5">
              {THEME_PRESETS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelected(t)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                    selected === t
                      ? "bg-accent-soft text-accent border border-accent-line"
                      : "text-muted hover:bg-surface-2 hover:text-foreground",
                  )}
                >
                  <span>{t}</span>
                  {selected === t && <CheckIcon className="h-4 w-4 text-accent" aria-hidden />}
                </button>
              ))}
              <div className="border-t border-line pt-2 mt-2">
                <label className="text-xs font-medium text-muted block mb-1.5">
                  Custom name
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. My Shop POS"
                  className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-accent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={saveTheme}
                  className="mt-2 w-full rounded-lg border border-accent-line bg-accent-soft px-3 py-2 text-sm font-semibold text-accent hover:bg-accent"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
