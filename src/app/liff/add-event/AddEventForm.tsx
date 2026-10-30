"use client";

// The phone form for one job, inside Telegram (Mini App) or LINE (LIFF).
// New job: fill in → save as draft or publish. Edit (owner, 30 Oct 2026):
// opened from รายการงาน with the job filled in → save; a changed date / time /
// place sends the team the orange change card. Every call to /api/liff/*
// carries Telegram's initData or LINE's ID token (src/lib/liff/auth.ts).

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconPicker } from "@/components/IconPicker";
import styles from "./add-event.module.css";
import { AttachmentPicker } from "@/components/AttachmentPicker";
import { PlaceInput } from "@/components/PlaceInput";
import { RoleChips } from "@/components/RoleChips";
import type { StagedAttachment } from "@/lib/attachments/rules";
import { useMiniApp, type Host } from "./host";

type Option = { id: string; name: string };
type Person = Option & { position: string | null; avatar: string };
type Lists = { me: Option; people: Person[]; roles: Option[]; places: string[] };
type Row = { personId: string; roleIds: string[] };
type Job = {
  id: string;
  status: string;
  onHold: boolean;
  title: string;
  eventDate: string;
  startTime: string;
  endTime: string | null;
  place: string;
  shortNote: string;
  screenTitle: string;
  icon: string;
  assignees: Row[];
  attachmentCount: number;
};

/** รายการงาน in the same app: /liff/add-event/jobs (LIFF maps liff.line.me/<id>/jobs here). */
function jobsHref(): string {
  if (typeof window === "undefined") return "jobs";
  const tg = new URLSearchParams(window.location.search).get("tg") === "1";
  return `/liff/add-event/jobs${tg ? "?tg=1" : ""}`;
}

function bangkokDate(offsetDays = 0): string {
  const d = new Date(Date.now() + 7 * 3600 * 1000 + offsetDays * 86400 * 1000);
  return d.toISOString().slice(0, 10);
}

type Phase =
  | { kind: "loading"; text: string }
  | { kind: "error"; text: string }
  | { kind: "form" }
  | { kind: "done"; published: boolean; notified: number; title: string; edited: boolean; eventId: string | null };

