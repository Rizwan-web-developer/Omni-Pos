"use client";

import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { type ReactNode, useRef } from "react";

import { DialogShell } from "@/components/ui/DialogShell";
import { cn } from "@/lib/utils";

type ConfirmTone = "danger" | "warning" | "default";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  loading?: boolean;
}

const toneStyles: Record<ConfirmTone, { iconWrap: string; icon: string; button: string; Icon: typeof AlertTriangle }> = {
  danger: {
    iconWrap: "border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400",
    icon: "text-rose-600 dark:text-rose-400",
    button: "border-rose-600 bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500/40",
    Icon: Trash2,
  },
  warning: {
    iconWrap: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    icon: "text-amber-600 dark:text-amber-400",
    button: "border-amber-600 bg-amber-600 text-white hover:bg-amber-700 focus:ring-amber-500/40",
    Icon: AlertTriangle,
  },
  default: {
    iconWrap: "border-accent-line bg-accent-soft text-accent",
    icon: "text-accent",
    button: "border-accent bg-accent text-accent-fg hover:opacity-90",
    Icon: AlertTriangle,
  },
};

/**
 * Internal confirmation dialog (replaces native browser confirm/alert so we never show "localhost says").
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  loading = false,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const t = toneStyles[tone];
  const Icon = t.Icon;

  return (
    <DialogShell
      open={open}
      onClose={loading ? () => {} : onClose}
      labelledBy="confirm-dialog-title"
      side="center"
      widthClass="max-w-md"
      zClass="z-[70]"
      closeOnEscape={!loading}
      initialFocusRef={cancelRef}
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-3.5">
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", t.iconWrap)} aria-hidden>
            <Icon className={cn("h-5 w-5", t.icon)} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="confirm-dialog-title" className="text-base font-semibold text-foreground">
              {title}
            </h3>
            {description ? <div className="mt-1.5 text-sm leading-relaxed text-muted">{description}</div> : null}
          </div>
          <button
            type="button"
            onClick={loading ? undefined : onClose}
            disabled={loading}
            className="focus-ring -mr-1 -mt-1 rounded-md p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2.5">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={loading}
            className="focus-ring inline-flex h-9 items-center rounded-lg border border-line bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-2 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={loading}
            className={cn("focus-ring inline-flex h-9 items-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors disabled:opacity-70", t.button)}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {loading ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </DialogShell>
  );
}
