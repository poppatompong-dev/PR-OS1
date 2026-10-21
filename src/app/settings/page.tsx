import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/roles";
import { buildTeam } from "@/lib/settings/team";
import { TeamPanel } from "./TeamPanel";
import { env, isLineLoginConfigured, isLineMessagingConfigured, isLineWebhookConfigured, isSupabaseConfigured } from "@/lib/env";
import {
  getAccounts,
  getAllPeople,
  getPendingLineRegistrations,
  getMasterLists,
  getNotificationFeed,
  getNotificationSettings,
  type MasterItem,
} from "@/lib/settings/queries";
import {
  addMasterItem,
  processNotificationQueue,
  setMasterActive,
  setupLineRichMenu,
  updateNotificationSettings,
} from "@/lib/settings/mutations";
import { NOTIF_STATUS_TH, NOTIF_TYPE_TH } from "@/lib/notifications/labels";
import { BellRing, Plus, Power, RotateCcw, Send } from "lucide-react";

export const dynamic = "force-dynamic";

function MasterListPanel({
  title,
  table,
  items,
  extraLabel,
}: {
  title: string;
  table: string;
  items: MasterItem[];
  extraLabel: string;
}) {
  return (
    <div className="panel">
      <h2>{title}</h2>
      <div className="master-list">
        {items.map((item) => (
          <div className={`master-row ${item.isActive ? "" : "is-inactive"}`} key={item.id}>
            <span className="master-name">
              {item.name}
              {item.extra ? <small> · {item.extra}</small> : null}
            </span>
            <form action={setMasterActive}>
              <input type="hidden" name="table" value={table} />
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="active" value={(!item.isActive).toString()} />
              <button className="icon-button" type="submit" title={item.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}>
                {item.isActive ? <Power size={16} aria-hidden="true" /> : <RotateCcw size={16} aria-hidden="true" />}
              </button>
            </form>
          </div>
        ))}
      </div>
      <form action={addMasterItem} className="master-add">
        <input type="hidden" name="table" value={table} />
        <input className="input" name="name" aria-label="ชื่อ" placeholder="ชื่อ" required />
        <input className="input" name="extra" aria-label={extraLabel} placeholder={extraLabel} />
        <button className="button secondary" type="submit">
          <Plus size={16} aria-hidden="true" />
          เพิ่ม
        </button>
      </form>
    </div>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; added?: string }>;
}) {
  const { error, notice, added } = await searchParams;

  const live = isSupabaseConfigured();

  // Demo mode shows the real layout with sample data, so the screen can be
  // reviewed for what it offers. Every button on it still posts to a server
  // action that refuses without a database, so nothing here can be changed.
  const supabase = live ? await createClient() : null;
  const user = supabase ? await getSessionUser(supabase) : null;

  if (live && user?.role !== "admin") {
    return (
      <AppShell>
        <header className="page-header">
          <div>
            <h1 className="page-title">ตั้งค่าระบบ</h1>
            <p className="page-subtitle">ทีมงาน การแจ้งเตือน และข้อมูลหลัก</p>
          </div>
        </header>
        <div className="panel">
          <p>หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</p>
        </div>
      </AppShell>
    );
  }

  const [people, accounts, master, notifFeed, notifSettings, pendingLine] = await Promise.all([
    getAllPeople(),
    getAccounts(),
    getMasterLists(),
    getNotificationFeed(),
    getNotificationSettings(),
    getPendingLineRegistrations(),
  ]);
  const team = buildTeam(people, accounts, notifSettings.adminPersonIds);
  const tvAddress = `${new URL(env.appBaseUrl).host}/tv`;
  const activePeople = people.filter((p) => p.isActive);

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <h1 className="page-title">ตั้งค่าระบบ</h1>
          <p className="page-subtitle">
            {live
              ? "ทีมงาน การแจ้งเตือน และข้อมูลหลัก"
              : "ทีมงาน การแจ้งเตือน และข้อมูลหลัก (โหมดตัวอย่าง)"}
          </p>
        </div>
      </header>

      {!live ? (
        <div className="login-error">
          โหมดตัวอย่าง — ข้อมูลที่เห็นเป็นข้อมูลสมมติ และยังบันทึกการแก้ไขไม่ได้จนกว่าจะเชื่อมฐานข้อมูลจริง
        </div>
      ) : null}

      {error ? <div className="login-error">{error}</div> : null}
      {notice ? (
        <div
          className="login-error"
          style={{ background: "rgba(24,120,74,.1)", borderColor: "rgba(24,120,74,.35)", color: "var(--green)" }}
        >
          {notice}
        </div>
      ) : null}

      <TeamPanel team={team} currentUserId={user?.id ?? null} added={added ?? null} pending={pendingLine} />

      {/* ---- TV short link ---- */}
      <section className="panel tv-link-panel">
        <div className="panel-heading">
          <div>
            <h2>เปิดจอมอนิเตอร์บนทีวี</h2>
            <p>เปิดเบราว์เซอร์ทีวี พิมพ์ที่อยู่นี้ แล้วกดบันทึกเป็นบุ๊กมาร์ก/หน้าแรก ครั้งต่อไปเปิดได้ทันที ไม่ต้องล็อกอิน</p>
          </div>
        </div>
        <p className="tv-link">{tvAddress}</p>
        <p className="tv-link-alt">
          แบบใหม่ ธีมกรมท่า + โพโพกับฟูฟู 5 ท่า (ยังไม่เป็นค่าเริ่มต้น): <b>{tvAddress}?v=3d</b> — มาสคอตเป็นวิดีโอวนสั้น ทีวีแค่เล่นวิดีโอ จึงลื่น; ถ้าเล่นไม่ได้จะเป็นภาพนิ่ง (บังคับภาพนิ่ง: เติม <b>&amp;static=1</b>)
        </p>
      </section>

      {/* ---- Notifications ---- */}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>
              <BellRing size={18} aria-hidden="true" /> การแจ้งเตือน
            </h2>
            <p>คิวแจ้งเตือนจะถูกสร้างอัตโนมัติเมื่อเผยแพร่ / เปลี่ยนแปลง / ยกเลิกงาน</p>
          </div>
        </div>

        {isLineWebhookConfigured() && isLineLoginConfigured() ? (
          <div
            className="login-error"
            style={{ background: "rgba(24,120,74,.1)", borderColor: "rgba(24,120,74,.35)", color: "var(--green)" }}
          >
            ✓ เชื่อมต่อ LINE ครบแล้ว (ส่งข้อความ + รับคำสั่งแชท + ล็อกอินด้วย LINE)
          </div>
        ) : (
          <div className="login-error" style={{ background: "rgba(164,95,8,.1)", borderColor: "rgba(164,95,8,.35)", color: "var(--amber)" }}>
            ℹ️ LINE ยังตั้งค่าไม่ครบ — ส่งข้อความ {isLineMessagingConfigured() ? "✓" : "✗"} · รับคำสั่งแชท{" "}
            {isLineWebhookConfigured() ? "✓" : "✗"} · ล็อกอินด้วย LINE {isLineLoginConfigured() ? "✓" : "✗"} — ระหว่างนี้คิวจะถูกข้าม
            (โหมดจำลอง) ดูวิธีตั้งค่าใน docs/15 ข้อ 4
          </div>
        )}

        <dl className="line-facts">
          <div>
            <dt>Webhook URL (วางใน LINE Developers → Messaging API)</dt>
            <dd>
              <code>{new URL("/api/line/webhook", env.appBaseUrl).toString()}</code>
            </dd>
          </div>
          <div>
            <dt>ตัวตั้งเวลาส่งคิว (Supabase ทุก 5 นาที)</dt>
            <dd style={{ color: notifSettings.scheduler.state === "stale" || notifSettings.scheduler.state === "never" ? "var(--red)" : undefined, fontWeight: 600 }}>
              {notifSettings.scheduler.state === "ok" ? "✅ " : notifSettings.scheduler.state === "sleeping" ? "🌙 " : "⚠️ "}
              {notifSettings.scheduler.label}
              {notifSettings.failedLast24h > 0 ? ` · ส่งไม่สำเร็จ 24 ชม. ล่าสุด ${notifSettings.failedLast24h} ข้อความ` : ""}
            </dd>
          </div>
          <div>
            <dt>ใช้โควต้าเดือนนี้ (ตามที่ระบบส่ง)</dt>
            <dd>
              {notifSettings.quotaUsedThisMonth} / {notifSettings.lineMonthlyQuota} ข้อความ
              {" "}(การ์ดงาน {notifSettings.budget.sent.critical} · เตือนก่อนงาน {notifSettings.budget.sent.reminder} · สรุปเช้า/รายงานเย็น{" "}
              {notifSettings.budget.sent.low})
            </dd>
          </div>
          <div>
            <dt>กันงบอัตโนมัติ (ให้ 300 ข้อความพอทั้งเดือน)</dt>
            <dd style={{ color: notifSettings.budget.mode === "normal" || notifSettings.budget.mode === "unlimited" ? undefined : "var(--amber, #a45f08)", fontWeight: 600 }}>
              {notifSettings.budget.mode === "normal" || notifSettings.budget.mode === "unlimited" ? "✅ " : "🛡️ "}
              {notifSettings.budget.text}
            </dd>
            <dd className="muted" style={{ fontSize: 13 }}>
              การ์ดงานใหม่ / งานเปลี่ยน / ยกเลิก / แจ้งไม่สะดวก ส่งเสมอ · เตือน 1.5 ชม. ส่งเมื่อยังกันโควต้าการ์ดงานได้ ·
              สรุปเช้า 07:00 และรายงาน 17:00 ส่งได้ถึง {notifSettings.budget.lowAllowedSoFar} ข้อความถึงวันนี้ (ใช้แล้ว{" "}
              {notifSettings.budget.sent.low}) · คิดจากงานประมาณ 40 งาน/เดือน 1–2 คน/งาน
            </dd>
          </div>
          <div>
            <dt>ผู้รับแจ้งเตือนฝั่งแอดมิน (ตั้งที่ตารางทีมงาน ⋯ → รับแจ้งเตือนฝั่งแอดมิน)</dt>
            <dd>
              {team.filter((m) => m.watcher).length === 0
                ? "ยังไม่ได้เลือก — ระบบส่งถึงบัญชีผู้ดูแลระบบแทน"
                : team
                    .filter((m) => m.watcher)
                    .map((m) => m.displayName + (m.lineLinked ? "" : " (ยังไม่ผูก LINE)"))
                    .join(", ")}
            </dd>
          </div>
          <div>
            <dt>ยังไม่ผูก LINE</dt>
            <dd>
              {activePeople.filter((p) => !p.lineLinked).length === 0
                ? "ผูกครบทุกคนแล้ว"
                : activePeople
                    .filter((p) => !p.lineLinked)
                    .map((p) => p.displayName)
                    .join(", ")}
            </dd>
          </div>
        </dl>

        <form action={updateNotificationSettings} className="notif-settings">
          <label className="notif-check">
            <input type="checkbox" name="lineEnabled" defaultChecked={notifSettings.lineEnabled} /> เปิดส่ง LINE
          </label>
          <label className="notif-check">
            <input type="checkbox" name="sameDayReminderEnabled" defaultChecked={notifSettings.sameDayReminderEnabled} />
            เตือน 1.5 ชม. ก่อนงาน (เฉพาะคนที่ยังไม่รับทราบ)
          </label>
          <label className="form-field">
            โควต้า LINE/เดือน
            <input className="input" type="number" name="lineMonthlyQuota" defaultValue={notifSettings.lineMonthlyQuota} />
          </label>
          <button className="button secondary" type="submit">บันทึกการตั้งค่า</button>
        </form>

        <div className="form-actions" style={{ justifyContent: "flex-start", marginTop: 12, flexWrap: "wrap" }}>
          <form action={processNotificationQueue}>
            <button className="button" type="submit">
              <Send size={16} aria-hidden="true" />
              ประมวลผลคิว
            </button>
          </form>
          {isLineMessagingConfigured() ? (
            <form action={setupLineRichMenu}>
              <button className="button secondary" type="submit">
                ตั้งค่าเมนูใต้แชท LINE
              </button>
            </form>
          ) : null}
        </div>

        <h3 style={{ marginTop: 18 }}>คิว/ประวัติล่าสุด</h3>
        {notifFeed.length > 0 ? (
          <div className="table-wrap">
            <table className="event-table">
              <thead>
                <tr>
                  <th>ประเภท</th>
                  <th>งาน</th>
                  <th>ผู้รับ</th>
                  <th>ช่องทาง</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {notifFeed.map((n) => (
                  <tr key={n.id}>
                    <td>{NOTIF_TYPE_TH[n.type] ?? n.type}</td>
                    <td>{n.eventTitle}</td>
                    <td>{n.personName}</td>
                    <td>{n.channel.toUpperCase()}</td>
                    <td>
                      {NOTIF_STATUS_TH[n.status] ?? n.status}
                      {n.errorMessage ? <small className="ack-tag"> · {n.errorMessage}</small> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>ยังไม่มีรายการแจ้งเตือน — ลองเผยแพร่งานที่มีผู้รับมอบหมาย</p>
        )}
      </section>

      {/* ---- Master data ---- */}
      <section className="settings-grid">
        <MasterListPanel title="หน่วยงาน" table="departments" items={master.departments} extraLabel="ตัวย่อ" />
        <MasterListPanel title="สถานที่" table="locations" items={master.locations} extraLabel="รายละเอียด" />
        <MasterListPanel title="ประเภทงาน" table="event_types" items={master.eventTypes} extraLabel="สี (เช่น blue)" />
        <MasterListPanel title="บทบาท" table="roles" items={master.roles} extraLabel="รหัส (เช่น mc)" />
      </section>
    </AppShell>
  );
}
