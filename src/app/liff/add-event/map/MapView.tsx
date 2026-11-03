"use client";

// หน้าดูพิกัดของงาน (owner, 3 Nov 2026): คนที่ได้รับมอบหมายเห็นหมุดทุกจุดบนแผนที่
// ชื่อจุด พิกัดละเอียด ระยะจากตัวเอง (ถ้าอนุญาตตำแหน่ง) และกด 🧭 นำทางด้วย GPS
// (เปิดแอป Google Maps / Waze ในเครื่อง). Telegram Mini App or LINE LIFF.

import { useEffect, useState } from "react";
import styles from "../add-event.module.css";
import { useMiniApp } from "../host";
import { MapPicker } from "@/components/MapPicker";
import { formatThaiDate } from "@/lib/format";
import { pointLink, pointName, pointNavUrl, type MapPoint } from "@/lib/maps";

type Data = { title: string; eventDate: string; startTime: string; endTime: string | null; place: string; points: MapPoint[] };

/** Straight-line distance in km (good enough to say "อีก 2.4 กม."). */
function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

function wazeUrl(p: MapPoint): string | null {
  return p.lat != null && p.lng != null ? `https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes` : null;
}

export function MapView({ liffId }: { liffId: string }) {
  const started = useMiniApp(liffId);
  const host = started.host;
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    if (started.error) setError(started.error);
  }, [started.error]);

  useEffect(() => {
    if (!host) return;
    (async () => {
      try {
        const eventId = new URLSearchParams(window.location.search).get("e") ?? "";
        const res = await fetch(`/api/liff/map?e=${encodeURIComponent(eventId)}`, { headers: { Authorization: host.auth() } });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "เปิดพิกัดไม่สำเร็จ");
        setData(body as Data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "เปิดพิกัดไม่สำเร็จ");
      }
    })();
    // Distance from where I stand, only if the phone already allows it (no nagging).
    navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((p) => {
        if (p.state === "granted") navigator.geolocation.getCurrentPosition((pos) => setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude }));
      })
      .catch(() => undefined);
  }, [host]);

  const open = (url: string) => (host ? host.openLink(url) : window.open(url, "_blank"));

  async function copy(i: number, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      window.prompt("คัดลอกพิกัด", text);
    }
  }

  if (error) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1 className={styles.h2}>เปิดพิกัดไม่สำเร็จ</h1>
          <p className={styles.hint}>{error}</p>
        </section>
      </main>
    );
  }
  if (!data) {
    return (
      <main className={styles.page}>
        <p className={styles.hint}>กำลังโหลดพิกัด…</p>
      </main>
    );
  }

  const total = data.points.length;
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1 className={styles.h2} style={{ marginBottom: 4 }}>🗺️ {data.title}</h1>
        <p className={styles.hint} style={{ margin: 0 }}>
          🗓 {formatThaiDate(data.eventDate)} · {data.startTime}
          {data.endTime ? `–${data.endTime}` : ""} น.{data.place ? ` · 📍 ${data.place}` : ""}
        </p>
      </section>

      {total === 0 ? (
        <section className={styles.card}>
          <p className={styles.hint}>งานนี้ยังไม่ได้ปักหมุดพิกัด</p>
        </section>
      ) : (
        <>
          <section className={styles.card} style={{ padding: 10 }}>
            <MapPicker points={data.points} readOnly height={340} />
          </section>
          {data.points.map((p, i) => {
            const coord = p.lat != null && p.lng != null ? `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}` : null;
            const dist = me && p.lat != null && p.lng != null ? km(me, { lat: p.lat, lng: p.lng }) : null;
            const waze = wazeUrl(p);
            return (
              <section key={i} className={styles.card}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span className="mp-num" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                  <div style={{ minWidth: 0 }}>
                    <b style={{ fontSize: 17 }}>{pointName(p, i, total) || "จุดนัดหมาย"}</b>
                    {dist != null ? <div className={styles.hint} style={{ margin: 0 }}>ห่างจากคุณ ~{dist < 1 ? `${Math.round(dist * 1000)} ม.` : `${dist.toFixed(1)} กม.`}</div> : null}
                  </div>
                </div>
                {coord ? (
                  <button type="button" className="mp-btn" style={{ width: "100%", justifyContent: "space-between", marginBottom: 8 }} onClick={() => copy(i, coord)}>
                    <span className="mp-coord" style={{ fontSize: 15, color: "inherit" }}>{coord}</span>
                    <span>{copied === i ? "✓ คัดลอกแล้ว" : "📋 คัดลอก"}</span>
                  </button>
                ) : null}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" className="mp-btn is-primary" style={{ flex: 1, justifyContent: "center", minHeight: 48 }} onClick={() => open(pointNavUrl(p))}>
                    🧭 นำทาง (Google Maps)
                  </button>
                  {waze ? (
                    <button type="button" className="mp-btn" style={{ minHeight: 48 }} onClick={() => open(waze)}>
                      Waze
                    </button>
                  ) : null}
                  {!coord ? (
                    <button type="button" className="mp-btn" style={{ minHeight: 48 }} onClick={() => open(pointLink(p))}>
                      เปิดลิงก์
                    </button>
                  ) : null}
                </div>
              </section>
            );
          })}
        </>
      )}
    </main>
  );
}
