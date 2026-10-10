"use client";

import { useEffect } from "react";

/**
 * Registers the offline worker. Nothing else in the app depends on it, so a
 * browser that refuses (or a plain http:// host) just carries on online-only.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* offline support is a bonus; never let it break the page */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
