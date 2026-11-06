"use client";

// โชว์ผลงานในกล่องท้ายแถบล่าง (owner, 6 Nov 2026): the leftover space after the
// days with work shows the latest posts of the municipality's page, one at a
// time (~12 s each). Data: /api/monitor/showcase (Facebook, website as fallback).
// Three looks while the owner picks (?sc=1|2|3): 1 รูป+หัวข้อ · 2 รูปเต็มกล่อง ·
// 3 ฟิล์มสตริป. No posts → the plain "ยังว่าง" line.

import { useEffect, useState } from "react";
import type { ShowcaseItem } from "@/lib/monitor/showcase";

export type ShowcaseLook = 1 | 2 | 3;
export const SHOWCASE_DEFAULT_LOOK: ShowcaseLook = 3; // owner + team picked ฟิล์มสตริป (6 Nov 2026)
const EVERY_MS = 12_000;
const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const thaiDay = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return m && d ? `${d} ${MONTHS[m - 1]}` : "";
};
const srcLabel = (s: ShowcaseItem["source"]) => (s === "facebook" ? "เพจเทศบาลนครนครสวรรค์" : "ข่าวประชาสัมพันธ์ nsm.go.th");

export function TvShowcase({ items, look, still, fallback }: { items: ShowcaseItem[]; look: ShowcaseLook; still: boolean; fallback: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    if (still || items.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % items.length), EVERY_MS);
    return () => clearInterval(t);
  }, [items, still]);

  if (!items.length) return <span className="bm-sc-none">{fallback}</span>;
  const it = items[i % items.length];

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
          <b>{it.title}</b>
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
