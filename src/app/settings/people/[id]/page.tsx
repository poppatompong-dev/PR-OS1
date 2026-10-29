import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { StatusPill } from "@/components/StatusPill";
import { createClient } from "@/lib/supabase/server";
import { getAvatarOffIds } from "@/lib/avatar-choice";
import { getSessionUser, ROLE_LABELS_TH } from "@/lib/auth/roles";
import { isSupabaseConfigured } from "@/lib/env";
import { formatThaiDate, formatThaiDateTime } from "@/lib/format";
import { NOTIF_STATUS_TH, NOTIF_TYPE_TH } from "@/lib/notifications/labels";
import { getPersonDetail, type PersonTask } from "@/lib/settings/person-detail";
import { setAccountSuspended, unlinkPersonLine } from "@/lib/settings/mutations";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const AUDIT_TH: Record<string, string> = {
  line_link: "ผูก LINE",
  line_unlink: "ยกเลิกผูก LINE",
  account_suspend: "ระงับบัญชี",
  account_unsuspend: "เปิดใช้บัญชี",
};

function AckPill({ task }: { task: PersonTask }) {
  if (task.ack === "acknowledged") return <StatusPill label="รับทราบแล้ว" tone="green" />;
  if (task.ack === "unavailable")
    return <StatusPill label={`ไม่สะดวก${task.unavailableReason ? ` · ${task.unavailableReason}` : ""}`} tone="red" />;
  return <StatusPill label="ยังไม่รับทราบ" tone="amber" />;
}

