// "ทีมงาน" on /settings: one row per person with their sign-in, LINE and last
// use, and a ⋯ menu for everything an admin does to one person. Replaces the
// separate people and accounts panels, which made the admin pair accounts to
// people by hand (owner, 20 Oct 2026). Server component: every action is a
// plain form; the only client code is ConfirmSubmit's confirm().

import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { BellRing, UserPlus } from "lucide-react";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { StatusPill } from "@/components/StatusPill";
import { formatThaiDateTime } from "@/lib/format";
import { ROLE_LABELS_TH, UI_ROLES } from "@/lib/auth/roles";
import { initialPassword, lineCandidates, suggestPerson, type TeamMember } from "@/lib/settings/team";
import type { PendingLineView } from "@/lib/settings/queries";
import {
  addTeamMember,
  changeAccountPassword,
  changeAccountRole,
  confirmLineRegistration,
  createAccount,
  dismissLineRegistration,
  setAccountSuspended,
  setAdminWatcher,
  setPersonActive,
  unlinkPersonLine,
  updatePerson,
} from "@/lib/settings/mutations";

function initial(name: string) {
  return name.replace(/^(นางสาว|นาง|นาย|\[ทดสอบ\])/, "").trim().charAt(0) || "?";
}

function RoleOptions({ current }: { current?: string }) {
  const legacy = current && !UI_ROLES.includes(current as (typeof UI_ROLES)[number]);
  return (
    <>
      {legacy ? (
        <option value={current} disabled>
          {ROLE_LABELS_TH[current as keyof typeof ROLE_LABELS_TH]} — เลือกใหม่
        </option>
      ) : null}
      {UI_ROLES.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABELS_TH[r]}
        </option>
      ))}
    </>
  );
}

