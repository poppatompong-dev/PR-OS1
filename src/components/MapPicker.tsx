"use client";

// แผนที่ปักหมุด (owner, 3 Nov 2026 — แบบ A ฝังในฟอร์ม):
//   แตะแผนที่ = ปักหมุดใหม่ (ได้ถึง 5 จุด) · ลากหมุด = ย้ายไปที่ไหนก็ได้
//   แต่ละจุดตั้งชื่อได้ (เช่น เวที / ที่จอดรถ) · ลบได้ · 📌 ตำแหน่งฉัน = ปักตรงที่ยืน
//   readOnly = หน้าดูพิกัดของคนที่ได้รับมอบหมาย: หมุดทุกจุด + จุดสีฟ้าที่อยู่ของเรา
// Map: OpenStreetMap tiles through Leaflet (free, no key). The parent owns the points.

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { MAX_MAP_POINTS, type MapPoint } from "@/lib/maps";

/** ศาลาว่าการเทศบาลนครนครสวรรค์ — where an empty map opens. */
const HOME: [number, number] = [15.7047, 100.1373];

const fmt = (n: number) => n.toFixed(6);

function pinIcon(L: typeof Leaflet, n: number, active: boolean) {
  return L.divIcon({
    className: "mp-pin-wrap",
    html: `<div class="mp-pin${active ? " is-active" : ""}"><span>${n}</span></div>`,
    iconSize: [36, 44],
    iconAnchor: [18, 42],
  });
}

type Props = {
  points: MapPoint[];
  onChange?: (points: MapPoint[]) => void;
  readOnly?: boolean;
  height?: number;
};

export function MapPicker({ points, onChange, readOnly = false, height = 280 }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const LRef = useRef<typeof Leaflet | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const meDot = useRef<Leaflet.CircleMarker | null>(null);
  const latest = useRef(points);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  latest.current = points;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const change = (next: MapPoint[]) => onChange?.(next);

  // Build the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !box.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(box.current, { zoomControl: true, attributionControl: true, tap: true } as Leaflet.MapOptions);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
      layer.current = L.layerGroup().addTo(map);
      const pins = latest.current.filter((p) => p.lat != null && p.lng != null);
      if (pins.length > 1) map.fitBounds(L.latLngBounds(pins.map((p) => [p.lat!, p.lng!])), { padding: [36, 36], maxZoom: 17 });
      else if (pins.length === 1) map.setView([pins[0].lat!, pins[0].lng!], 16);
      else map.setView(HOME, 14);
      if (!readOnly) {
        map.on("click", (e: Leaflet.LeafletMouseEvent) => {
          const cur = latest.current;
          if (cur.length >= MAX_MAP_POINTS) {
            setNote(`ปักได้สูงสุด ${MAX_MAP_POINTS} จุด — ลากหมุดเดิมไปแทน หรือลบก่อน`);
            return;
          }
          setNote(null);
          setActive(cur.length);
          onChangeRef.current?.([...cur, { label: "", lat: +fmt(e.latlng.lat), lng: +fmt(e.latlng.lng) }]);
        });
      }
      mapRef.current = map;
      setReady(true);
      // A map inside a card that just appeared (or a form step that opens later)
      // needs its size measured again, or only one tile shows.
      setTimeout(() => map.invalidateSize(), 200);
      if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => map.invalidateSize()).observe(box.current);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw the pins whenever the points change.
  useEffect(() => {
    const L = LRef.current;
    if (!ready || !L || !layer.current) return;
    layer.current.clearLayers();
    points.forEach((p, i) => {
      if (p.lat == null || p.lng == null) return;
      const m = L.marker([p.lat, p.lng], { draggable: !readOnly, icon: pinIcon(L, i + 1, active === i), autoPan: true });
      if (p.label) m.bindTooltip(p.label, { direction: "top", offset: [0, -40], permanent: readOnly });
      m.on("click", () => setActive(i));
      m.on("dragstart", () => setActive(i));
      m.on("dragend", () => {
        const ll = m.getLatLng();
        const next = latest.current.map((q, j) => (j === i ? { ...q, lat: +fmt(ll.lat), lng: +fmt(ll.lng), url: undefined } : q));
        onChangeRef.current?.(next);
      });
      m.addTo(layer.current!);
    });
  }, [points, ready, active, readOnly]);

  function locate() {
    if (!navigator.geolocation) return setNote("เครื่องนี้หาตำแหน่งไม่ได้");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude: lat, longitude: lng } = pos.coords;
        const L = LRef.current;
        const map = mapRef.current;
        if (map && L) {
          meDot.current?.remove();
          meDot.current = L.circleMarker([lat, lng], { radius: 8, color: "#fff", weight: 3, fillColor: "#1a73e8", fillOpacity: 1 }).addTo(map);
          map.setView([lat, lng], 17);
        }
        if (readOnly) return;
        const cur = latest.current;
        if (cur.length >= MAX_MAP_POINTS) return setNote(`ปักได้สูงสุด ${MAX_MAP_POINTS} จุด`);
        setActive(cur.length);
        change([...cur, { label: "", lat: +fmt(lat), lng: +fmt(lng) }]);
      },
      () => {
        setLocating(false);
        setNote("หาตำแหน่งไม่ได้ — อนุญาตตำแหน่งในเครื่อง แล้วลองใหม่");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  function focus(i: number) {
    const p = points[i];
    setActive(i);
    if (p.lat != null && p.lng != null) mapRef.current?.setView([p.lat, p.lng], Math.max(mapRef.current.getZoom(), 16));
  }

  return (
    <div className="mp">
      <div className="mp-map" ref={box} style={{ height }} />
      <div className="mp-tools">
        <span className="mp-hint">{readOnly ? "แตะหมุดเพื่อดูชื่อ · ซูม/เลื่อนได้" : points.length ? "แตะแผนที่ = เพิ่มจุด · ลากหมุด = ย้าย" : "แตะแผนที่เพื่อปักหมุด · ลากหมุดย้ายได้อิสระ"}</span>
        <button type="button" className="mp-btn" onClick={locate} disabled={locating}>
          {locating ? "กำลังหา…" : readOnly ? "📍 ฉันอยู่ไหน" : "📌 ตำแหน่งฉัน"}
        </button>
      </div>
      {note ? <p className="mp-note">{note}</p> : null}
      {!readOnly && points.length ? (
        <ol className="mp-list">
          {points.map((p, i) => (
            <li key={i} className={active === i ? "is-active" : ""}>
              <button type="button" className="mp-num" onClick={() => focus(i)} aria-label={`ไปที่จุด ${i + 1}`}>
                {i + 1}
              </button>
              <div className="mp-body">
                <input
                  value={p.label}
                  maxLength={40}
                  placeholder={points.length > 1 ? `ชื่อจุด เช่น เวที / ที่จอดรถ (จุดที่ ${i + 1})` : "ชื่อจุด (ไม่บังคับ) เช่น เวที"}
                  onChange={(e) => change(points.map((q, j) => (j === i ? { ...q, label: e.target.value } : q)))}
                  onFocus={() => setActive(i)}
                />
                <span className="mp-coord">{p.lat != null && p.lng != null ? `${fmt(p.lat)}, ${fmt(p.lng)}` : "ลิงก์แผนที่"}</span>
              </div>
              <button type="button" className="mp-del" onClick={() => { setActive(null); change(points.filter((_, j) => j !== i)); }} aria-label={`ลบจุด ${i + 1}`}>
                🗑
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
