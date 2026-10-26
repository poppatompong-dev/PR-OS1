"use client";

// The LINE "add job" form. Flow: load the LIFF SDK → liff.init → (login if
// needed) → ID token → load lists → fill in → save as draft or publish.
// Every call to /api/liff/* carries the ID token; the server checks it with
// LINE and finds the team member by their LINE user id.

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./add-event.module.css";
import { AttachmentPicker } from "@/components/AttachmentPicker";
import { PlaceInput } from "@/components/PlaceInput";
import { RoleChips } from "@/components/RoleChips";
import type { StagedAttachment } from "@/lib/attachments/rules";

type Option = { id: string; name: string };
type Person = Option & { position: string | null; avatar: string };
type Lists = { me: Option; people: Person[]; roles: Option[]; places: string[] };
type Row = { personId: string; roleIds: string[] };

type Liff = {
  init(opts: { liffId: string }): Promise<void>;
  isLoggedIn(): boolean;
  login(opts?: { redirectUri?: string }): void;
  getIDToken(): string | null;
  isInClient(): boolean;
  closeWindow(): void;
};
declare global {
  interface Window {
    liff?: Liff;
  }
}

const SDK = "https://static.line-scdn.net/liff/edge/2/sdk.js";

function bangkokDate(offsetDays = 0): string {
  const d = new Date(Date.now() + 7 * 3600 * 1000 + offsetDays * 86400 * 1000);
  return d.toISOString().slice(0, 10);
}

function loadSdk(): Promise<Liff> {
  if (window.liff) return Promise.resolve(window.liff);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SDK;
    s.async = true;
    s.onload = () => (window.liff ? resolve(window.liff) : reject(new Error("LIFF SDK ไม่พร้อม")));
    s.onerror = () => reject(new Error("โหลด LIFF ไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่"));
    document.head.appendChild(s);
  });
}

type Phase =
  | { kind: "loading"; text: string }
  | { kind: "error"; text: string }
  | { kind: "form" }
  | { kind: "done"; published: boolean; notified: number; title: string };

