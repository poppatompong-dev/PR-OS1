// คำถามจากทีม on /settings (owner, 12 Nov 2026: "คุยกับน้องให้จบข้อสงสัย"):
// questions the bot could not answer, open ones first, each with a reply box
// that the bot delivers on Telegram. Server component, plain forms.

import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { answerTeamQuestion, closeTeamQuestion, escalateTeamQuestion, handleHelpSignal } from "@/lib/settings/mutations";
import type { HelpSignal, TeamQuestion } from "@/lib/telegram/questions";

const fmt = (iso: string) => new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export function TeamQuestionsPanel({ questions, help = [] }: { questions: TeamQuestion[]; help?: HelpSignal[] }) {
  const open = questions.filter((q) => !q.answer);
  return (
    <section className="panel team-requests" id="team-questions">
      <div className="panel-heading">
        <div>
          <h2>💬 คำถามจากทีม</h2>
          <p>คำถามที่บอทตอบเองไม่ได้ (21 วันล่าสุด) · ยังไม่ตอบ {open.length} ข้อ · ตอบที่นี่ บอทส่งถึงเจ้าตัวทาง Telegram</p>
        </div>
      </div>
      <h3 id="team-help">🆘 ต้องการความช่วยเหลือ ({help.length})</h3>
      <p className="team-muted">ข้อความที่บอทไม่เข้าใจ และคำตอบ 😕 ยังงงอยู่ / 💬 อยากบอก (7 วัน) · ตอบแล้วบอทส่งถึงเจ้าตัว</p>
      <div className="team-req-list">
        {help.map((h) => (
          <details key={h.id} className="team-req" data-signal={h.id} open>
            <summary>
              <b>{h.kind === "buddy" ? "🤖 ชวนคุย" : h.kind === "unknown" ? "🤔 บอทไม่เข้าใจ" : h.kind === "confused" ? "😕 ยังงงอยู่" : "💬 อยากบอก"}</b> · {h.name}: {h.text.length > 70 ? `${h.text.slice(0, 69)}…` : h.text} <small>({fmt(h.at)})</small>
            </summary>
            <form action={handleHelpSignal} className="team-add-form">
              <input type="hidden" name="signalId" value={h.id} />
              <input type="hidden" name="personId" value={h.personId} />
              {h.kind === "buddy" ? <input type="hidden" name="buddy" value="on" /> : null}
              <label className="form-field">
                ตอบ (เว้นว่าง = ปิดโดยไม่ส่ง)
                <textarea className="input" name="reply" rows={2} maxLength={1000} />
              </label>
              <ConfirmSubmit className="button primary" message={`ส่ง/ปิดรายการของ ${h.name}?`}>ส่ง / ปิด</ConfirmSubmit>
            </form>
          </details>
        ))}
      </div>
      <h3>❓ คำถามที่ส่งถึงแอดมิน</h3>
      {questions.length === 0 ? <p className="team-muted">ยังไม่มีคำถาม</p> : null}
      <div className="team-req-list">
        {questions.map((q) => (
          <details key={q.code} className="team-req" data-code={q.code} open={!q.answer}>
            <summary>
              <b>{q.answer ? (q.answer.text === "(ปิด ไม่ต้องตอบ)" ? "☑️ ปิดแล้ว" : "✅ ตอบแล้ว") : q.held ? "⏳ พักไว้ รอตอบ" : "❓ รอตอบ"}</b> · {q.name}: {q.text.length > 60 ? `${q.text.slice(0, 59)}…` : q.text} <small>({fmt(q.at)} · #Q{q.code})</small>
            </summary>
            <p className="team-muted">คำถาม: {q.text}</p>
            {q.answer ? <p className="team-muted">คำตอบ ({fmt(q.answer.at)}): {q.answer.text}</p> : null}
            <form action={answerTeamQuestion} className="team-add-form">
              <input type="hidden" name="code" value={q.code} />
              <label className="form-field">
                {q.answer ? "ตอบเพิ่ม" : "คำตอบ"}
                <textarea className="input" name="answer" rows={2} maxLength={1500} required />
              </label>
              <ConfirmSubmit className="button primary" message={`ส่งคำตอบถึง ${q.name} ทาง Telegram?`}>ส่งคำตอบ</ConfirmSubmit>
            </form>
            {!q.answer && q.held ? (
              <form action={escalateTeamQuestion} className="team-add-form">
                <input type="hidden" name="code" value={q.code} />
                <ConfirmSubmit className="button secondary" message="ส่งคำถามนี้ต่อให้แอดมินทาง Telegram?">📣 ส่งต่อแอดมิน</ConfirmSubmit>
              </form>
            ) : null}
            {q.answer ? null : (
              <form action={closeTeamQuestion} className="team-add-form">
                <input type="hidden" name="code" value={q.code} />
                <ConfirmSubmit className="button secondary" message="ปิดข้อนี้โดยไม่ส่งข้อความหาน้อง?">ปิด (ไม่ต้องตอบ)</ConfirmSubmit>
              </form>
            )}
          </details>
        ))}
      </div>
    </section>
  );
}
