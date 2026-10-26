// LINE quota bar for admins (owner, 26 Oct 2026): used / left this month,
// split by kind, with a month-end forecast. Server component, no JS.

import Link from "next/link";
import type { QuotaView } from "@/lib/notifications/quota-view";

const SEGMENT_COLOR: Record<string, string> = {
  critical: "var(--blue)",
  reminder: "var(--amber)",
  low: "var(--muted)",
  other: "#9aa0a6",
};

const TONE_TEXT: Record<QuotaView["tone"], string> = {
  ok: "✅ พอทั้งเดือน",
  warn: "⚠️ ใช้เร็ว อาจไม่พอถึงสิ้นเดือน",
  danger: "⛔ ไม่พอถึงสิ้นเดือน — ระบบกันโควต้าไว้ให้การ์ดงานก่อน",
};

export function QuotaBar({ q, href }: { q: QuotaView; href?: string }) {
  const total = q.limit ?? Math.max(q.used, 1);
  const body = (
    <>
      <div className="quota-head">
        <strong>📨 โควต้า LINE {q.monthLabel}</strong>
        <span className="quota-num">
          {q.used}
          {q.limit !== null ? ` / ${q.limit}` : ""} ข้อความ
        </span>
      </div>
      <div
        className="quota-track"
        role="meter"
        aria-label="ใช้โควต้า LINE เดือนนี้"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={q.used}
      >
        {q.segments
          .filter((s) => s.count > 0)
          .map((s) => (
            <span
              key={s.key}
              className="quota-seg"
              style={{ width: `${Math.min(100, (s.count / total) * 100)}%`, background: SEGMENT_COLOR[s.key] }}
              title={`${s.label} ${s.count}`}
            />
          ))}
      </div>
      <ul className="quota-legend">
        {q.segments
          .filter((s) => s.key !== "other" || s.count > 0)
          .map((s) => (
            <li key={s.key}>
              <i style={{ background: SEGMENT_COLOR[s.key] }} aria-hidden="true" />
              {s.label} {s.count}
            </li>
          ))}
      </ul>
      <p className={`quota-foot quota-${q.tone}`}>
        {q.remaining !== null ? `เหลือ ${q.remaining} · ` : "ไม่จำกัดโควต้า · "}
        คาดสิ้นเดือน ~{q.forecast} · {TONE_TEXT[q.tone]}
        {q.source === "system" ? " · (นับจากระบบ — อ่านตัวเลขจาก LINE ไม่ได้)" : ""}
      </p>
      <p className="quota-note">นับเฉพาะข้อความที่บอทส่งหาเอง 1 คน = 1 ข้อความ · กดปุ่ม/พิมพ์ถามบอท ไม่นับ</p>
    </>
  );
  return href ? (
    <Link href={href} className="panel quota-bar quota-link">
      {body}
    </Link>
  ) : (
    <section className="panel quota-bar" aria-label="โควต้า LINE">
      {body}
    </section>
  );
}
