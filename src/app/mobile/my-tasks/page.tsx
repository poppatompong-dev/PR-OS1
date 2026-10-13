import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { getMyAssignments } from "@/lib/assignments/queries";
import {
  acknowledgeAssignment,
  acknowledgeAssignmentQuietly,
  declineAssignment,
} from "@/lib/assignments/mutations";
import { AckButton } from "@/components/AckButton";
import { eventStatusLabel, formatThaiDate } from "@/lib/format";
import { isLineLoginConfigured } from "@/lib/env";
import { startsInFuture } from "@/lib/date";
import { CheckCircle2, Clock3, MapPin, MessageCircle, UserX } from "lucide-react";

/**
 * "ไม่สะดวก" sits behind a disclosure so it is one deliberate step away from
 * the big green "รับทราบ" — a reason is required, and it reaches the
 * supervisors the moment it is sent. Plain form post, works without JS.
 */
function DeclineForm({ assignmentId, label }: { assignmentId: string; label: string }) {
  return (
    <details className="decline">
      <summary>
        <UserX size={18} aria-hidden="true" />
        {label}
      </summary>
      <form action={declineAssignment} className="decline-form">
        <input type="hidden" name="assignmentId" value={assignmentId} />
        <label className="form-field">
          เหตุผล (หัวหน้าจะเห็นข้อความนี้)
          <textarea
            className="textarea"
            name="reason"
            required
            maxLength={500}
            rows={3}
            placeholder="เช่น ติดภารกิจอื่นที่ได้รับมอบหมายก่อน"
          />
        </label>
        <button className="button secondary" type="submit">
          แจ้งไม่สะดวก
        </button>
      </form>
    </details>
  );
}

export const dynamic = "force-dynamic";

export default async function MyTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; line?: string; declined?: string }>;
}) {
  const { error, line, declined } = await searchParams;
  const { displayName, personLinked, lineLinked, tasks } = await getMyAssignments();

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <h1 className="page-title">งานของฉัน</h1>
          <p className="page-subtitle">{displayName ?? "ผู้ใช้งาน"}</p>
        </div>
      </header>

      {error ? <div className="login-error">{error}</div> : null}
      {declined === "1" ? (
        <div className="notice-ok" role="status">
          แจ้งไม่สะดวกแล้ว — ระบบส่งเรื่องให้หัวหน้างานแล้ว ถ้าภายหลังไปได้ กด “รับทราบ” ได้เลย
        </div>
      ) : null}
      {line === "linked" ? (
        <div
          className="login-error"
          style={{ background: "rgba(24,120,74,.1)", borderColor: "rgba(24,120,74,.35)", color: "var(--green)" }}
        >
          เชื่อมต่อบัญชี LINE สำเร็จ — พร้อมรับแจ้งเตือนงานทาง LINE แล้ว
        </div>
      ) : null}

      {personLinked && !lineLinked && isLineLoginConfigured() ? (
        <div className="task-card">
          <h2>รับแจ้งเตือนงานทาง LINE</h2>
          <p>เชื่อมต่อบัญชี LINE ของคุณเพื่อรับแจ้งเตือนงานที่ได้รับมอบหมายโดยตรง</p>
          <a className="button coral" href="/api/auth/line/start">
            <MessageCircle size={18} aria-hidden="true" />
            เชื่อมต่อ LINE
          </a>
        </div>
      ) : null}

      {!personLinked ? (
        <div className="task-card">
          <h2>ยังไม่ได้ผูกบัญชีกับรายชื่อบุคลากร</h2>
          <p>
            บัญชีนี้ยังไม่ถูกผูกกับรายชื่อเจ้าหน้าที่ จึงยังไม่เห็นงานที่ได้รับมอบหมาย
            กรุณาให้ผู้ดูแลระบบผูกบัญชีในหน้าตั้งค่า
          </p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="task-card">
          <h2>ยังไม่มีงานที่ได้รับมอบหมาย</h2>
          <p>เมื่อมีงานมอบหมายให้คุณ งานจะแสดงที่นี่</p>
        </div>
      ) : (
        tasks.map((task) => {
          // Only live, not-yet-started work can still be answered.
          const answerable =
            task.event.status === "published" &&
            startsInFuture(task.event.eventDate, task.event.startTime);
          return (
          <article className="task-card" key={task.assignmentId}>
            <div className="task-tags">
              <StatusPill label={task.roleName} tone="teal" />
              {task.declined ? <StatusPill label="แจ้งไม่สะดวกแล้ว" tone="red" /> : null}
              {task.event.hasChanges ? <StatusPill label="เปลี่ยนแปลง" tone="amber" /> : null}
              {task.event.status !== "published" ? (
                <StatusPill label={eventStatusLabel(task.event.status)} tone="gray" />
              ) : null}
            </div>
            <h2>{task.event.title}</h2>
            <p className="inline-meta">
              <Clock3 size={18} aria-hidden="true" />
              {formatThaiDate(task.event.eventDate)} เวลา {task.event.startTime}
              {task.event.endTime ? `-${task.event.endTime}` : ""}
            </p>
            <p className="inline-meta">
              <MapPin size={18} aria-hidden="true" />
              {task.event.locationName}
            </p>
            {task.event.shortNote ? <p>{task.event.shortNote}</p> : null}

            {task.declined ? (
              <p className="decline-note">
                เหตุผลที่แจ้ง: {task.declineReason ?? "—"} · รอหัวหน้าจัดคนแทน
                {answerable ? " — ถ้าไปได้แล้ว กดรับทราบได้" : ""}
              </p>
            ) : null}

            {task.acknowledged ? (
              <p className="ack-done">
                <CheckCircle2 size={18} aria-hidden="true" /> รับทราบแล้ว
              </p>
            ) : (
              <AckButton
                assignmentId={task.assignmentId}
                assignmentVersion={task.assignmentVersion}
                eventTitle={task.event.title}
                action={acknowledgeAssignment}
                flushAction={acknowledgeAssignmentQuietly}
              />
            )}

            {answerable && !task.declined ? (
              <DeclineForm
                assignmentId={task.assignmentId}
                label={task.acknowledged ? "ไปไม่ได้แล้ว? แจ้งไม่สะดวก" : "ไม่สะดวก"}
              />
            ) : null}
          </article>
          );
        })
      )}
    </AppShell>
  );
}