function MemberMenu({ m, currentUserId }: { m: TeamMember; currentUserId: string | null }) {
  const isSelf = m.accounts.some((a) => a.id === currentUserId);
  return (
    <details className="team-menu">
      <summary aria-label={`จัดการ ${m.displayName}`} title="จัดการ">⋯</summary>
      <div className="team-menu-body">
        {m.accounts.length === 0 && m.personId ? (
          <form action={createAccount} className="team-menu-form">
            <strong>สร้างบัญชีเข้าใช้</strong>
            <input type="hidden" name="personId" value={m.personId} />
            <input className="input" name="username" placeholder="ชื่อผู้ใช้ (ชื่อเล่นภาษาอังกฤษ)" required autoComplete="off" />
            <select className="select" name="role" defaultValue="supervisor">
              <RoleOptions />
            </select>
            <small>รหัสเริ่มต้น = ชื่อผู้ใช้ (ถ้าสั้นกว่า 6 ตัว ระบบเติม 123 ต่อท้าย)</small>
            <button className="button" type="submit">สร้างบัญชี</button>
          </form>
        ) : null}

        {m.accounts.map((a) => (
          <div className="team-menu-account" key={a.id}>
            {m.accounts.length > 1 ? <strong>@{a.username ?? a.email}</strong> : null}
            <form action={changeAccountPassword} className="team-menu-form">
              <label>
                เปลี่ยนรหัสผ่าน
                <input className="input" name="newPassword" placeholder="อย่างน้อย 6 ตัว" minLength={6} required autoComplete="off" />
              </label>
              <button className="button secondary" type="submit">บันทึก</button>
              <input type="hidden" name="accountId" value={a.id} />
            </form>
            <form action={changeAccountRole} className="team-menu-form">
              <label>
                สิทธิ์
                <select className="select" name="role" defaultValue={a.role} disabled={a.id === currentUserId}>
                  <RoleOptions current={a.role} />
                </select>
              </label>
              {a.id === currentUserId ? (
                <small>บัญชีของคุณเอง — คงเป็นผู้ดูแลระบบ</small>
              ) : (
                <button className="button secondary" type="submit">บันทึก</button>
              )}
              <input type="hidden" name="accountId" value={a.id} />
            </form>
          </div>
        ))}

        {m.personId ? (
          <>
            <details className="team-menu-sub">
              <summary>แก้ชื่อ / ตำแหน่ง</summary>
              <form action={updatePerson} className="team-menu-form">
                <input type="hidden" name="personId" value={m.personId} />
                <input type="hidden" name="email" value={m.email ?? ""} />
                <input className="input" name="displayName" defaultValue={m.displayName} aria-label="ชื่อ-สกุล" required />
                <input className="input" name="position" defaultValue={m.position} aria-label="ตำแหน่ง" placeholder="ตำแหน่ง" />
                <button className="button secondary" type="submit">บันทึก</button>
              </form>
            </details>

            <form action={setAdminWatcher} className="team-menu-form">
              <input type="hidden" name="personId" value={m.personId} />
              <input type="hidden" name="on" value={(!m.watcher).toString()} />
              <button className="button secondary" type="submit">
                <BellRing size={15} aria-hidden="true" />
                {m.watcher ? "เลิกรับแจ้งเตือนฝั่งแอดมิน" : "รับแจ้งเตือนฝั่งแอดมิน"}
              </button>
              <small>ได้รายงาน 17:00 และแจ้งเมื่อมีคนกด ไม่สะดวก · พิมพ์ อนุญาตกลุ่มนี้ ในกลุ่มไลน์ได้</small>
            </form>

            {m.lineLinked ? (
              <form action={unlinkPersonLine} className="team-menu-form">
                <input type="hidden" name="personId" value={m.personId} />
                <ConfirmSubmit message={`ยกเลิกผูก LINE ของ ${m.displayName}? เจ้าตัวจะไม่ได้รับแจ้งเตือนจนกว่าจะกดผูกบัญชีใหม่`}>
                  ยกเลิกผูก LINE
                </ConfirmSubmit>
              </form>
            ) : null}
          </>
        ) : null}

        {!isSelf ? (
          m.accounts.length > 0 ? (
            m.accounts.map((a) => (
              <form action={setAccountSuspended} className="team-menu-form" key={`s-${a.id}`}>
                <input type="hidden" name="accountId" value={a.id} />
                <input type="hidden" name="suspend" value={(!m.suspended).toString()} />
                {m.suspended ? (
                  <button className="button secondary" type="submit">เปิดใช้บัญชี</button>
                ) : (
                  <ConfirmSubmit
                    className="button secondary danger"
                    message={`ระงับ ${m.displayName}? จะเข้าระบบไม่ได้ ไม่ได้รับ LINE และไม่อยู่ในรายชื่อให้มอบหมายงาน จนกว่าจะเปิดใช้อีกครั้ง`}
                  >
                    ระงับบัญชี
                  </ConfirmSubmit>
                )}
              </form>
            ))
          ) : m.personId ? (
            <form action={setPersonActive} className="team-menu-form">
              <input type="hidden" name="personId" value={m.personId} />
              <input type="hidden" name="active" value={(!m.personActive).toString()} />
              <button className={`button secondary${m.personActive ? " danger" : ""}`} type="submit">
                {m.personActive ? "ปิดใช้งานรายชื่อ" : "เปิดใช้งานรายชื่อ"}
              </button>
            </form>
          ) : null
        ) : null}

        {m.personId ? (
          <Link className="team-menu-link" href={`/settings/people/${m.personId}`}>
            ดูรายละเอียด →
          </Link>
        ) : null}
      </div>
    </details>
  );
}

const FRIEND_TEXT: Record<PendingLineView["friend"], { label: string; tone: "green" | "amber" | "gray" }> = {
  friend: { label: "เพิ่มเพื่อนบอทแล้ว ✓", tone: "green" },
  not_friend: { label: "ยังไม่เพิ่มเพื่อน — ยังส่งแจ้งเตือนส่วนตัวไม่ได้", tone: "amber" },
  unknown: { label: "ตรวจสถานะเพื่อนไม่ได้", tone: "gray" },
};

/**
 * LINE accounts that tapped "ลงทะเบียนรับแจ้งงาน" in the team group. The admin
 * picks who each one is; the guess comes from the LINE name.
 */
