"use client";

// Quick moves for a job that shifts (owner, 22 Oct 2026: jobs are often moved
// earlier or later). The buttons only change the form's own date/time fields;
// nothing is saved until "บันทึกการแก้ไข", so a wrong tap costs nothing.

import { useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

function field(form: HTMLFormElement | null, name: string): HTMLInputElement | null {
  return (form?.elements.namedItem(name) as HTMLInputElement | null) ?? null;
}

/** Minutes past midnight, or null for an empty/invalid "HH:MM". */
function toMin(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(v);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function shiftTime(value: string, deltaMin: number): { value: string; dayCarry: number } {
  const m = toMin(value);
  if (m === null) return { value, dayCarry: 0 };
  const total = m + deltaMin;
  const dayCarry = Math.floor(total / 1440);
  const t = ((total % 1440) + 1440) % 1440;
  return { value: `${pad(Math.floor(t / 60))}:${pad(t % 60)}`, dayCarry };
}

export function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ShiftButtons() {
  const [note, setNote] = useState<string | null>(null);

  function move(e: React.MouseEvent<HTMLButtonElement>, minutes: number, days: number) {
    const form = e.currentTarget.form;
    const date = field(form, "eventDate");
    const start = field(form, "startTime");
    const end = field(form, "endTime");
    let carry = days;
    if (minutes && start?.value) {
      const s = shiftTime(start.value, minutes);
      start.value = s.value;
      carry += s.dayCarry;
      if (end?.value) end.value = shiftTime(end.value, minutes).value;
    }
    if (carry && date?.value) date.value = shiftDate(date.value, carry);
    const label = days ? `${days > 0 ? "เลื่อนออก" : "เลื่อนเข้า"} ${Math.abs(days)} วัน` : `${minutes > 0 ? "ช้าลง" : "เร็วขึ้น"} ${Math.abs(minutes)} นาที`;
    setNote(`${label} — ตรวจวันเวลาแล้วกด "บันทึกการแก้ไข"`);
  }

  const btn = (label: string, minutes: number, days = 0) => (
    <button key={label} type="button" className="button secondary shift-btn" onClick={(e) => move(e, minutes, days)}>
      {label}
    </button>
  );

  return (
    <div className="form-field full shift-buttons">
      <span>เลื่อนเร็ว (เวลาเริ่มและเวลาสิ้นสุดเลื่อนไปด้วยกัน)</span>
      <div className="shift-row">
        {btn("−1 ชม.", -60)}
        {btn("−30 นาที", -30)}
        {btn("−15 นาที", -15)}
        {btn("+15 นาที", 15)}
        {btn("+30 นาที", 30)}
        {btn("+1 ชม.", 60)}
        {btn("เลื่อนเข้า 1 วัน", 0, -1)}
        {btn("เลื่อนออก 1 วัน", 0, 1)}
      </div>
      {note ? <small className="shift-note">{note}</small> : null}
    </div>
  );
}
