import { StatusPill } from "@/components/StatusPill";
import { getMyAssignments } from "@/lib/assignments/queries";
import { acknowledgeAssignment } from "@/lib/assignments/mutations";
import { eventStatusLabel, formatThaiDate } from "@/lib/format";
import { isLineLoginConfigured } from "@/lib/env";
import { CheckCircle2, Clock3, MapPin, MessageCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MyTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; line?: string }>;
}) {
  const { error, line } = await searchParams;
  const { displayName, personLinked, lineLinked, tasks } = await getMyAssignments();

  return (
    <main className="mobile-shell">
      <header className="page-header">
        <div>
          <h1 className="page-title">งานของฉัน</h1>
          <p className="page-subtitle">{displayName ?? "ผู้ใช้งาน"}</p>
        </div>
      </header>

      {error ? <div className="login-error">{error}</div> : null}
      {line === "linked" ? (
        <div
          className="login-error"
          style={{ background: "rgba(24,120,74,.1)", borderColor: "rgba(24,120,74,.35)", color: "var(--green)" }}
        >
          เชื่อมต่อบัญชี LINE สำเร็จ — พร้อมรับแจ้งเตือนงานทาง LINE แล้ว
        </div>
      ) : null}

      {personLinked && !lineLinked && isLineLoginConfigured() ? (
        <div className="mobile-card">
          <h2>รับแจ้งเตือนงานทาง LINE</h2>
          <p>เชื่อมต่อบัญชี LINE ของคุณเพื่อรับแจ้งเตือนงานที่ได้รับมอบหมายโดยตรง</p>
          <a className="button coral" href="/api/auth/line/start">
            <MessageCircle size={18} aria-hidden="true" />
            เชื่อมต่อ LINE
          </a>
        </div>
      ) : null}

      {!personLinked ? (
        <div className="mobile-card">
          <h2>ยังไม่ได้ผูกบัญชีกับรายชื่อบุคลากร</h2>
          <p>
            บัญชีนี้ยังไม่ถูกผูกกับรายชื่อเจ้าหน้าที่ จึงยังไม่เห็นงานที่ได้รับมอบหมาย
            กรุณาให้ผู้ดูแลระบบผูกบัญชีในหน้าตั้งค่า
          </p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="mobile-card">
          <h2>ยังไม่มีงานที่ได้รับมอบหมาย</h2>
          <p>เมื่อมีงานมอบหมายให้คุณ งานจะแสดงที่นี่</p>
        </div>
      ) : (
        tasks.map((task) => (
          <article className="mobile-card" key={task.assignmentId}>
            <div className="toolbar">
              <StatusPill label={task.roleName} tone="teal" />
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

            {task.acknowledged ? (
              <p className="ack-done">
                <CheckCircle2 size={18} aria-hidden="true" /> รับทราบแล้ว
              </p>
            ) : (
              <form action={acknowledgeAssignment}>
                <input type="hidden" name="assignmentId" value={task.assignmentId} />
                <input type="hidden" name="assignmentVersion" value={task.assignmentVersion} />
                <button className="button success" type="submit">
                  <CheckCircle2 size={18} aria-hidden="true" />
                  รับทราบ
                </button>
              </form>
            )}
          </article>
        ))
      )}
    </main>
  );
}
