// คำถามจากทีม on /settings (owner, 12 Nov 2026: "คุยกับน้องให้จบข้อสงสัย"):
// questions the bot could not answer, open ones first, each with a reply box
// that the bot delivers on Telegram. Server component, plain forms.

import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { answerTeamQuestion } from "@/lib/settings/mutations";
import type { TeamQuestion } from "@/lib/telegram/questions";

const fmt = (iso: string) => new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export function TeamQuestionsPanel({ questions }: { questions: TeamQuestion[] }) {
  const open = questions.filter((q) => !q.answer);
  return (
    <section className="panel team-requests" id="team-questions">
      <div className="panel-heading">
        <div>
          <h2>💬 คำถามจากทีม</h2>
          <p>คำถามที่บอทตอบเองไม่ได้ (21 วันล่าสุด) · ยังไม่ตอบ {open.length} ข้อ · ตอบที่นี่ บอทส่งถึงเจ้าตัวทาง Telegram</p>
        </div>
      </div>
      {questions.length === 0 ? <p className="team-muted">ยังไม่มีคำถาม</p> : null}
      <div className="team-req-list">
        {questions.map((q) => (
          <details key={q.code} className="team-req" data-code={q.code} open={!q.answer}>
            <summary>
              <b>{q.answer ? "✅ ตอบแล้ว" : "❓ รอตอบ"}</b> · {q.name}: {q.text.length > 60 ? `${q.text.slice(0, 59)}…` : q.text} <small>({fmt(q.at)} · #Q{q.code})</small>
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
          </details>
        ))}
      </div>
    </section>
  );
}
