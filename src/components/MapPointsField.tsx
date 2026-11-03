"use client";

// ช่อง 📍 พิกัด ในฟอร์มเพิ่ม/แก้งาน (LINE/Telegram และเว็บ): แผนที่ปักหมุดหลายจุด
// + ช่องวางลิงก์ Google Maps / พิมพ์ "lat, lng" เพิ่มเป็นอีกจุด.
// Controlled (value/onChange) for the phone form; with `name` it also writes the
// points as JSON into a hidden input so a plain <form action> (web) gets them.

import { useState } from "react";
import { MapPicker } from "@/components/MapPicker";
import { MAX_MAP_POINTS, parseMapPoints, type MapPoint } from "@/lib/maps";

type Props = {
  value?: MapPoint[];
  onChange?: (points: MapPoint[]) => void;
  defaultValue?: MapPoint[];
  name?: string;
  height?: number;
};

export function MapPointsField({ value, onChange, defaultValue = [], name, height }: Props) {
  const [own, setOwn] = useState<MapPoint[]>(defaultValue);
  const points = value ?? own;
  const set = (next: MapPoint[]) => {
    if (!value) setOwn(next);
    onChange?.(next);
  };
  const [link, setLink] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function addLink() {
    const t = link.trim();
    if (!t) return;
    if (points.length >= MAX_MAP_POINTS) return setErr(`ปักได้สูงสุด ${MAX_MAP_POINTS} จุด`);
    const r = parseMapPoints([], t);
    if (!r.ok) return setErr(r.error);
    setErr(null);
    setLink("");
    set([...points, ...r.points]);
  }

  return (
    <div className="mp-field">
      {name ? <input type="hidden" name={name} value={JSON.stringify(points)} /> : null}
      <MapPicker points={points} onChange={set} height={height} />
      <div className="mp-tools">
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addLink();
            }
          }}
          inputMode="url"
          maxLength={500}
          placeholder="หรือวางลิงก์ Google Maps / 15.70, 100.13"
          className="input"
          style={{ flex: 1, minWidth: 0 }}
        />
        <button type="button" className="mp-btn" onClick={addLink}>
          ＋ เพิ่ม
        </button>
      </div>
      {err ? <p className="mp-note">{err}</p> : null}
    </div>
  );
}
