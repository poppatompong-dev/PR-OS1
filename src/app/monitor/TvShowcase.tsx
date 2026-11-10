"use client";

// โชว์ผลงานในกล่องท้ายแถบล่าง (owner, 6 Nov 2026): the leftover space after the
// days with work shows the latest posts of the municipality's page, one at a
// time (~12 s each). Data: /api/monitor/showcase (Facebook, website as fallback).
// Three looks while the owner picks (?sc=1|2|3): 1 รูป+หัวข้อ · 2 รูปเต็มกล่อง ·
// 3 ฟิล์มสตริป. No posts → the plain "ยังว่าง" line.
// คำขอจากทีม (owner, 10 Nov 2026) take turns with the news: one card per request
// (picture · ชื่อเล่น · เรื่อง · สถานะ), data from /api/monitor/requests.

import { useEffect, useState } from "react";
import type { ShowcaseItem } from "@/lib/monitor/showcase";

export type BoardRequest = { id: string; name: string; kind: "look_request" | "gag_idea"; topic: string; status: "received" | "doing" | "choose" | "done"; image: string | null; avatar: string };
const REQ_LABEL: Record<BoardRequest["status"], string> = { received: "📥 รับแล้ว", doing: "🛠 กำลังทำ", choose: "🎨 รอเลือก", done: "✅ เสร็จ" };

type Slide = { t: "news" | "req"; k: number };
/** News with a request after every second post; leftover requests at the end. */
export function buildSlides(news: number, reqs: number): Slide[] {
  const out: Slide[] = [];
  let j = 0;
  for (let k = 0; k < news; k++) {
    out.push({ t: "news", k });
    if (k % 2 === 1 && j < reqs) out.push({ t: "req", k: j++ });
  }
  while (j < reqs) out.push({ t: "req", k: j++ });
  return out;
}

export type ShowcaseLook = 1 | 2 | 3;
export const SHOWCASE_DEFAULT_LOOK: ShowcaseLook = 3; // owner + team picked ฟิล์มสตริป (6 Nov 2026)
const EVERY_MS = 12_000;
const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const thaiDay = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return m && d ? `${d} ${MONTHS[m - 1]}` : "";
};
/** Thai tone marks of a hidden 3rd line still peek into a 2-line clamp, so cut the words first. */
const short = (t: string, max: number) => (t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t);
const srcLabel = (s: ShowcaseItem["source"]) => (s === "facebook" ? "เพจเทศบาล" : "ข่าว ปชส. nsm.go.th");

export function TvShowcase({
  items,
  requests = [],
  look,
  still,
  fallback,
}: {
  items: ShowcaseItem[];
  requests?: BoardRequest[];
  look: ShowcaseLook;
  still: boolean;
  fallback: string;
}) {
  const [n, setN] = useState(0);
  const slides = buildSlides(items.length, requests.length);
  const count = slides.length;
  useEffect(() => {
    setN(0);
    if (still || count < 2) return;
    const t = setInterval(() => setN((x) => (x + 1) % count), EVERY_MS);
    return () => clearInterval(t);
  }, [items, requests, still, count]);

  if (!count) return <span className="bm-sc-none">{fallback}</span>;
  const slide = slides[n % count];
  if (slide.t === "req") {
    const r = requests[slide.k];
    return (
      <div className="bm-sc bm-sc--rq" key={`rq-${r.id}-${n}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={`bm-rq-img${r.image ? " is-pic" : ""}`} src={r.image ?? r.avatar} alt="" />
        <div className="bm-sc-cap">
          <small>🛠 คำขอจากทีม</small>
          <b>{r.name}</b>
          <em>{short(r.topic, 30)}</em>
          <span className={`bm-rq-pill is-${r.status}`}>{REQ_LABEL[r.status]}</span>
        </div>
      </div>
    );
  }
  const i = slide.k;
  const it = items[i];

  if (look === 3) {
    return (
      <div className="bm-sc bm-sc--3">
        <div className="bm-sc-strip">
          <div className="bm-sc-track" style={{ ["--k" as string]: i % items.length }}>
            {items.map((x, k) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={k} src={x.image} alt="" className={k === i % items.length ? "is-on" : ""} />
            ))}
          </div>
        </div>
        <div className="bm-sc-cap" key={i}>
          <small>📘 {srcLabel(it.source)} · {thaiDay(it.date)}</small>
          <b>{short(it.title, 44)}</b>
        </div>
      </div>
    );
  }

  return (
    <div className={`bm-sc bm-sc--${look}`} key={`${look}-${i}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={`bm-sc-img${still ? "" : " is-live"}`} src={it.image} alt="" />
      <div className="bm-sc-cap">
        <small>📘 {srcLabel(it.source)} · {thaiDay(it.date)}</small>
        <b>{it.title}</b>
      </div>
      {items.length > 1 ? (
        <div className="bm-sc-dots" aria-hidden="true">
          {items.map((_, k) => (
            <i key={k} className={k === i % items.length ? "is-on" : ""} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
