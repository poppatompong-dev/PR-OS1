"use client";

// รายการงาน on the phone: every job from yesterday to 60 days ahead, grouped by
// day, colour by state (green = sent to the team, dashed = draft, orange = on
// hold, red = cancelled). Tap a job → one sheet with what you can do with it.
// "+ เพิ่มงาน" opens the same form as before.

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "../add-event.module.css";
import { useMiniApp } from "../host";
import { AddEventForm } from "../AddEventForm";
import { formatThaiDate } from "@/lib/format";

type Job = {
  id: string;
  title: string;
  icon: string;
  eventDate: string;
  startTime: string;
  endTime: string | null;
  place: string | null;
  status: "draft" | "published" | "canceled" | "completed";
  onHold: boolean;
  hasChanges: boolean;
  people: Array<{ name: string; ack: boolean; unavailable: boolean }>;
  mine: boolean;
  canManage: boolean;
};

type Tab = "upcoming" | "today" | "drafts" | "mine" | "past";
const TABS: Array<[Tab, string]> = [
  ["upcoming", "ทั้งหมด"],
  ["today", "วันนี้"],
  ["drafts", "ร่าง / เลื่อน"],
  ["mine", "ที่ฉันสั่ง"],
  ["past", "เมื่อวาน · ยกเลิก"],
];

function bangkokDate(offset = 0): string {
  return new Date(Date.now() + 7 * 3600 * 1000 + offset * 86400 * 1000).toISOString().slice(0, 10);
}

const short = (name: string) => name.replace(/^(นางสาว|นาง|นาย|น\.ส\.|ดร\.)\s*/, "").split(/\s+/)[0];

function stateOf(j: Job): "published" | "draft" | "hold" | "canceled" {
  if (j.status === "canceled") return "canceled";
  if (j.onHold) return "hold";
  return j.status === "draft" ? "draft" : "published";
}

function dayLabel(date: string): string {
  const today = bangkokDate(0);
  if (date === today) return `วันนี้ · ${formatThaiDate(date)}`;
  if (date === bangkokDate(1)) return `พรุ่งนี้ · ${formatThaiDate(date)}`;
  if (date === bangkokDate(-1)) return `เมื่อวาน · ${formatThaiDate(date)}`;
  return formatThaiDate(date);
}

type View = { kind: "list" } | { kind: "form"; editId?: string };

