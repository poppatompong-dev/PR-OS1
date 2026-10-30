"use client";

// Where the phone app runs: inside Telegram (Mini App, ?tg=1) or inside LINE
// (LIFF). Both pages (เพิ่มงาน and รายการงาน) start the same way, so it lives here.

import { useEffect, useState } from "react";

type Liff = {
  init(opts: { liffId: string }): Promise<void>;
  isLoggedIn(): boolean;
  login(opts?: { redirectUri?: string }): void;
  getIDToken(): string | null;
  isInClient(): boolean;
  closeWindow(): void;
};
type TgWebApp = {
  initData: string;
  ready(): void;
  expand(): void;
  close(): void;
  showConfirm?(message: string, cb: (ok: boolean) => void): void;
  HapticFeedback?: { notificationOccurred(type: "success" | "error" | "warning"): void };
};
declare global {
  interface Window {
    liff?: Liff;
    Telegram?: { WebApp?: TgWebApp };
  }
}

export type Host = {
  kind: "telegram" | "line";
  auth: () => string;
  inClient: boolean;
  close: () => void;
  /** Telegram's own confirm box when there is one (looks native), else the browser's. */
  confirm: (message: string) => Promise<boolean>;
  buzz: (ok: boolean) => void;
};

const TG_SDK = "https://telegram.org/js/telegram-web-app.js";
const LIFF_SDK = "https://static.line-scdn.net/liff/edge/2/sdk.js";

export function inTelegram(): boolean {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tg") === "1";
}

function load(src: string, ready: () => boolean, fail: string): Promise<void> {
  if (ready()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => (ready() ? resolve() : reject(new Error(fail)));
    s.onerror = () => reject(new Error("โหลดไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่"));
    document.head.appendChild(s);
  });
}

async function start(liffId: string): Promise<Host | null> {
  if (inTelegram()) {
    await load(TG_SDK, () => Boolean(window.Telegram?.WebApp?.initData), 'เปิดหน้านี้จากปุ่มในแชท Telegram ของบอทครับ');
    const app = window.Telegram!.WebApp!;
    app.ready();
    app.expand();
    return {
      kind: "telegram",
      auth: () => `tma ${app.initData}`,
      inClient: true,
      close: () => app.close(),
      confirm: (m) =>
        new Promise((res) => {
          if (app.showConfirm) app.showConfirm(m, (ok) => res(ok));
          else res(window.confirm(m));
        }),
      buzz: (ok) => app.HapticFeedback?.notificationOccurred(ok ? "success" : "error"),
    };
  }
  await load(LIFF_SDK, () => Boolean(window.liff), "LIFF SDK ไม่พร้อม");
  const sdk = window.liff!;
  await sdk.init({ liffId });
  if (!sdk.isLoggedIn()) {
    sdk.login({ redirectUri: window.location.href });
    return null;
  }
  return {
    kind: "line",
    auth: () => `Bearer ${sdk.getIDToken() ?? ""}`,
    inClient: sdk.isInClient(),
    close: () => sdk.closeWindow(),
    confirm: (m) => Promise.resolve(window.confirm(m)),
    buzz: () => undefined,
  };
}

/** Starts Telegram or LINE once; `host` is null until ready (or while LINE redirects to log in). */
export function useMiniApp(liffId: string, skip = false): { host: Host | null; error: string | null } {
  const [host, setHost] = useState<Host | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (skip) return;
    let cancelled = false;
    start(liffId)
      .then((h) => {
        if (!cancelled && h) setHost(h);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "เปิดไม่สำเร็จ");
      });
    return () => {
      cancelled = true;
    };
  }, [liffId, skip]);
  return { host, error };
}