export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { id } = await params;
  const { error, notice } = await searchParams;

  if (!isSupabaseConfigured()) redirect("/settings");
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect(`/settings?error=${encodeURIComponent("เฉพาะผู้ดูแลระบบเท่านั้น")}`);
  if (!UUID.test(id)) redirect(`/settings?error=${encodeURIComponent("ไม่พบบุคลากร")}`);

  const person = await getPersonDetail(id);
  if (!person) redirect(`/settings?error=${encodeURIComponent("ไม่พบบุคลากร")}`);
  const here = `/settings/people/${person.id}`;
  const avatarOff = (await getAvatarOffIds(supabase)).has(person.id);

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p style={{ margin: 0 }}>
            <Link href="/settings">← กลับไปหน้าตั้งค่า</Link>
          </p>
          <div className="page-header-person">
            <Avatar personId={person.id} name={person.displayName} size={56} eager off={avatarOff} />
            <h1 className="page-title">{person.displayName}</h1>
          </div>
          <p className="page-subtitle">
            {person.position || "เจ้าหน้าที่"}
            {person.email ? ` · ${person.email}` : ""}
            {person.isActive ? "" : " · ปิดใช้งานอยู่"}
          </p>
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

      <section className="person-grid">
        <div className="panel">
          <h2>LINE</h2>
          {person.lineLinked ? (
            <>
              <StatusPill
                label={`ผูก LINE แล้ว${person.lineLinkedAt ? ` · ${formatThaiDateTime(person.lineLinkedAt)}` : ""}`}
                tone="green"
              />
              <form action={unlinkPersonLine} style={{ marginTop: 12 }}>
                <input type="hidden" name="personId" value={person.id} />
                <input type="hidden" name="returnTo" value={here} />
                <ConfirmSubmit
                  className="button secondary danger"
                  message={`ยกเลิกผูก LINE ของ ${person.displayName}? จะไม่ได้รับแจ้งเตือนจนกว่าจะกดผูกบัญชีใหม่`}
                >
                  ยกเลิกผูก LINE
                </ConfirmSubmit>
              </form>
            </>
          ) : (
            <>
              <StatusPill label="ยังไม่ผูก LINE" tone="amber" />
              <p style={{ marginTop: 10 }}>
                ให้เจ้าตัวเพิ่มเพื่อน ผู้ช่วยงาน ปชส. แล้วกด &quot;ผูกบัญชี&quot; ในแชท
              </p>
            </>
          )}
        </div>

        <div className="panel">
          <h2>บัญชีผู้ใช้</h2>
          {person.accounts.length === 0 ? (
            <p>ยังไม่มีบัญชีที่ผูกกับบุคลากรคนนี้ — สร้างได้ที่หน้าตั้งค่า</p>
          ) : (
            person.accounts.map((a) => (
              <div key={a.id} style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                <strong>{a.username ? `@${a.username}` : "(ไม่มีชื่อผู้ใช้)"} · {ROLE_LABELS_TH[a.role]}</strong>
                <div className="account-chips" style={{ margin: 0 }}>
                  {a.suspended ? <StatusPill label="ระงับอยู่" tone="red" /> : null}
                  <StatusPill
                    label={a.lastSignInAt ? `เข้าใช้ล่าสุด ${formatThaiDateTime(a.lastSignInAt)}` : "ยังไม่เคยเข้าใช้"}
                    tone={a.lastSignInAt ? "blue" : "gray"}
                  />
                </div>
                {a.id !== user.id ? (
                  <form action={setAccountSuspended}>
                    <input type="hidden" name="accountId" value={a.id} />
                    <input type="hidden" name="suspend" value={(!a.suspended).toString()} />
                    <input type="hidden" name="returnTo" value={here} />
                    {a.suspended ? (
                      <button className="button secondary" type="submit">เปิดใช้บัญชี</button>
                    ) : (
                      <ConfirmSubmit
                        className="button secondary danger"
                        message={`ระงับบัญชี ${a.username ? `@${a.username}` : ""}? จะเข้าระบบไม่ได้จนกว่าจะเปิดใช้อีกครั้ง`}
                      >
                        ระงับบัญชี
                      </ConfirmSubmit>
                    )}
                  </form>
                ) : null}
              </div>
            ))
          )}
        </div>

        <div className="panel">
          <h2>30 วันที่ผ่านมา</h2>
          <div className="person-stats">
            <div>
              <strong>{person.past30.assigned}</strong>
              ได้รับมอบหมาย
            </div>
            <div>
              <strong>{person.past30.acknowledged}</strong>
              รับทราบ
            </div>
            <div>
              <strong>{person.past30.unavailable}</strong>
              แจ้งไม่สะดวก
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>งานที่จะถึง (30 วัน)</h2>
        {person.upcoming.length === 0 ? (
          <p>ไม่มีงานที่ได้รับมอบหมายใน 30 วันข้างหน้า</p>
        ) : (
          <div className="table-wrap">
            <table className="event-table">
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>งาน</th>
                  <th>หน้าที่</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {person.upcoming.map((t) => (
                  <tr key={t.assignmentId}>
                    <td>
                      {formatThaiDate(t.eventDate)} {t.startTime}
                    </td>
                    <td>
                      <Link href={`/events/${t.eventId}`}>{t.title}</Link>
                      {t.eventStatus === "draft" ? <small className="ack-tag"> · ร่าง</small> : null}
                    </td>
                    <td>{t.roleName}</td>
                    <td>
                      <AckPill task={t} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>ข้อความ LINE ที่ส่งถึง (20 รายการล่าสุด)</h2>
        {person.notifications.length === 0 ? (
          <p>ยังไม่มีข้อความ</p>
        ) : (
          <div className="table-wrap">
            <table className="event-table">
              <thead>
                <tr>
                  <th>เวลา</th>
                  <th>ประเภท</th>
                  <th>งาน</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {person.notifications.map((n) => (
                  <tr key={n.id}>
                    <td>{formatThaiDateTime(n.at)}</td>
                    <td>{NOTIF_TYPE_TH[n.type] ?? n.type}</td>
                    <td>{n.eventTitle}</td>
                    <td>
                      {NOTIF_STATUS_TH[n.status] ?? n.status}
                      {n.error ? <small className="ack-tag"> · {n.error}</small> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>ประวัติการเปลี่ยนแปลง</h2>
        {person.audit.length === 0 ? (
          <p>ยังไม่มีประวัติ</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
            {person.audit.map((r) => (
              <li key={r.id}>
                <strong>{formatThaiDateTime(r.at)}</strong> · {AUDIT_TH[r.action] ?? r.action} — {r.summary}
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