export function JobsView({ liffId }: { liffId: string }) {
  const { host, error: startError } = useMiniApp(liffId);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Job | null>(null);
  const [ask, setAsk] = useState<null | "postpone" | "cancel">(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: "list" });

  const load = useCallback(async () => {
    if (!host) return;
    try {
      const res = await fetch("/api/liff/jobs", { headers: { Authorization: host.auth() } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "โหลดรายการงานไม่สำเร็จ");
      setJobs(data.jobs as Job[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดรายการงานไม่สำเร็จ");
    }
  }, [host]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const today = bangkokDate(0);
  const counts = useMemo(() => {
    const list = jobs ?? [];
    return {
      upcoming: list.filter((j) => j.eventDate >= today && j.status !== "canceled").length,
      today: list.filter((j) => j.eventDate === today && j.status !== "canceled").length,
      drafts: list.filter((j) => j.status === "draft").length,
      mine: list.filter((j) => j.mine && j.eventDate >= today).length,
      past: list.filter((j) => j.eventDate < today || j.status === "canceled").length,
    } as Record<Tab, number>;
  }, [jobs, today]);

  const shown = useMemo(() => {
    const list = jobs ?? [];
    const k = q.trim().toLowerCase();
    return list
      .filter((j) => {
        if (tab === "upcoming") return j.eventDate >= today && j.status !== "canceled";
        if (tab === "today") return j.eventDate === today && j.status !== "canceled";
        if (tab === "drafts") return j.status === "draft";
        if (tab === "mine") return j.mine && j.eventDate >= today;
        return j.eventDate < today || j.status === "canceled";
      })
      .filter((j) => !k || `${j.title} ${j.place ?? ""} ${j.people.map((p) => p.name).join(" ")}`.toLowerCase().includes(k));
  }, [jobs, tab, q, today]);

  const groups = useMemo(() => {
    const m = new Map<string, Job[]>();
    for (const j of shown) m.set(j.eventDate, [...(m.get(j.eventDate) ?? []), j]);
    return [...m];
  }, [shown]);

  async function act(action: "publish" | "postpone" | "cancel" | "delete") {
    if (!host || !open) return;
    if (action === "delete" && !(await host.confirm(`ลบร่าง "${open.title}" ?`))) return;
    if (action === "publish" && !(await host.confirm(`เผยแพร่ "${open.title}" ส่งการ์ดให้ทีม ${open.people.length} คน ?`))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/liff/events/${open.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: host.auth() },
        body: JSON.stringify({ action, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ทำไม่สำเร็จ");
      host.buzz(true);
      setToast(`✓ ${data.message}`);
      setOpen(null);
      setAsk(null);
      setReason("");
      await load();
    } catch (e) {
      host.buzz(false);
      setToast(`⚠️ ${e instanceof Error ? e.message : "ทำไม่สำเร็จ"}`);
    } finally {
      setBusy(false);
    }
  }

  if (view.kind === "form" && host) {
    return (
      <AddEventForm
        host={host}
        editId={view.editId}
        onClose={(changed) => {
          setView({ kind: "list" });
          if (changed) void load();
        }}
      />
    );
  }

  if (startError || (error && !jobs)) {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.h1}>เปิดรายการงานไม่ได้</h1>
          <p className={styles.err}>{startError ?? error}</p>
        </div>
      </main>
    );
  }
  if (!jobs) {
    return (
      <main className={styles.page}>
        <p className={styles.center}>กำลังโหลดรายการงาน…</p>
      </main>
    );
  }

  const o = open;
  const st = o ? stateOf(o) : null;
  return (
    <main className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.titleRow}>
          <h1 className={styles.h1}>📋 รายการงาน</h1>
          <span className={styles.muted} style={{ margin: 0 }}>
            {counts.upcoming} งานข้างหน้า
          </span>
        </div>
        <input className={styles.search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 ค้นชื่องาน สถานที่ หรือชื่อคน" />
        <div className={styles.tabs} role="tablist">
          {TABS.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? styles.tabOn : styles.tab} onClick={() => setTab(k)}>
              {label}
              <b>{counts[k]}</b>
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <p className={styles.empty}>{q ? "ไม่พบงานที่ค้น" : tab === "drafts" ? "ไม่มีงานร่าง 👍" : "ยังไม่มีงาน · กด ＋ เพิ่มงาน"}</p>
      ) : (
        groups.map(([date, list]) => (
          <section key={date}>
            <h2 className={styles.day}>{dayLabel(date)}</h2>
            {list.map((j) => {
              const s = stateOf(j);
              const acked = j.people.filter((p) => p.ack).length;
              return (
                <button key={j.id} type="button" className={styles.job} data-status={s} onClick={() => setOpen(j)}>
                  <span className={styles.jobIcon} aria-hidden>
                    {j.icon}
                  </span>
                  <span>
                    <p className={styles.jobTitle}>{j.title}</p>
                    <span className={styles.jobMeta}>
                      🕘 {j.endTime ? `${j.startTime}–${j.endTime}` : j.startTime} น.{j.place ? ` · 📍 ${j.place}` : ""}
                      <br />
                      👥 {j.people.length ? j.people.map((p) => `${p.unavailable ? "⛔" : p.ack ? "✅" : "⏳"}${short(p.name)}`).join("  ") : "ยังไม่มีคน"}
                    </span>
                    <span className={styles.pills}>
                      {s === "published" ? (
                        <span className={styles.pillGreen}>
                          ส่งทีมแล้ว · รับทราบ {acked}/{j.people.length}
                        </span>
                      ) : null}
                      {s === "draft" ? <span className={styles.pillDraft}>ร่าง · ยังไม่แจ้งใคร</span> : null}
                      {s === "hold" ? <span className={styles.pillHold}>⏸️ เลื่อนออกไปก่อน</span> : null}
                      {s === "canceled" ? <span className={styles.pillRed}>ยกเลิกแล้ว</span> : null}
                      {j.hasChanges && s === "published" ? <span className={styles.pill}>มีการแก้ไข</span> : null}
                      {j.mine ? <span className={styles.pill}>ฉันสั่ง</span> : null}
                    </span>
                  </span>
                </button>
              );
            })}
          </section>
        ))
      )}

      <button type="button" className={styles.fab} onClick={() => setView({ kind: "form" })}>
        ＋ เพิ่มงาน
      </button>

      {toast ? (
        <div className={styles.footer} style={{ bottom: 86, left: 16, right: 16, borderRadius: 14, border: "1px solid var(--line)" }} role="status">
          <p className={styles.quota} style={{ margin: 0, fontSize: 15, color: "var(--text)" }}>
            {toast}
          </p>
        </div>
      ) : null}

      {o && st ? (
        <div className={styles.sheetBack} onClick={() => (busy ? null : (setOpen(null), setAsk(null), setReason("")))}>
          <div className={styles.sheet} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={o.title}>
            <div className={styles.grab} />
            <h2 className={styles.h2} style={{ fontSize: 18 }}>
              {o.icon} {o.title}
            </h2>
            <p className={styles.muted}>
              🗓 {formatThaiDate(o.eventDate)} · {o.endTime ? `${o.startTime}–${o.endTime}` : o.startTime} น.{o.place ? ` · 📍 ${o.place}` : ""}
            </p>
            {o.people.length ? (
              <div className={styles.who}>
                {o.people.map((p) => (
                  <span key={p.name}>
                    {p.unavailable ? "⛔" : p.ack ? "✅" : "⏳"} {short(p.name)}
                  </span>
                ))}
              </div>
            ) : null}

            {!o.canManage ? (
              <p className={styles.hint} style={{ marginTop: 12 }}>
                🔒 แก้ได้เฉพาะคนที่สั่งงานนี้ · งานอื่นแจ้งแอดมินครับ
              </p>
            ) : ask ? (
              <>
                <label className={styles.field} style={{ marginTop: 12 }}>
                  <span>{ask === "cancel" ? "เหตุผลที่ยกเลิก *" : "เหตุผลที่เลื่อน *"} (ทีมจะเห็นบนการ์ด)</span>
                  <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder={ask === "cancel" ? "เช่น ผู้บริหารยกเลิกกิจกรรม" : "เช่น รอผู้บริหารยืนยันวันใหม่"} />
                </label>
                <div className={styles.actions}>
                  <button type="button" className={styles.secondary} disabled={busy} onClick={() => (setAsk(null), setReason(""))}>
                    ย้อนกลับ
                  </button>
                  <button type="button" className={styles.primary} style={ask === "cancel" ? { background: "var(--red)" } : undefined} disabled={busy || !reason.trim()} onClick={() => act(ask)}>
                    {busy ? "กำลังส่ง…" : ask === "cancel" ? "ยืนยันยกเลิกงาน" : "ยืนยันเลื่อน"}
                  </button>
                </div>
              </>
            ) : (
              <>
                {st !== "canceled" ? (
                  <button type="button" className={styles.sheetBtn} onClick={() => (setOpen(null), setView({ kind: "form", editId: o.id }))}>
                    ✏️
                    <span>
                      แก้ไขงาน
                      <small>ชื่อ วัน เวลา สถานที่ คน หน้าที่ ไฟล์</small>
                    </span>
                  </button>
                ) : null}
                {st === "draft" || st === "hold" ? (
                  <button type="button" className={styles.sheetBtn} disabled={busy} onClick={() => act("publish")}>
                    📢
                    <span>
                      {st === "hold" ? "เผยแพร่อีกครั้ง" : "เผยแพร่"}
                      <small>{st === "hold" ? "ทีมได้การ์ดสีส้ม กดรับทราบวันใหม่" : `ส่งการ์ดงานให้ ${o.people.length} คน`}</small>
                    </span>
                  </button>
                ) : null}
                {st === "published" ? (
                  <button type="button" className={styles.sheetBtn} onClick={() => setAsk("postpone")}>
                    ⏸️
                    <span>
                      เลื่อนออกไปก่อน
                      <small>ยังไม่มีวันใหม่ · ลงจากจอทีวี แจ้งทีม</small>
                    </span>
                  </button>
                ) : null}
                {st === "published" || st === "hold" ? (
                  <button type="button" className={styles.sheetDanger} onClick={() => setAsk("cancel")}>
                    ✖️
                    <span>
                      ยกเลิกงาน
                      <small>แจ้งทุกคนในงานว่าไม่ต้องไป</small>
                    </span>
                  </button>
                ) : null}
                {st === "draft" ? (
                  <button type="button" className={styles.sheetDanger} disabled={busy} onClick={() => act("delete")}>
                    🗑
                    <span>
                      ลบร่าง
                      <small>ยังไม่เคยแจ้งใคร · ลบทิ้งได้เลย</small>
                    </span>
                  </button>
                ) : null}
              </>
            )}
            <button type="button" className={styles.secondary} style={{ width: "100%", marginTop: 12 }} disabled={busy} onClick={() => (setOpen(null), setAsk(null), setReason(""))}>
              ปิด
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
