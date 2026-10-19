import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, ROLE_LABELS_TH, type AppRole } from "@/lib/auth/roles";
import { env, isLineLoginConfigured, isLineMessagingConfigured, isLineWebhookConfigured, isSupabaseConfigured } from "@/lib/env";
import {
  getAccounts,
  getAllPeople,
  getMasterLists,
  getNotificationFeed,
  getNotificationSettings,
  type MasterItem,
} from "@/lib/settings/queries";
import {
  addMasterItem,
  addPerson,
  createAccount,
  processNotificationQueue,
  setMasterActive,
  setupLineRichMenu,
  setPersonActive,
  updateAccount,
  updateNotificationSettings,
  updatePerson,
} from "@/lib/settings/mutations";
import { BellRing, Mail, Plus, Power, RotateCcw, Send, UserPlus, Users } from "lucide-react";

const NOTIF_TYPE_TH: Record<string, string> = {
  assignment: "มอบหมาย",
  reminder: "เตือน 1.5 ชม.",
  change: "เปลี่ยนแปลง",
  cancellation: "ยกเลิก",
  daily_summary: "สรุป 07:00",
  admin_report: "รายงาน 17:00",
  unavailable: "แจ้งไม่สะดวก",
  quota_warning: "เตือนโควต้า",
};
const NOTIF_STATUS_TH: Record<string, string> = {
  queued: "รอส่ง",
  sent: "ส่งแล้ว",
  failed: "ล้มเหลว",
  skipped: "ข้าม",
};

export const dynamic = "force-dynamic";

