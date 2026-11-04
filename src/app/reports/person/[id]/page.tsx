// ใบสรุปผลการปฏิบัติงานรายบุคคล ประกอบการประเมิน — A4 หน้าเดียว (owner, 4 Nov 2026 · แบบ C).
// Opened from /reports → รายบุคคล → "📄 ใบสรุป". Print it or save as PDF from the
// browser. No AppShell on purpose (like /reports/print): nothing but the paper.
// Range: ?preset=appraisal-1|appraisal-2|… or ?from&to; default = the round today is in.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { can, getSessionUser } from "@/lib/auth/roles";
import { isSupabaseConfigured } from "@/lib/env";
import { appraisalRoundOf, isIsoDate, resolveRange, safeRange, todayInBangkok, type RangePreset } from "@/lib/date";
import { formatThaiDate } from "@/lib/format";
import { avatarUrl, DEFAULT_AVATAR } from "@/lib/avatars";
import { computePersonSheet, loadPersonSheet, type PersonSheet, type SheetPerson } from "@/lib/reports/person-sheet";
import { PrintButton } from "../../print/PrintButton";
import "./person-sheet.css";

export const dynamic = "force-dynamic";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const PRESETS: RangePreset[] = ["this-month", "this-quarter", "fiscal-year", "last-12-months", "appraisal-1", "appraisal-2"];
const UNIT = "ฝ่ายบริการและเผยแพร่วิชาการ กองยุทธศาสตร์และงบประมาณ";

const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "2-digit" }).format(new Date(`${iso}T00:00:00+07:00`));

const nowInBangkok = () =>
  new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "long", timeStyle: "short" }).format(new Date());

function Bars({ months, avg }: { months: PersonSheet["months"]; avg: number | null }) {
  const w = 330;
  const h = 96;
  const mx = Math.max(1, ...months.map((m) => m.count), avg ?? 0) * 1.18;
  const bw = w / Math.max(1, months.length);
  const ay = avg === null ? null : h - (h * avg) / mx + 14;
  return (
    <svg width={w} height={h + 34} viewBox={`0 0 ${w} ${h + 34}`} role="img" aria-label="จำนวนงานรายเดือน">
      {months.map((m, i) => {
        const bh = (h * m.count) / mx;
        const x = i * bw + bw * 0.18;
        return (
          <g key={m.key}>
            <rect x={x} y={h - bh + 14} width={bw * 0.64} height={Math.max(bh, 1)} rx={4} fill="#8a4fa6" />
            <text x={x + bw * 0.32} y={h - bh + 9} textAnchor="middle" fontSize={12} fontWeight={700} fill="#3d1f52">
              {m.count}
            </text>
            <text x={x + bw * 0.32} y={h + 30} textAnchor="middle" fontSize={11.5} fill="#666">
              {m.label}
            </text>
          </g>
        );
      })}
      {ay !== null ? (
        <>
          <line x1={0} x2={w} y1={ay} y2={ay} stroke="#999" strokeDasharray="4 4" />
          <text x={w} y={ay - 4} textAnchor="end" fontSize={10.5} fill="#888">
            {avg}
          </text>
        </>
      ) : null}
    </svg>
  );
}

function HBars({ rows, color }: { rows: Array<{ name: string; count: number }>; color: string }) {
  if (!rows.length) return <p className="ps-empty">—</p>;
  const mx = Math.max(...rows.map((r) => r.count));
  return (
    <div className="ps-hbars">
      {rows.map((r) => (
        <div className="ps-hb" key={r.name}>
          <span>{r.name}</span>
          <i style={{ width: `${Math.round((r.count / mx) * 100)}%`, background: color }} />
          <b>{r.count}</b>
        </div>
      ))}
    </div>
  );
}