export function AddEventForm({
  liffId = "",
  host: given,
  editId,
  onClose,
}: {
  liffId?: string;
  /** Already started by รายการงาน; otherwise this page starts Telegram / LINE itself. */
  host?: Host;
  /** Edit this job instead of adding one. */
  editId?: string;
  /** Back to รายการงาน (shown as "← รายการงาน"). */
  onClose?: (changed: boolean) => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading", text: "กำลังเปิดฟอร์ม…" });
  const started = useMiniApp(liffId, Boolean(given));
  const host = given ?? started.host;
  const [job, setJob] = useState<Job | null>(null);
  const [reason, setReason] = useState("");
  const [lists, setLists] = useState<Lists | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);

  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState(bangkokDate(1));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("");
  const [place, setPlace] = useState("");
  const [shortNote, setShortNote] = useState("");
  const [screenTitle, setScreenTitle] = useState("");
  const [icon, setIcon] = useState("");
  const [announce, setAnnounce] = useState("");
  const [rows, setRows] = useState<Row[]>([{ personId: "", roleIds: [] }]);
  const [files, setFiles] = useState<{ staged: StagedAttachment[]; busy: boolean }>({ staged: [], busy: false });
  const [pickerKey, setPickerKey] = useState(0);

  const auth = useCallback(() => host?.auth() ?? "", [host]);

  useEffect(() => {
    if (started.error) setPhase({ kind: "error", text: started.error });
  }, [started.error]);

  useEffect(() => {
    if (!host) return;
    let cancelled = false;
    (async () => {
      try {
        setPhase({ kind: "loading", text: editId ? "กำลังโหลดงาน…" : "กำลังโหลดรายชื่อทีมงาน…" });
        const headers = { Authorization: host.auth() };
        const [res, jobRes] = await Promise.all([
          fetch("/api/liff/options", { headers }),
          editId ? fetch(`/api/liff/events/${editId}`, { headers }) : Promise.resolve(null),
        ]);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "โหลดข้อมูลไม่สำเร็จ");
        if (jobRes) {
          const j = await jobRes.json();
          if (!jobRes.ok) throw new Error(j.error ?? "โหลดงานไม่สำเร็จ");
          if (cancelled) return;
          const jj = j as Job;
          setJob(jj);
          setTitle(jj.title);
          setEventDate(jj.eventDate);
          setStartTime(jj.startTime || "09:00");
          setEndTime(jj.endTime ?? "");
          setPlace(jj.place);
          setShortNote(jj.shortNote);
          setScreenTitle(jj.screenTitle);
          setIcon(jj.icon);
          setRows(jj.assignees.length ? jj.assignees : [{ personId: "", roleIds: [] }]);
        }
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
  }, [host, editId]);

  const filled = useMemo(() => rows.filter((r) => r.personId && r.roleIds.length > 0), [rows]);
  const halfRow = rows.some((r) => (r.personId && r.roleIds.length === 0) || (!r.personId && r.roleIds.length > 0));

  function setRow(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function reset() {
    setTitle("");
    setEndTime("");
    setShortNote("");
    setScreenTitle("");
    setAnnounce("");
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
      const res = await fetch(editId ? `/api/liff/events/${editId}` : "/api/liff/events", {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: auth() },
        body: JSON.stringify({ title, eventDate, startTime, endTime: endTime || null, locationText: place.trim() || null, shortNote, screenTitle, icon, announce, assignees: filled, attachments: files.staged, publish, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "บันทึกไม่สำเร็จ");
      host?.buzz(true);
      setPhase({ kind: "done", published: editId ? Boolean(data.published) : publish, notified: data.notified ?? 0, title: title.trim(), edited: Boolean(editId), eventId: editId ?? data.eventId ?? null });
    } catch (e) {
      host?.buzz(false);
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
    const head = phase.edited ? "บันทึกการแก้ไขแล้ว" : phase.published ? "เผยแพร่งานแล้ว" : "บันทึกร่างแล้ว";
    const note = phase.edited
      ? phase.notified > 0
        ? `แจ้งทีม ${phase.notified} คนแล้ว (การ์ดสีส้ม/การ์ดงาน)`
        : phase.published
          ? "ไม่มีอะไรที่ต้องแจ้งทีม"
          : "ยังเป็นร่าง ยังไม่แจ้งใคร"
      : phase.published
        ? phase.notified > 0
          ? `ส่งการ์ดแจ้งงานให้ผู้ปฏิบัติงาน ${phase.notified} คนแล้ว`
          : "ยังไม่มีผู้ปฏิบัติงาน · เพิ่มคนได้ที่ ✏️ แก้ไข ในรายการงาน"
        : "ยังไม่แจ้งใคร · เผยแพร่ได้จากรายการงานเมื่อพร้อม";
    return (
      <main className={styles.page}>
        <div className={`${styles.card} ${styles.done}`}>
          <div className={styles.tick}>✓</div>
          <h1 className={styles.h1}>{head}</h1>
          <p className={styles.doneTitle}>{phase.title}</p>
          <p className={styles.muted}>{note}</p>
          <div className={styles.actions}>
            {onClose ? (
              <button type="button" className={styles.secondary} onClick={() => onClose(true)}>
                📋 รายการงาน
              </button>
            ) : (
              <button type="button" className={styles.secondary} onClick={reset}>
                เพิ่มงานอีก
              </button>
            )}
            {host?.inClient ? (
              <button type="button" className={styles.primary} onClick={() => host.close()}>
                ปิด
              </button>
            ) : null}
          </div>
          {!onClose ? (
            <p className={styles.muted} style={{ marginTop: 14 }}>
              <a href={jobsHref()} className={styles.link}>
                📋 ดู / แก้ไข รายการงานทั้งหมด
              </a>
            </p>
          ) : null}
        </div>
      </main>
    );
  }

  const L = lists!;
  return (
    <main className={styles.page}>
      <header className={styles.head}>
        {onClose ? (
          <button type="button" className={styles.back} onClick={() => onClose(false)}>
            ← รายการงาน
          </button>
        ) : (
          <a href={jobsHref()} className={styles.topLink}>
            📋 รายการงาน
          </a>
        )}
        <h1 className={styles.h1}>{job ? "✏️ แก้ไขงาน" : "เพิ่มงานใหม่"}</h1>
        <p className={styles.muted}>
          {job
            ? job.status === "published"
              ? "เผยแพร่แล้ว · แก้วัน เวลา สถานที่ → ทีมได้การ์ดสีส้ม กดรับทราบใหม่"
              : job.onHold
                ? "⏸️ เลื่อนออกไปก่อน · ใส่วันใหม่แล้วกด เผยแพร่อีกครั้ง"
                : "ร่าง · ยังไม่แจ้งใคร"
            : `โดย ${L.me.name}`}
        </p>
      </header>

      <section className={styles.card}>
        <label className={styles.field}>
          <span>ชื่องาน *</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น ถ่ายภาพประชุมสภา" maxLength={200} />
          {title.trim().length > 28 ? (
            <input
              value={screenTitle}
              onChange={(e) => setScreenTitle(e.target.value)}
              placeholder="ชื่อยาว ใส่ชื่อสั้นบนจอทีวีได้ (ไม่บังคับ)"
              maxLength={60}
              style={{ marginTop: 8 }}
            />
          ) : null}
        </label>
        {title.trim() ? (
          <div className={styles.field}>
            <span>ไอคอนงาน</span>
            <IconPicker name="liff-icon" title={title} defaultValue={icon} onChange={setIcon} />
          </div>
        ) : null}

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
        <label className={styles.field}>
          <span>📢 ประกาศบนจอทีวี (ตัววิ่ง ถึงเที่ยงคืน)</span>
          <input value={announce} onChange={(e) => setAnnounce(e.target.value)} maxLength={140} placeholder="ไม่บังคับ" />
        </label>
      </section>

      <section className={styles.card}>
        {job && job.attachmentCount > 0 ? <p className={styles.hint}>📎 มีไฟล์แนบแล้ว {job.attachmentCount} ไฟล์ · เพิ่มได้อีก</p> : null}
        <AttachmentPicker
          key={pickerKey}
          authHeader={auth}
          onChange={(staged, busy) => setFiles({ staged, busy })}
        />
      </section>

      {job?.status === "published" ? (
        <section className={styles.card}>
          <label className={styles.field}>
            <span>เหตุผลที่แก้ (ขึ้นบนการ์ดสีส้มให้ทีมเห็น)</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="เช่น ผู้บริหารเลื่อนเวลา · ไม่บังคับ" />
          </label>
        </section>
      ) : null}

      <div className={styles.footer}>
        {/* In the fixed footer, so the message is on screen right where the button was tapped. */}
        {error ? <p className={styles.err}>{error}</p> : null}
        <p className={styles.quota}>
          {job?.status === "published"
            ? "บันทึก = แจ้งเฉพาะคนที่เกี่ยว (เปลี่ยนวัน/เวลา/สถานที่/หน้าที่ · เพิ่มคน · ถอนชื่อ)"
            : filled.length > 0
              ? `เผยแพร่ = ส่งการ์ดแจ้งงาน ${filled.length} คน · บันทึกร่าง = ยังไม่แจ้งใคร`
              : "ยังไม่ได้เลือกผู้ปฏิบัติงาน — เผยแพร่ได้ แต่จะไม่มีใครได้รับแจ้ง"}
        </p>
        {job?.status === "published" ? (
          <div className={styles.actionsOne}>
            <button type="button" className={styles.primary} disabled={saving !== null} onClick={() => save(true)}>
              {saving ? "กำลังบันทึก…" : "💾 บันทึกการแก้ไข"}
            </button>
          </div>
        ) : (
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} disabled={saving !== null} onClick={() => save(false)}>
              {saving === "draft" ? "กำลังบันทึก…" : "บันทึกร่าง"}
            </button>
            <button type="button" className={styles.primary} disabled={saving !== null} onClick={() => save(true)}>
              {saving === "publish" ? "กำลังเผยแพร่…" : job?.onHold ? "เผยแพร่อีกครั้ง" : "เผยแพร่"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
