import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { getAvatarOffIds } from "@/lib/avatar-choice";
import { Avatar } from "@/components/Avatar";
import { StatusPill } from "@/components/StatusPill";
import { getMyAssignments } from "@/lib/assignments/queries";
import { acknowledgeAssignment, acknowledgeAssignmentQuietly, markUnavailable } from "@/lib/assignments/mutations";
import { AckButton } from "@/components/AckButton";
import { eventStatusLabel, formatThaiDate } from "@/lib/format";
import { isLineLoginConfigured, isSupabaseConfigured } from "@/lib/env";
import { Ban, CheckCircle2, Clock3, MapPin, MessageCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MyTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; line?: string; unavailable?: string }>;
}) {
  const { error, line, unavailable } = await searchParams;
  const { displayName, personId, personLinked, lineLinked, tasks } = await getMyAssignments();
  const avatarOff = personId && isSupabaseConfigured() ? (await getAvatarOffIds(await createClient())).has(personId) : false;

  return (
    <AppShell>
      <header className="page-header">
        <div className="page-header-person">
          <Avatar personId={personId} name={displayName ?? "ผู้ใช้งาน"} size={52} eager off={avatarOff} />
          <div>
            <h1 className="page-title">งานของฉัน</h1>
            <p className="page-subtitle">{displayName ?? "ผู้ใช้งาน"}</p>
          </div>
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

      {unavailable ? (
        <div className="login-error">
          แจ้งไม่สะดวกแล้ว — ระบบแจ้งแอดมินให้หาคนแทน ถ้าเปลี่ยนใจไปได้ กดรับทราบงานนั้นได้ตามเดิม
        </div>
      ) : null}

      {personLinked && !lineLinked && isLineLoginConfigured() ? (
        <div className="task-card">
          <h2>รับแจ้งเตือนงานทาง LINE</h2>
          <p>เชื่อมต่อบัญชี LINE ของคุณเพื่อรับแจ้งเตือนงานที่ได้รับมอบหมายโดยตรง</p>
          <a className="button coral" href="/link-line">
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
        tasks.map((task) => (
          <article className="task-card" key={task.assignmentId}>
            <div className="task-tags">
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
              <>
                {task.unavailableReason ? (
                  <p className="status-unavailable">
                    <Ban size={18} aria-hidden="true" /> แจ้งไม่สะดวกแล้ว: {task.unavailableReason}
                  </p>
                ) : null}
                <AckButton
                  assignmentId={task.assignmentId}
                  assignmentVersion={task.assignmentVersion}
                  eventTitle={task.event.title}
                  action={acknowledgeAssignment}
                  flushAction={acknowledgeAssignmentQuietly}
                />
                {!task.unavailableReason && task.event.status === "published" ? (
                  <details className="unavailable-form">
                    <summary>ไม่สะดวกไปงานนี้</summary>
                    <form action={markUnavailable}>
                      <input type="hidden" name="assignmentId" value={task.assignmentId} />
                      <label className="form-field">
                        เหตุผลสั้น ๆ (แอดมินจะเห็น)
                        <input
                          className="input"
                          name="reason"
                          maxLength={200}
                          required
                          placeholder="เช่น ติดภารกิจอื่น / ลา"
                        />
                      </label>
                      <button className="button secondary" type="submit">
                        แจ้งไม่สะดวก
                      </button>
                    </form>
                  </details>
                ) : null}
              </>
            )}
          </article>
        ))
      )}
    </AppShell>
  );
}
