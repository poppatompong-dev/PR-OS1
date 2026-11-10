// คำขอจากทีม on /settings (owner, 10 Nov 2026): every ขอลุค / ไอเดียแก็ก with its
// status. Changing to รอเลือก / เสร็จ tells the person on Telegram (when ticked);
// the TV board (bottom box) follows within 5 minutes. Server component, plain forms.

import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { addTeamRequest, setTeamRequestStatus } from "@/lib/settings/mutations";
import { REQ_STATUSES, REQ_STATUS_ICON, REQ_STATUS_TH, type TeamRequest } from "@/lib/team-requests";

const fmt = (iso: string) => new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" }).format(new Date(iso));

export function TeamRequestsPanel({ requests, people }: { requests: TeamRequest[]; people: { id: string; displayName: string }[] }) {
  const open = requests.filter((r) => r.status !== "done" && r.status !== "dropped");
  return (
    <section className="panel team-requests" id="team-requests">
      <div className="panel-heading">
        <div>
          <h2>🛠 คำขอจากทีม</h2>
          <p>ขอลุค / ไอเดียแก็กที่น้อง ๆ ส่งผ่านบอท · ค้างอยู่ {open.length} เรื่อง · ขึ้นกระดานในกล่องท้ายแถบล่างของทีวี</p>
        </div>
      </div>
      {requests.length === 0 ? <p className="team-muted">ยังไม่มีคำขอ</p> : null}
      <div className="team-req-list">
        {requests.map((r) => (
          <details key={r.id} className="team-req" data-request-id={r.id} data-person-id={r.personId}>
            <summary>
              <b>{REQ_STATUS_ICON[r.status]} {REQ_STATUS_TH[r.status]}</b> · {r.name} · {r.kind === "look_request" ? "ลุค" : "แก็ก"}: {r.topic} <small>({fmt(r.at)})</small>
            </summary>
            <p className="team-muted">ข้อความเดิม: {r.text}</p>
            <form action={setTeamRequestStatus} className="team-add-form">
              <input type="hidden" name="requestId" value={r.id} />
              <label className="form-field">
                สถานะ
                <select className="input" name="status" defaultValue={r.status}>
                  {REQ_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {REQ_STATUS_ICON[s]} {REQ_STATUS_TH[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                หัวข้อบนทีวี (สั้น ๆ)
                <input className="input" name="topic" maxLength={60} defaultValue={r.topic} />
              </label>
              <label className="form-field">
                รูปตัวอย่าง (เช่น /looks/nat-mermaid.jpg)
                <input className="input" name="image" defaultValue={r.image ?? ""} />
              </label>
              <label className="form-field">
                ข้อความถึงน้อง (ไม่บังคับ)
                <textarea className="input" name="note" rows={2} maxLength={500} />
              </label>
              <label className="team-check">
                <input type="checkbox" name="notify" defaultChecked /> แจ้งน้องทาง Telegram เมื่อเป็น “รอเลือก” หรือ “เสร็จ”
              </label>
              <ConfirmSubmit className="button primary" message="บันทึกสถานะคำขอนี้?">บันทึก</ConfirmSubmit>
            </form>
          </details>
        ))}
      </div>
      <details className="team-add">
        <summary className="button secondary">➕ เพิ่มคำขอแทนน้อง (บอกกันปากเปล่า)</summary>
        <form action={addTeamRequest} className="team-add-form">
          <label className="form-field">
            ใคร
            <select className="input" name="personId" required defaultValue="">
              <option value="" disabled>
                เลือก
              </option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            ประเภท
            <select className="input" name="kind" defaultValue="look_request">
              <option value="look_request">ลุคพิเศษ</option>
              <option value="gag_idea">ไอเดียแก็ก</option>
            </select>
          </label>
          <label className="form-field">
            เรื่องที่ขอ
            <input className="input" name="text" required maxLength={500} placeholder="เช่น อยากได้ลุคนักวิ่ง" />
          </label>
          <label className="form-field">
            สถานะเริ่มต้น
            <select className="input" name="status" defaultValue="received">
              {REQ_STATUSES.filter((s) => s !== "dropped").map((s) => (
                <option key={s} value={s}>
                  {REQ_STATUS_ICON[s]} {REQ_STATUS_TH[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            หัวข้อบนทีวี (ไม่บังคับ)
            <input className="input" name="topic" maxLength={60} />
          </label>
          <label className="form-field">
            รูปตัวอย่าง (ไม่บังคับ)
            <input className="input" name="image" placeholder="/looks/…jpg" />
          </label>
          <ConfirmSubmit className="button primary" message="เพิ่มคำขอนี้? (ไม่ส่งข้อความหาน้อง)">เพิ่ม</ConfirmSubmit>
        </form>
      </details>
    </section>
  );
}
