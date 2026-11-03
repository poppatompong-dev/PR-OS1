"use client";

// The office TV keeps /monitor open for days. Without this it never sees a
// deploy until someone turns it off and on (owner, 3 Nov 2026). Every 3
// minutes (and when the screen wakes) it asks which build is live and reloads
// if it is not the one it is running. It also reloads once a day at 05:30 so a
// browser that has been open for days starts fresh.

import { useEffect } from "react";

const MINE = process.env.NEXT_PUBLIC_BUILD_SHA ?? "";
const KEY = "pr-os-tv-reload";

function reloadOnce(reason: string) {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 10 * 60_000) return; // a CDN still serving the old build: try later
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* storage blocked: still reload */
  }
  console.info(`[tv] reload: ${reason}`);
  window.location.reload();
}

export function AutoUpdate() {
  useEffect(() => {
    if (!MINE) return;
    const check = () =>
      fetch(`/api/monitor/version?t=${Date.now()}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { v?: string } | null) => {
          if (j?.v && j.v !== MINE) reloadOnce("new build");
        })
        .catch(() => undefined);
    const id = window.setInterval(check, 3 * 60_000);
    const wake = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("pageshow", wake);
    window.addEventListener("online", check);

    // Daily fresh start at 05:30 Bangkok.
    const daily = window.setInterval(() => {
      const hm = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
      if (hm === "05:30") reloadOnce("daily");
    }, 60_000);

    return () => {
      window.clearInterval(id);
      window.clearInterval(daily);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("pageshow", wake);
      window.removeEventListener("online", check);
    };
  }, []);
  return null;
}