/** Fixture for demo mode (no database): fictional person, fictional numbers. */
function demoSheet(from: string, to: string): { person: SheetPerson; sheet: PersonSheet } {
  const months = [8, 14, 12, 9, 8, 11];
  const start = Number(from.slice(5, 7));
  const jobs = months.flatMap((n, i) => {
    const m = ((start - 1 + i) % 12) + 1;
    const y = Number(from.slice(0, 4)) + (start - 1 + i >= 12 ? 1 : 0);
    return Array.from({ length: n }, (_, k) => ({
      eventId: `${i}-${k}`,
      title: ["ประชุมสภาเทศบาล", "มอบเสื้อกีฬา", "ประเพณีลอยกระทง", "วันครูแห่งชาติ", "ตรุษจีนนครสวรรค์"][k % 5],
      date: `${y}-${String(m).padStart(2, "0")}-${String(3 + (k % 24)).padStart(2, "0")}`,
      start: k % 6 === 0 ? "17:00" : "09:00",
      end: k % 6 === 0 ? "20:00" : "11:30",
      urgent: k % 7 === 0,
      dept: ["สำนักปลัด", "กองการศึกษา", "กองสาธารณสุขฯ", "กองช่าง"][k % 4],
      people: 1 + (k % 4),
      roles: k % 3 === 0 ? ["ช่างภาพนิ่ง", "ทำข่าว / ข้อมูล"] : ["ช่างภาพนิ่ง"],
      sentAt: "2026-11-01T02:00:00Z",
      ackAt: k % 25 === 24 ? null : `2026-11-01T02:0${k % 9}:00Z`,
      unreached: false,
      helped: k === 2,
      attachments: 2,
    }));
  });
  return {
    person: { id: "demo", name: "นายตัวอย่าง รักงานดี", position: "นักประชาสัมพันธ์ปฏิบัติการ", avatarOff: false },
    sheet: computePersonSheet({ from, to, jobs, selfAdded: 5, teamJobs: [62, 48, 40, 51, 39], badges: [{ month: from.slice(0, 7), badges: ["job10", "fast"] }] }),
  };
}