const ROLES: AppRole[] = ["admin", "supervisor", "staff", "assignee", "display"];

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
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;

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
            <p className="page-subtitle">จัดการบุคลากร บัญชีผู้ใช้ และข้อมูลหลัก</p>
          </div>
        </header>
        <div className="panel">
          <p>หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</p>
        </div>
      </AppShell>
    );
  }

  const [people, accounts, master, notifFeed, notifSettings] = await Promise.all([
    getAllPeople(),
    getAccounts(),
    getMasterLists(),
    getNotificationFeed(),
    getNotificationSettings(),
  ]);
  const activeCount = people.filter((p) => p.isActive).length;
  const activePeople = people.filter((p) => p.isActive);

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <h1 className="page-title">ตั้งค่าระบบ</h1>
          <p className="page-subtitle">
            {live
              ? "จัดการบุคลากร บัญชีผู้ใช้ และบทบาท (ข้อมูลจริง)"
              : "จัดการบุคลากร บัญชีผู้ใช้ และบทบาท"}
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

      {/* ---- People management ---- */}
      <section className="staff-panel panel">
        <div className="panel-heading">
          <div>
            <h2>บุคลากรงานประชาสัมพันธ์</h2>
            <p>
              ใช้งานอยู่ {activeCount} คน / ทั้งหมด {people.length} คน
            </p>
          </div>
          <span className="staff-count">
            <Users size={18} aria-hidden="true" />
            {activeCount}
          </span>
        </div>

        <div className="staff-manager">
          <div className="staff-list" aria-label="รายชื่อบุคลากร">
            {people.map((person) => (
              <article
                className={`staff-row ${person.isActive ? "" : "is-inactive"}`}
                key={person.id}
              >
                <div className="staff-avatar" aria-hidden="true">
                  {person.displayName.replace(/^(นางสาว|นาง|นาย)/, "").trim().charAt(0)}
                </div>
                <div className="staff-main">
                  <strong>{person.displayName}</strong>
                  <span>{person.position}</span>
                  {person.email ? (
                    <small>
                      <Mail size={14} aria-hidden="true" />
                      {person.email}
                    </small>
                  ) : null}
                  <details className="staff-edit">
                    <summary>แก้ไขข้อมูล</summary>
                    <form action={updatePerson} className="staff-form">
                      <input type="hidden" name="personId" value={person.id} />
                      <input className="input" name="displayName" aria-label="ชื่อ-สกุล" defaultValue={person.displayName} placeholder="ชื่อ-สกุล" />
                      <input className="input" name="position" aria-label="ตำแหน่ง" defaultValue={person.position} placeholder="ตำแหน่ง" />
                      <input className="input" name="email" type="email" aria-label="อีเมล" defaultValue={person.email ?? ""} placeholder="อีเมล" />
                      <button className="button secondary" type="submit">บันทึก</button>
                    </form>
                  </details>
                </div>
                <div className="staff-actions">
                  <form action={setPersonActive}>
                    <input type="hidden" name="personId" value={person.id} />
                    <input type="hidden" name="active" value={(!person.isActive).toString()} />
                    <button
                      className="icon-button"
                      type="submit"
                      title={person.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                    >
                      {person.isActive ? (
                        <Power size={18} aria-hidden="true" />
                      ) : (
                        <RotateCcw size={18} aria-hidden="true" />
                      )}
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>

          <form action={addPerson} className="staff-form">
            <h3>เพิ่มเจ้าหน้าที่</h3>
            <label className="form-field">
              ชื่อ-สกุล
              <input className="input" name="displayName" required />
            </label>
            <label className="form-field">
              ตำแหน่ง
              <input className="input" name="position" />
            </label>
            <label className="form-field">
              อีเมล
              <input className="input" name="email" type="email" />
            </label>
            <button className="button coral" type="submit">
              <UserPlus size={18} aria-hidden="true" />
              เพิ่มรายชื่อ
            </button>
          </form>
        </div>
      </section>

      {/* ---- Account / role management ---- */}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>บัญชีผู้ใช้และบทบาท</h2>
            <p>กำหนดบทบาท, ตั้งรหัสผ่าน และผูกบัญชีเข้ากับรายชื่อบุคลากร (ผูกแล้วจึงจะเห็นงานในหน้ามือถือ)</p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", marginTop: "16px" }}>
          {/* Create New Account Form */}
          <form action={createAccount} className="panel" style={{ background: "var(--surface-soft)", border: "1px solid var(--line)" }}>
            <h3 style={{ marginTop: 0, fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <UserPlus size={18} color="var(--blue)" />
              สร้างบัญชีผู้ใช้ใหม่
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <label className="form-field">
                ชื่อผู้ใช้ (Username สำหรับล็อกอิน)
                <input className="input" name="username" placeholder="เช่น thananthon, nat, pracharak" required />
              </label>
              <label className="form-field">
                รหัสผ่านเริ่มต้น (อย่างน้อย 6 ตัวอักษร)
                <input className="input" type="password" name="password" placeholder="••••••••" required />
              </label>
              <label className="form-field">
                บทบาท (Role)
                <select className="select" name="role" defaultValue="staff">
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS_TH[r]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                ผูกกับเจ้าหน้าที่เทศบาล
                <select className="select" name="personId">
                  <option value="">— ไม่ผูก —</option>
                  {activePeople.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName} ({p.position ?? "เจ้าหน้าที่"})
                    </option>
                  ))}
                </select>
              </label>
              <button className="button coral" type="submit" style={{ marginTop: "4px" }}>
                <UserPlus size={16} />
                สร้างบัญชีผู้ใช้
              </button>
            </div>
          </form>

          {/* Existing Accounts List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <h3 style={{ marginTop: 0, fontSize: "16px" }}>บัญชีในระบบ ({accounts.length} บัญชี)</h3>
            <div className="account-list" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {accounts.map((account) => (
                <form action={updateAccount} className="account-row panel" style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "14px" }} key={account.id}>
                  <input type="hidden" name="accountId" value={account.id} />
                  <div className="account-email" style={{ marginBottom: "8px", fontWeight: "700", color: "var(--blue)" }}>
                    {account.username ? `@${account.username}` : account.email}
                    {account.username && <small style={{ color: "var(--muted)", fontWeight: "normal" }}> ({account.email})</small>}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
                    <label className="form-field">
                      ชื่อผู้ใช้ (login)
                      <input className="input" name="username" defaultValue={account.username ?? ""} placeholder="เช่น somchai" />
                    </label>
                    <label className="form-field">
                      บทบาท
                      <select className="select" name="role" defaultValue={account.role}>
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS_TH[r]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="form-field">
                      ผูกกับบุคลากร
                      <select className="select" name="personId" defaultValue={account.personId ?? ""}>
                        <option value="">— ไม่ผูก —</option>
                        {activePeople.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.displayName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="form-field">
                      เปลี่ยนรหัสผ่านใหม่
                      <input className="input" type="password" name="newPassword" placeholder="เว้นว่างถ้าไม่เปลี่ยน" />
                    </label>
                  </div>
                  <div style={{ marginTop: "10px", display: "flex", justifyContent: "flex-end" }}>
                    <button className="button" type="submit">บันทึกการแก้ไข</button>
                  </div>
                </form>
              ))}
            </div>
          </div>
        </div>
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
            <dt>ใช้โควต้าเดือนนี้ (ตามที่ระบบส่ง)</dt>
            <dd>
              {notifSettings.quotaUsedThisMonth} / {notifSettings.lineMonthlyQuota} ข้อความ
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
          <fieldset className="admin-recipients">
            <legend>ผู้รับแจ้งเตือนฝั่งแอดมิน (แจ้งไม่สะดวก · รายงาน 17:00 · เตือนโควต้า)</legend>
            {activePeople.map((p) => (
              <label className="notif-check" key={p.id}>
                <input
                  type="checkbox"
                  name="adminPersonIds"
                  value={p.id}
                  defaultChecked={notifSettings.adminPersonIds.includes(p.id)}
                />
                {p.displayName}
                {p.lineLinked ? "" : " (ยังไม่ผูก LINE)"}
              </label>
            ))}
          </fieldset>
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
