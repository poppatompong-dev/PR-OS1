"use client";

// Files of one job, inside LINE. liff.init → ID token → /api/liff/attachments.
// Tapping a file asks for a 60-second link and opens it in LINE's browser.

import { useEffect, useState } from "react";
import styles from "../add-event.module.css";

type Liff = {
  init(opts: { liffId: string }): Promise<void>;
  isLoggedIn(): boolean;
  login(opts?: { redirectUri?: string }): void;
  getIDToken(): string | null;
  isInClient(): boolean;
  closeWindow(): void;
};
type FileRow = { id: string; fileName: string; mimeType: string | null; sizeBytes: number | null };
type Data = { title: string; eventDate: string; files: FileRow[] };

const SDK = "https://static.line-scdn.net/liff/edge/2/sdk.js";

function loadSdk(): Promise<Liff> {
  const w = window as unknown as { liff?: Liff };
  if (w.liff) return Promise.resolve(w.liff);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SDK;
    s.async = true;
    s.onload = () => (w.liff ? resolve(w.liff) : reject(new Error("LIFF SDK ไม่พร้อม")));
    s.onerror = () => reject(new Error("โหลด LIFF ไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่"));
    document.head.appendChild(s);
  });
}

function icon(mime: string | null): string {
  if (!mime) return "📄";
  if (mime.startsWith("image/")) return "🖼️";
  if (mime === "application/pdf") return "📕";
  if (mime.includes("sheet") || mime.includes("excel")) return "📗";
  if (mime.includes("word")) return "📘";
  return "📄";
}

const mb = (n: number | null) => (n ? `${(n / 1024 / 1024).toFixed(1)} MB` : "");

export function FilesView({ liffId }: { liffId: string }) {
  const [liff, setLiff] = useState<Liff | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const sdk = await loadSdk();
        await sdk.init({ liffId });
        if (!sdk.isLoggedIn()) {
          sdk.login({ redirectUri: window.location.href });
          return;
        }
        setLiff(sdk);
        const eventId = new URLSearchParams(window.location.search).get("e") ?? "";
        const res = await fetch(`/api/liff/attachments?e=${encodeURIComponent(eventId)}`, {
          headers: { Authorization: `Bearer ${sdk.getIDToken() ?? ""}` },
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "เปิดไฟล์แนบไม่สำเร็จ");
        setData(body as Data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "เปิดไฟล์แนบไม่สำเร็จ");
      }
    })();
  }, [liffId]);

  async function open(f: FileRow) {
    if (!liff) return;
    setOpening(f.id);
    setError(null);
    try {
      const res = await fetch("/api/liff/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${liff.getIDToken() ?? ""}` },
        body: JSON.stringify({ id: f.id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "เปิดไฟล์ไม่สำเร็จ");
      window.location.href = body.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "เปิดไฟล์ไม่สำเร็จ");
    } finally {
      setOpening(null);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.h1}>📎 ไฟล์แนบ</h1>
        {data ? <p className={styles.muted}>{data.title}</p> : null}
      </header>
      <section className={styles.card}>
        {error ? <p className={styles.err}>{error}</p> : null}
        {!data && !error ? <p className={styles.muted}>กำลังโหลด…</p> : null}
        {data && data.files.length === 0 ? <p className={styles.muted}>งานนี้ยังไม่มีไฟล์แนบ</p> : null}
        {data
          ? data.files.map((f) => (
              <button
                key={f.id}
                type="button"
                className={styles.secondary}
                style={{ display: "flex", width: "100%", gap: 10, alignItems: "center", textAlign: "left", marginBottom: 8 }}
                disabled={opening !== null}
                onClick={() => open(f)}
              >
                <span aria-hidden="true">{icon(f.mimeType)}</span>
                <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{f.fileName}</span>
                <small>{opening === f.id ? "กำลังเปิด…" : mb(f.sizeBytes)}</small>
              </button>
            ))
          : null}
        <p className={styles.muted} style={{ marginTop: 8 }}>
          ไฟล์เป็นความลับของงาน ลิงก์เปิดไฟล์ใช้ได้ 60 วินาที
        </p>
      </section>
    </main>
  );
}