function PendingRegistrations({ pending, team }: { pending: PendingLineView[]; team: TeamMember[] }) {
  if (pending.length === 0) return null;
  const candidates = lineCandidates(team);
  return (
    <div className="team-pending">
      <h3>LINE ที่ลงทะเบียนจากกลุ่ม ({pending.length})</h3>
      <p>เลือกว่าแต่ละ LINE เป็นของใคร แล้วกดยืนยัน — เจ้าตัวไม่ต้องเข้าระบบหรือพิมพ์รหัสผ่าน</p>
      <ul>
        {pending.map((r) => {
          const suggested = suggestPerson(r.displayName, candidates);
          const friend = FRIEND_TEXT[r.friend];
          return (
            <li className="team-pending-item" key={r.lineUserId}>
              <div className="team-pending-who">
                {r.pictureUrl ? (
                  // LINE's CDN; no referrer so the admin's page address is not sent to it.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="team-pending-pic" src={r.pictureUrl} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <span className="staff-avatar" aria-hidden="true">{initial(r.displayName)}</span>
                )}
                <span>
                  <strong>{r.displayName}</strong>
                  <small>กดลงทะเบียน {formatThaiDateTime(r.at)}</small>
                  <StatusPill label={friend.label} tone={friend.tone} />
                </span>
              </div>
              {candidates.length > 0 ? (
                <form action={confirmLineRegistration} className="team-pending-form">
                  <input type="hidden" name="lineUserId" value={r.lineUserId} />
                  <select className="select" name="personId" defaultValue={suggested ?? ""} required aria-label={`LINE ${r.displayName} เป็นของใคร`}>
                    <option value="" disabled>
                      — เลือกว่าเป็นใคร —
                    </option>
                    {candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.displayName}
                        {c.id === suggested ? " (ระบบเดา)" : ""}
                      </option>
                    ))}
                  </select>
                  <button className="button" type="submit">ยืนยัน</button>
                </form>
              ) : (
                <small className="team-muted">ทุกคนในทีมผูก LINE ครบแล้ว — ถ้าเป็นคนใหม่ กด + เพิ่มคน ก่อน</small>
              )}
              <form action={dismissLineRegistration} className="team-pending-dismiss">
                <input type="hidden" name="lineUserId" value={r.lineUserId} />
                <ConfirmSubmit message={`ลบ "${r.displayName}" ออกจากรายการรอยืนยัน?`}>ลบ</ConfirmSubmit>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function TeamPanel({
  team,
  currentUserId,
  added,
  pending = [],
}: {
  team: TeamMember[];
  currentUserId: string | null;
  /** Username from ?added= after "+ เพิ่มคน" / "สร้างบัญชี". */
  added: string | null;
  /** LINE accounts waiting for an admin to say who they are. */
  pending?: PendingLineView[];
}) {
  const people = team.filter((m) => m.personId);
  const addedMember = added
    ? team.find((m) => m.accounts.some((a) => a.username === added))
    : undefined;
  const addedAccount = addedMember?.accounts.find((a) => a.username === added);

  return (
    <section className="panel team-panel" id="team">
      <div className="panel-heading">
        <div>
          <h2>ทีมงาน ({people.length} คน)</h2>
          <p>ทุกอย่างของแต่ละคนอยู่ในแถวเดียว — กด ⋯ เพื่อเปลี่ยนรหัส เปลี่ยนสิทธิ์ ยกเลิก LINE หรือระงับบัญชี</p>
        </div>
      </div>

      {addedMember && addedAccount ? (
        <div className="team-added">
          <strong>เพิ่ม {addedMember.displayName} แล้ว</strong>
          <span>
            เข้าด้วย <b>@{addedAccount.username}</b>
            {addedAccount.lastSignInAt ? null : (
              <>
                {" "}· รหัสเริ่มต้น <b>{initialPassword(addedAccount.username ?? "")}</b>
              </>
            )}
          </span>
          <small>ส่งให้เจ้าตัวทางแชทส่วนตัว (ใช้เข้าเว็บ) · รับแจ้งงานทาง LINE: ให้กด “ลงทะเบียนรับแจ้งงาน” ในกลุ่มไลน์งาน + เพิ่มเพื่อนบอท แล้วยืนยันชื่อในกล่องด้านบน</small>
        </div>
      ) : null}

      <PendingRegistrations pending={pending} team={team} />

      <details className="team-add">
        <summary className="button coral">
          <UserPlus size={17} aria-hidden="true" />
          เพิ่มคน
        </summary>
        <form action={addTeamMember} className="team-add-form">
          <label className="form-field">
            ชื่อ-สกุล
            <input className="input" name="displayName" placeholder="เช่น นางสาวสมใจ ใจดี" required />
          </label>
          <label className="form-field">
            ตำแหน่ง
            <input className="input" name="position" placeholder="เช่น นักประชาสัมพันธ์" />
          </label>
          <label className="form-field">
            ชื่อผู้ใช้ (ใช้เข้าระบบ)
            <input className="input" name="username" placeholder="ชื่อเล่นภาษาอังกฤษ เช่น somjai" required autoComplete="off" />
          </label>
          <label className="form-field">
            สิทธิ์
            <select className="select" name="role" defaultValue="supervisor">
              <RoleOptions />
            </select>
          </label>
          <p className="team-add-hint">รหัสผ่านเริ่มต้น = ชื่อผู้ใช้ (ถ้าสั้นกว่า 6 ตัว ระบบเติม 123 ต่อท้าย) — หลังเพิ่ม ระบบจะแสดงให้ดูอีกครั้ง</p>
          <button className="button coral" type="submit">เพิ่มเข้าทีม</button>
        </form>
      </details>

      <div className="team-table-wrap">
        <table className="team-table">
          <thead>
            <tr>
              <th>ชื่อ</th>
              <th>เข้าด้วย</th>
              <th>สิทธิ์</th>
              <th>LINE</th>
              <th>ใช้ล่าสุด</th>
              <th>สถานะ</th>
              <th aria-label="จัดการ" />
            </tr>
          </thead>
          <tbody>
            {team.map((m) => {
              const main = m.accounts[0];
              return (
                <tr className={m.suspended ? "is-suspended" : undefined} key={m.key}>
                  <td data-label="ชื่อ">
                    <div className="team-name">
                      <Avatar personId={m.personId} name={m.displayName} size={36} />
                      <span>
                        <strong>{m.displayName}</strong>
                        {m.position ? <small>{m.position}</small> : null}
                        {m.watcher ? (
                          <em className="team-watcher">
                            <BellRing size={12} aria-hidden="true" /> ติดตามงาน
                          </em>
                        ) : null}
                      </span>
                    </div>
                  </td>
                  <td data-label="เข้าด้วย">
                    {m.accounts.length > 0 ? (
                      m.accounts.map((a) => <div key={a.id}>@{a.username ?? a.email}</div>)
                    ) : (
                      <span className="team-muted">ยังไม่มีบัญชี</span>
                    )}
                  </td>
                  <td data-label="สิทธิ์">{main ? ROLE_LABELS_TH[main.role] : "—"}</td>
                  <td data-label="LINE">
                    {m.personId ? (
                      m.lineLinked ? (
                        <StatusPill label="✓ ผูกแล้ว" tone="green" />
                      ) : (
                        <StatusPill label="✗ ยังไม่ผูก" tone="amber" />
                      )
                    ) : (
                      "—"
                    )}
                  </td>
                  <td data-label="ใช้ล่าสุด">
                    {m.lastSignInAt ? formatThaiDateTime(m.lastSignInAt) : <span className="team-muted">ไม่เคย</span>}
                  </td>
                  <td data-label="สถานะ">
                    {m.suspended ? <StatusPill label="ระงับ" tone="red" /> : <span className="team-muted">ใช้งาน</span>}
                  </td>
                  <td className="team-actions-cell">
                    <MemberMenu m={m} currentUserId={currentUserId} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
