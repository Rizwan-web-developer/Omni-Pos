"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

import { useBodyScrollLock, useFocusTrap } from "@/hooks/useFocusTrap";
import { cn } from "@/lib/utils";

interface DialogShellProps {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
  side?: "center" | "right" | "left";
  widthClass?: string;
  initialFocusRef?: RefObject<HTMLElement>;
  closeOnEscape?: boolean;
  zClass?: string;
  panelClassName?: string;
}

/**
 * Accessible overlay primitive used by the palette, modal and both drawers.
 *
 * - Renders through a portal so no parent stacking/transform can clip it.
 * - Traps focus and restores it to the trigger on close.
 * - Locks background scroll.
 * - Closes on backdrop click and Escape (Escape can be disabled mid-submit).
 */
export function DialogShell({
  open,
  onClose,
  labelledBy,
  children,
  side = "center",
  widthClass = "max-w-lg",
  initialFocusRef,
  closeOnEscape = true,
  zClass = "z-50",
  panelClassName,
}: DialogShellProps) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);
  useBodyScrollLock(open && mounted);
  useFocusTrap(panelRef, open && mounted, initialFocusRef);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 flex",
        zClass,
        side === "center"
          ? "items-start justify-center overflow-y-auto p-4 pt-[7vh] sm:pt-[9vh]"
          : side === "right"
            ? "items-stretch justify-end"
            : "items-stretch justify-start",
      )}
    >
      <div
        className="fixed inset-0 bg-overlay/70 backdrop-blur-[2px] animate-fade-in"
        aria-hidden
        onMouseDown={onClose}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape" && closeOnEscape) {
            event.stopPropagation();
            onClose();
          }
        }}
        className={cn(
          "relative z-10 w-full border border-line bg-surface shadow-panel outline-none",
          side === "center"
            ? "rounded-2xl animate-scale-in"
            : side === "right"
              ? "h-full max-w-xl border-y-0 border-r-0 animate-slide-in-right"
              : "h-full max-w-sm border-y-0 border-l-0 animate-slide-in-left",
          side === "center" ? widthClass : "",
          panelClassName,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
