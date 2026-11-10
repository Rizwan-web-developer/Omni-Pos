"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";
import type { ToastInput, ToastItem, ToastTone } from "@/lib/types";

interface ToastContextValue {
  pushToast: (toast: ToastInput) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_META: Record<
  ToastTone,
  { icon: LucideIcon; iconClass: string; border: string }
> = {
  success: {
    icon: CheckCircle2,
    iconClass: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-500/30",
  },
  info: {
    icon: Info,
    iconClass: "text-accent",
    border: "border-accent-line",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "text-amber-700 dark:text-amber-400",
    border: "border-amber-500/30",
  },
  error: {
    icon: XCircle,
    iconClass: "text-rose-700 dark:text-rose-400",
    border: "border-rose-500/30",
  },
};

let toastCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const pushToast = useCallback(
    (input: ToastInput) => {
      toastCounter += 1;
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `toast-${Date.now()}-${toastCounter}`;
      const item: ToastItem = {
        ...input,
        id,
        tone: input.tone ?? "info",
      };

      setToasts((current) => [...current.slice(-3), item]);

      const timer = window.setTimeout(() => dismissToast(id), 4800);
      timers.current.set(id, timer);
      return id;
    },
    [dismissToast],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((timer) => window.clearTimeout(timer));
      map.clear();
    };
  }, []);

  const value = useMemo(
    () => ({ pushToast, dismissToast }),
    [pushToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Polite live region: announcements never steal keyboard focus. */}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed bottom-4 right-4 z-[140] flex w-[min(92vw,380px)] flex-col gap-2"
      >
        {toasts.map((toast) => {
          const meta = TONE_META[toast.tone];
          const Icon = meta.icon;
          return (
            <div
              key={toast.id}
              role="status"
              className={cn(
                "pointer-events-auto flex items-start gap-3 rounded-xl border bg-surface p-4 shadow-panel animate-slide-up",
                meta.border,
              )}
            >
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.iconClass)} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{toast.title}</p>
                {toast.description ? (
                  <p className="mt-0.5 text-sm leading-relaxed text-muted">
                    {toast.description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="focus-ring -m-1 rounded-md p-1 text-muted transition-colors hover:text-foreground"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}