export default async function PersonSheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; preset?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const live = isSupabaseConfigured();

  const supabase = live ? await createClient() : null;
  const user = supabase ? await getSessionUser(supabase) : null;
  if (live) {
    if (!user) redirect("/login");
    if (!can.viewReports(user.role)) redirect("/?error=" + encodeURIComponent("บัญชีของคุณไม่มีสิทธิ์ดูรายงาน"));
  }

  const today = todayInBangkok();
  const preset = PRESETS.includes(sp.preset as RangePreset) ? (sp.preset as RangePreset) : null;
  // Default: the appraisal round today is in.
  const month = Number(today.slice(5, 7));
  const fallback = resolveRange(month >= 10 || month <= 3 ? "appraisal-1" : "appraisal-2", today);
  const base = preset ? resolveRange(preset, today) : null;
  const { from, to } = safeRange(base?.from ?? sp.from, base?.to ?? sp.to, fallback.from, isIsoDate(sp.from) && !sp.to ? today : fallback.to);

  const data = live ? await loadPersonSheet(createAdminClient(), id, from, to) : demoSheet(from, to);
  if (!data) redirect("/reports?tab=person&error=" + encodeURIComponent("ไม่พบบุคลากรนี้"));
  const { person, sheet: s } = data;

  if (supabase && user) {
    await supabase.from("audit_logs").insert({
      entity_type: "report",
      entity_id: NIL_UUID,
      action: "export",
      changed_by: user.id,
      summary: `เปิดใบสรุปรายบุคคล ${person.name} ช่วง ${from} ถึง ${to}`,
      new_values: { format: "person_sheet", person_id: person.id, from, to },
    });
  }

  const round = appraisalRoundOf(from, to);
  const avatar = person.avatarOff ? null : live ? avatarUrl(person.id) : DEFAULT_AVATAR;
  const pct = s.ackRate === null ? "—" : `${Math.round(s.ackRate * 100)}%`;
  const backHref = `/reports?${preset ? `preset=${preset}` : `from=${from}&to=${to}`}&tab=person`;

  return (
    <main className="ps-wrap">
      <div className="ps-toolbar">
        <Link className="button secondary" href={backHref}>
          กลับหน้ารายงาน
        </Link>
        <PrintButton />
      </div>

      <article className="ps-page">
        <header className="ps-hd">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/seal-2569.png" alt="ตราเทศบาลนครนครสวรรค์" />
          <div>
            <h1>สรุปผลการปฏิบัติงานรายบุคคล ประกอบการประเมิน</h1>
            <p>เทศบาลนครนครสวรรค์ · {UNIT}</p>
          </div>
          <div className="ps-round">
            {round ? round.label : "ช่วงที่เลือก"}
            <span>
              {shortDate(from)} – {shortDate(to)}
            </span>
          </div>
        </header>

        <section className="ps-who">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" />
          ) : (
            <span className="ps-noface">{person.name.replace(/^(นางสาว|นาย|นาง)/, "").slice(0, 2)}</span>
          )}
          <div>
            <b>{person.name}</b>
            <span>{person.position || "—"}</span>
          </div>
        </section>

        <section className="ps-grid4">
          <div>
            <b>{s.jobs}</b>
            <span>งานที่ปฏิบัติ</span>
            {s.teamAvgJobs !== null ? <em>ค่าเฉลี่ยทีม {s.teamAvgJobs}</em> : null}
          </div>
          <div>
            <b>{s.hours}</b>
            <span>ชั่วโมงปฏิบัติงาน</span>
            {s.untimed ? <em className="dim">+ ไม่ระบุเวลาจบ {s.untimed} งาน</em> : null}
          </div>
          <div>
            <b>
              {s.afterHours}+{s.weekend}
            </b>
            <span>นอกเวลา + วันหยุด (งาน)</span>
            <em>{s.outsideHours} ชม. นอกเวลา</em>
          </div>
          <div>
            <b>{pct}</b>
            <span>รับทราบงาน</span>
            {s.ackMedianMin !== null ? <em>เวลากลาง {s.ackMedianMin} นาที</em> : null}
            {s.unreached ? <em className="dim">ไม่ได้รับแจ้ง {s.unreached} (ยังไม่ผูกช่องทาง)</em> : null}
          </div>
        </section>

        <section className="ps-two">
          <div>
            <h2>งานรายเดือน{s.teamAvgPerMonth !== null ? " (เส้นประ = ค่าเฉลี่ยทีมต่อเดือน)" : ""}</h2>
            <Bars months={s.months} avg={s.teamAvgPerMonth} />
          </div>
          <div>
            <h2>หน้าที่ที่ทำ</h2>
            <HBars rows={s.roles.slice(0, 5)} color="#8a4fa6" />
            <h2>หน่วยงานที่ให้บริการ</h2>
            <HBars rows={s.depts.slice(0, 4)} color="#c99a3a" />
          </div>
        </section>

        <section className="ps-two">
          <div>
            <h2>งานสำคัญ</h2>
            {s.top.length ? (
              <table className="ps-table">
                <thead>
                  <tr>
                    <th>วันที่</th>
                    <th>งาน</th>
                    <th>หน้าที่</th>
                  </tr>
                </thead>
                <tbody>
                  {s.top.map((t, i) => (
                    <tr key={`${t.date}-${i}`}>
                      <td className="nowrap">{shortDate(t.date)}</td>
                      <td>
                        {t.urgent ? "⚡ " : ""}
                        {t.title}
                      </td>
                      <td>{t.roles}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="ps-empty">ยังไม่มีงานในช่วงนี้</p>
            )}
          </div>
          <div>
            <h2>ความร่วมมือ &amp; เหรียญ</h2>
            <table className="ps-table">
              <tbody>
                <tr>
                  <td>รับงานแทนเพื่อน</td>
                  <td>
                    <b>{s.helped}</b> งาน
                  </td>
                </tr>
                <tr>
                  <td>ลงงานเอง</td>
                  <td>
                    <b>{s.selfAdded}</b> งาน
                  </td>
                </tr>
                <tr>
                  <td>งานด่วน/สำคัญ</td>
                  <td>
                    <b>{s.urgent}</b> งาน
                  </td>
                </tr>
                <tr>
                  <td>ไฟล์/ภาพผลงานที่แนบในงาน</td>
                  <td>
                    <b>{s.attachments}</b> ไฟล์
                  </td>
                </tr>
              </tbody>
            </table>
            {s.badges.length ? (
              <p className="ps-badges">{s.badges.map((b) => `${b.label}${b.months > 1 ? ` ×${b.months} เดือน` : ""}`).join(" · ")}</p>
            ) : null}
          </div>
        </section>

        <section className="ps-sig">
          <div>
            ลงชื่อ ................................ ผู้รับการประเมิน
            <br />( {person.name} )
          </div>
          <div>
            ลงชื่อ ................................ ผู้บังคับบัญชา
            <br />( ................................ )
          </div>
        </section>

        <footer className="ps-foot">
          ที่มาข้อมูล: ระบบ PR-OS (งานที่มอบหมายและไม่ถูกยกเลิก ไม่รวมงานทดสอบ) · ชั่วโมง = เวลาเริ่ม–สิ้นสุดของงาน · นอกเวลา = วันทำการที่เริ่มก่อน 08.30 น.
          หรือเลิกหลัง 16.30 น. · วันหยุด = เสาร์–อาทิตย์ · อัตรารับทราบคิดเฉพาะงานที่ระบบส่งการ์ดถึงจริง · ช่วยเพื่อน = รับงานแทนผู้ที่แจ้งไม่สะดวก ·
          ออกรายงาน {nowInBangkok()} โดย {user?.displayName ?? user?.email ?? "โหมดตัวอย่าง"} · ช่วงข้อมูล {formatThaiDate(from)} – {formatThaiDate(to)}
        </footer>
      </article>
    </main>
  );
}
