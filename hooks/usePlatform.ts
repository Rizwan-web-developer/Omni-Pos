"use client";

import { useEffect, useState } from "react";

/**
 * Platform detection for rendering `⌘` vs `Ctrl` in keybinding badges.
 * Starts false so server and first client paint agree; updates after mount.
 */
export function useIsMac(): boolean {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    const platform =
      navigator.platform || navigator.userAgent || "";
    setIsMac(/mac|iphone|ipad|ipod/i.test(platform));
  }, []);

  return isMac;
}
