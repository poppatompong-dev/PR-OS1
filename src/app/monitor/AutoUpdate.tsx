"use client";

// The office TV keeps /monitor open for days. Without this it never sees a
// deploy until someone turns it off and on (owner, 3 Nov 2026). Every minute
// (and when the screen wakes) it asks which build is live and reloads if it is
// not the one it is running — or if an admin pressed "รีเฟรชทีวีตอนนี้"
// in /settings since this page loaded (k changed; 4 Nov 2026). It also reloads once a day at 05:30 so a
// browser that has been open for days starts fresh.

import { useEffect } from "react";

const MINE = process.env.NEXT_PUBLIC_BUILD_SHA ?? "";
const KEY = "pr-os-tv-reload";

function reloadOnce(reason: string, force = false) {
  if (force) {
    console.info(`[tv] reload: ${reason}`);
    window.location.reload();
    return;
  }
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
    let seenKick: string | null = null;
    const check = () =>
      fetch(`/api/monitor/version?t=${Date.now()}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { v?: string; k?: string | null } | null) => {
          if (!j) return;
          if (typeof j.k === "string") {
            if (seenKick === null) seenKick = j.k;
            else if (j.k !== seenKick) return reloadOnce("admin pressed reload", true);
          }
          if (j.v && j.v !== MINE) reloadOnce("new build");
        })
        .catch(() => undefined);
    check();
    const id = window.setInterval(check, 60_000);
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

  // The office TV box runs this page in Firefox (13 Nov 2026): the browser
  // chrome only goes away in real full-screen, and that needs a user gesture.
  // The first tap / remote key (and any later one, after a reload) asks for it.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("fs") === "0") return;
    const go = () => {
      const el = document.documentElement;
      if (document.fullscreenElement || !el.requestFullscreen) return;
      el.requestFullscreen().catch(() => undefined);
    };
    window.addEventListener("pointerdown", go);
    window.addEventListener("keydown", go);
    return () => {
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
    };
  }, []);
  return null;
}
