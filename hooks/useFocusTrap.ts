"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function visibleFocusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0 || el === document.activeElement,
  );
}

/**
 * Modal focus trap.
 *
 * - Moves focus to the initial control on mount.
 * - Cycles Tab / Shift+Tab forever inside the container.
 * - Restores focus to the trigger element on unmount.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement>,
  active: boolean,
  initialFocusRef?: RefObject<HTMLElement>,
): void {
  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    const previous =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Focus the initial control after paint. The timeout is a fallback for
    // throttled/hidden tabs where requestAnimationFrame may never fire.
    let cancelled = false;
    const focusInitial = () => {
      if (cancelled) return;
      const target =
        initialFocusRef?.current ?? visibleFocusables(container)[0] ?? container;
      target.focus({ preventScroll: true });
    };
    const raf = window.requestAnimationFrame(focusInitial);
    const timer = window.setTimeout(focusInitial, 80);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;

      const items = visibleFocusables(container);
      if (items.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey) {
        if (activeElement === first || !container.contains(activeElement)) {
          event.preventDefault();
          last.focus();
        }
      } else if (activeElement === last || !container.contains(activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown, true);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [active, ref, initialFocusRef]);
}

/** Prevent background scrolling while an overlay is open. */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);
}

/** Focus the first matching element shortly after a step / route change. */
export function useAutoFocus(
  ref: RefObject<HTMLElement>,
  active: boolean,
  delayMs = 0,
): void {
  useEffect(() => {
    if (!active) return;
    const id = window.setTimeout(() => {
      ref.current?.focus({ preventScroll: false });
    }, delayMs);
    return () => window.clearTimeout(id);
  }, [ref, active, delayMs]);
}
