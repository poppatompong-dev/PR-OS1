import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, ROLE_LABELS_TH, type AppRole } from "@/lib/auth/roles";
import { isEmailConfigured, isLineMessagingConfigured } from "@/lib/env";
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
  processNotificationQueue,
  setMasterActive,
  setPersonActive,
  updateAccount,
  updateNotificationSettings,
  updatePerson,
} from "@/lib/settings/mutations";
import { BellRing, Mail, Plus, Power, RotateCcw, Send, UserPlus, Users } from "lucide-react";

const NOTIF_TYPE_TH: Record<string, string> = {
  assignment: "มอบหมาย",
  reminder: "เตือนล่วงหน้า",
  change: "เปลี่ยนแปลง",
  cancellation: "ยกเลิก",
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
        <input className="input" name="name" placeholder="ชื่อ" required />
        <input className="input" name="extra" placeholder={extraLabel} />
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
  const supabase = await createClient();
  const user = await getSessionUser(supabase);

  if (user?.role !== "admin") {
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
          <p className="page-subtitle">จัดการบุคลากร บัญชีผู้ใช้ และบทบาท (ข้อมูลจริง)</p>
        </div>
      </header>

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
                      <input className="input" name="displayName" defaultValue={person.displayName} placeholder="ชื่อ-สกุล" />
                      <input className="input" name="position" defaultValue={person.position} placeholder="ตำแหน่ง" />
                      <input className="input" name="email" type="email" defaultValue={person.email ?? ""} placeholder="อีเมล" />
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
            <p>กำหนดบทบาทและผูกบัญชีเข้ากับรายชื่อบุคลากร (ผูกแล้วจึงจะเห็นงานในหน้ามือถือ)</p>
          </div>
        </div>
        <p className="page-subtitle">
          สร้างบัญชีใหม่ได้ที่ Supabase → Authentication → Users (ติ๊ก Auto Confirm) จากนั้นกำหนดบทบาทที่นี่
        </p>

        <div className="account-list">
          {accounts.map((account) => (
            <form action={updateAccount} className="account-row" key={account.id}>
              <input type="hidden" name="accountId" value={account.id} />
              <div className="account-email">
                {account.email}
                {account.username ? <small> · @{account.username}</small> : null}
              </div>
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
              <button className="button" type="submit">บันทึก</button>
            </form>
          ))}
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

        {isLineMessagingConfigured() || isEmailConfigured() ? (
          <div
            className="login-error"
            style={{ background: "rgba(24,120,74,.1)", borderColor: "rgba(24,120,74,.35)", color: "var(--green)" }}
          >
            ✓ เชื่อมต่อ{isLineMessagingConfigured() ? " LINE" : ""}
            {isLineMessagingConfigured() && isEmailConfigured() ? " และ" : ""}
            {isEmailConfigured() ? " Email" : ""} แล้ว — ปุ่ม “ประมวลผลคิว” จะส่งข้อความจริง
          </div>
        ) : (
          <div className="login-error" style={{ background: "rgba(164,95,8,.1)", borderColor: "rgba(164,95,8,.35)", color: "var(--amber)" }}>
            ℹ️ การส่งจริงผ่าน LINE/Email ยังไม่เปิดใช้งาน (ยังไม่ตั้งค่า provider) — ปุ่ม “ประมวลผลคิว” จะทำงานในโหมดจำลอง
          </div>
        )}

        <form action={updateNotificationSettings} className="notif-settings">
          <label className="notif-check">
            <input type="checkbox" name="lineEnabled" defaultChecked={notifSettings.lineEnabled} /> เปิด LINE
          </label>
          <label className="notif-check">
            <input type="checkbox" name="emailEnabled" defaultChecked={notifSettings.emailEnabled} /> เปิด Email (fallback)
          </label>
          <label className="notif-check">
            <input type="checkbox" name="sameDayReminderEnabled" defaultChecked={notifSettings.sameDayReminderEnabled} />
            เตือนซ้ำ 1 ชม. ก่อนงานในวันเดียวกัน
          </label>
          <label className="notif-check">
            <input type="checkbox" name="fallbackWhenLineFails" defaultChecked={notifSettings.fallbackWhenLineFails} />
            ส่ง Email แทนถ้า LINE ล้มเหลว
          </label>
          <label className="notif-check">
            <input type="checkbox" name="fallbackWhenQuotaExceeded" defaultChecked={notifSettings.fallbackWhenQuotaExceeded} />
            ส่ง Email แทนถ้าโควต้า LINE เต็ม
          </label>
          <label className="form-field">
            โควต้า LINE/เดือน
            <input className="input" type="number" name="lineMonthlyQuota" defaultValue={notifSettings.lineMonthlyQuota} />
          </label>
          <label className="form-field">
            แจ้งล่วงหน้า (ชม.)
            <input className="input" type="number" name="defaultReminderHours" defaultValue={notifSettings.defaultReminderHours} />
          </label>
          <button className="button secondary" type="submit">บันทึกการตั้งค่า</button>
        </form>

        <div className="form-actions" style={{ justifyContent: "flex-start", marginTop: 12 }}>
          <form action={processNotificationQueue}>
            <button className="button" type="submit">
              <Send size={16} aria-hidden="true" />
              ประมวลผลคิว
            </button>
          </form>
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
