"use client";

// Files of one job, inside LINE (LIFF) or Telegram (Mini App, ?tg=1 — owner,
// 5 Nov 2026: the Telegram card's 📎 used to open the web page, which asks for
// a web login the team doesn't have). Tapping a file asks for a 60-second link.

import { useEffect, useState } from "react";
import styles from "../add-event.module.css";
import { fileKind } from "@/lib/attachments/rules";
import { useMiniApp } from "../host";

type FileRow = { id: string; fileName: string; mimeType: string | null; sizeBytes: number | null; thumb?: string | null };
type Data = { title: string; eventDate: string; files: FileRow[] };

const mb = (n: number | null) => (n ? `${(n / 1024 / 1024).toFixed(1)} MB` : "");

export function FilesView({ liffId }: { liffId: string }) {
  const { host, error: startError } = useMiniApp(liffId);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    if (!host) return;
    (async () => {
      try {
        const eventId = new URLSearchParams(window.location.search).get("e") ?? "";
        const res = await fetch(`/api/liff/attachments?e=${encodeURIComponent(eventId)}`, { headers: { Authorization: host.auth() } });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "เปิดไฟล์แนบไม่สำเร็จ");
        setData(body as Data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "เปิดไฟล์แนบไม่สำเร็จ");
      }
    })();
  }, [host]);

  async function open(f: FileRow) {
    if (!host) return;
    setOpening(f.id);
    setError(null);
    try {
      const res = await fetch("/api/liff/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: host.auth() },
        body: JSON.stringify({ id: f.id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "เปิดไฟล์ไม่สำเร็จ");
      if (host.kind === "telegram") host.openLink(body.url);
      else window.location.href = body.url;
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
        {error || startError ? <p className={styles.err}>{error ?? startError}</p> : null}
        {!data && !error && !startError ? <p className={styles.muted}>กำลังโหลด…</p> : null}
        {data && data.files.length === 0 ? <p className={styles.muted}>งานนี้ยังไม่มีไฟล์แนบ</p> : null}
        {data && data.files.length > 0 ? (
          <ul className="file-tiles">
            {data.files.map((f) => {
              const kind = fileKind(f.mimeType, f.fileName);
              return (
                <li key={f.id} className="file-tile">
                  <button
                    type="button"
                    className="file-tile-link"
                    style={{ font: "inherit", textAlign: "left", cursor: "pointer" }}
                    disabled={opening !== null}
                    onClick={() => open(f)}
                  >
                    <span className={`file-thumb file-thumb-${kind.tone}`}>
                      {f.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.thumb} alt="" loading="lazy" />
                      ) : (
                        <span aria-hidden="true">
                          {kind.icon}
                          <small>{kind.label}</small>
                        </span>
                      )}
                    </span>
                    <span className="file-name">{f.fileName}</span>
                    <span className="file-size">{opening === f.id ? "กำลังเปิด…" : mb(f.sizeBytes)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        <p className={styles.muted} style={{ marginTop: 8 }}>
          ไฟล์เป็นความลับของงาน ลิงก์เปิดไฟล์ใช้ได้ 60 วินาที
        </p>
      </section>
    </main>
  );
}
