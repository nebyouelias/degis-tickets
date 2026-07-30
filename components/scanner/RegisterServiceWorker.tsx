"use client";

import { useEffect } from "react";

/** Registers the scanner service worker so /scan opens with zero connectivity. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/scan" }).catch(() => {
      /* unsupported or blocked — IndexedDB still works */
    });
  }, []);
  return null;
}