export function AddEventForm({ liffId }: { liffId: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading", text: "กำลังเปิดฟอร์ม…" });
  const [liff, setLiff] = useState<Liff | null>(null);
  const [lists, setLists] = useState<Lists | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);

  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState(bangkokDate(1));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("");
  const [place, setPlace] = useState("");
  const [shortNote, setShortNote] = useState("");
  const [rows, setRows] = useState<Row[]>([{ personId: "", roleIds: [] }]);
  const [files, setFiles] = useState<{ staged: StagedAttachment[]; busy: boolean }>({ staged: [], busy: false });
  const [pickerKey, setPickerKey] = useState(0);

  const token = useCallback(() => liff?.getIDToken() ?? "", [liff]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sdk = await loadSdk();
        await sdk.init({ liffId });
        if (!sdk.isLoggedIn()) {
          sdk.login({ redirectUri: window.location.href });
          return;
        }
        if (cancelled) return;
        setLiff(sdk);
        setPhase({ kind: "loading", text: "กำลังโหลดรายชื่อทีมงาน…" });
        const res = await fetch("/api/liff/options", { headers: { Authorization: `Bearer ${sdk.getIDToken() ?? ""}` } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "โหลดข้อมูลไม่สำเร็จ");
        if (cancelled) return;
        setLists(data as Lists);
        setPhase({ kind: "form" });
      } catch (e) {
        if (!cancelled) setPhase({ kind: "error", text: e instanceof Error ? e.message : "เปิดฟอร์มไม่สำเร็จ" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liffId]);

  const filled = useMemo(() => rows.filter((r) => r.personId && r.roleIds.length > 0), [rows]);
  const halfRow = rows.some((r) => (r.personId && r.roleIds.length === 0) || (!r.personId && r.roleIds.length > 0));

  function setRow(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function reset() {
    setTitle("");
    setEndTime("");
    setShortNote("");
    setRows([{ personId: "", roleIds: [] }]);
    setFiles({ staged: [], busy: false });
    setPickerKey((k) => k + 1);
    setError(null);
    setPhase({ kind: "form" });
  }

  async function save(publish: boolean) {
    setError(null);
    if (!title.trim()) return setError("กรุณากรอกชื่องาน");
    if (!eventDate || !startTime) return setError("กรุณาเลือกวันที่และเวลาเริ่ม");
    if (endTime && endTime <= startTime) return setError("เวลาสิ้นสุดต้องหลังเวลาเริ่ม");
    if (halfRow) return setError("เลือกทั้งชื่อและหน้าที่ของผู้ปฏิบัติงานให้ครบ หรือลบแถวที่ไม่ใช้");
    if (files.busy) return setError("กำลังอัปโหลดไฟล์แนบ รอสักครู่แล้วกดอีกครั้ง");
    setSaving(publish ? "publish" : "draft");
    try {
      const res = await fetch("/api/liff/events", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ title, eventDate, startTime, endTime: endTime || null, locationText: place.trim() || null, shortNote, assignees: filled, attachments: files.staged, publish }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "บันทึกไม่สำเร็จ");
      setPhase({ kind: "done", published: publish, notified: data.notified ?? 0, title: title.trim() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(null);
    }
  }

  if (phase.kind === "loading") {
    return (
      <main className={styles.page}>
        <p className={styles.center}>{phase.text}</p>
      </main>
    );
  }
  if (phase.kind === "error") {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.h1}>เปิดฟอร์มไม่ได้</h1>
          <p className={styles.err}>{phase.text}</p>
        </div>
      </main>
    );
  }
  if (phase.kind === "done") {
    return (
      <main className={styles.page}>
        <div className={`${styles.card} ${styles.done}`}>
          <div className={styles.tick}>✓</div>
          <h1 className={styles.h1}>{phase.published ? "เผยแพร่งานแล้ว" : "บันทึกร่างแล้ว"}</h1>
          <p className={styles.doneTitle}>{phase.title}</p>
          <p className={styles.muted}>
            {phase.published
              ? phase.notified > 0
                ? `ส่งการ์ดแจ้งงานให้ผู้ปฏิบัติงาน ${phase.notified} คนทาง LINE แล้ว`
                : "ยังไม่มีผู้ปฏิบัติงาน เพิ่มคนได้ในเว็บ PR-OS"
              : "ยังไม่แจ้งใคร เผยแพร่ได้จากเว็บ PR-OS เมื่อพร้อม"}
          </p>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={reset}>
              เพิ่มงานอีก
            </button>
            {liff?.isInClient() ? (
              <button type="button" className={styles.primary} onClick={() => liff.closeWindow()}>
                ปิด
              </button>
            ) : null}
          </div>
        </div>
      </main>
    );
  }

  const L = lists!;
  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.h1}>เพิ่มงานใหม่</h1>
        <p className={styles.muted}>โดย {L.me.name}</p>
      </header>

      <section className={styles.card}>
        <label className={styles.field}>
          <span>ชื่องาน *</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น ถ่ายภาพประชุมสภา" maxLength={200} />
        </label>

        <div className={styles.field}>
          <span>วันที่ *</span>
          <div className={styles.chips}>
            {[
              ["วันนี้", bangkokDate(0)],
              ["พรุ่งนี้", bangkokDate(1)],
            ].map(([label, d]) => (
              <button type="button" key={d} className={eventDate === d ? styles.chipOn : styles.chip} onClick={() => setEventDate(d)}>
                {label}
              </button>
            ))}
            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={styles.grow} />
          </div>
        </div>

        <div className={styles.two}>
          <label className={styles.field}>
            <span>เวลาเริ่ม *</span>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
          <label className={styles.field}>
            <span>เวลาสิ้นสุด</span>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>
        </div>

        <div className={styles.field}>
          <span>สถานที่</span>
          <PlaceInput value={place} onChange={setPlace} suggestions={L.places ?? []} inputClassName="" />
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.h2}>ผู้ปฏิบัติงาน</h2>
        <p className={styles.hint}>เลือกคน แล้วแตะหน้าที่ได้หลายอย่าง — ได้การ์ดใบเดียว กดรับทราบครั้งเดียว</p>
        {rows.map((r, i) => (
          <div key={i} className={styles.person}>
          <div className={styles.row}>
            <select value={r.personId} onChange={(e) => setRow(i, { personId: e.target.value })} aria-label="ผู้ปฏิบัติงาน">
              <option value="">— เลือกคน —</option>
              {L.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {rows.length > 1 ? (
              <button type="button" className={styles.remove} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label="ลบแถว">
                ✕
              </button>
            ) : null}
          </div>
          <RoleChips roles={L.roles} selected={r.roleIds} onChange={(ids) => setRow(i, { roleIds: ids })} idPrefix={`liff-${i}`} />
          </div>
        ))}
        <button type="button" className={styles.add} onClick={() => setRows((rs) => [...rs, { personId: "", roleIds: [] }])}>
          + เพิ่มคน
        </button>
      </section>

      <section className={styles.card}>
        <label className={styles.field}>
          <span>หมายเหตุบนจอทีวี</span>
          <textarea value={shortNote} onChange={(e) => setShortNote(e.target.value)} rows={2} maxLength={500} placeholder="ไม่บังคับ" />
        </label>
      </section>

      <section className={styles.card}>
        <AttachmentPicker
          key={pickerKey}
          authHeader={() => `Bearer ${token()}`}
          onChange={(staged, busy) => setFiles({ staged, busy })}
        />
      </section>

      <div className={styles.footer}>
        {/* In the fixed footer, so the message is on screen right where the button was tapped. */}
        {error ? <p className={styles.err}>{error}</p> : null}
        <p className={styles.quota}>
          {filled.length > 0
            ? `เผยแพร่ = ส่งการ์ดแจ้งงาน ${filled.length} คน (ใช้โควต้า LINE ${filled.length} ข้อความ) · บันทึกร่าง = ยังไม่แจ้งใคร`
            : "ยังไม่ได้เลือกผู้ปฏิบัติงาน — เผยแพร่ได้ แต่จะไม่มีใครได้รับแจ้ง"}
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} disabled={saving !== null} onClick={() => save(false)}>
            {saving === "draft" ? "กำลังบันทึก…" : "บันทึกร่าง"}
          </button>
          <button type="button" className={styles.primary} disabled={saving !== null} onClick={() => save(true)}>
            {saving === "publish" ? "กำลังเผยแพร่…" : "เผยแพร่"}
          </button>
        </div>
      </div>
    </main>
  );
}
