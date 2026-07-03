import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { getEventAuditLog, getEventById, getEventFormData } from "@/lib/events/queries";
import { cancelEvent, completeEvent, deleteEvent, publishEvent } from "@/lib/events/mutations";
import { addAssignment, removeAssignment } from "@/lib/assignments/mutations";
import { createClient } from "@/lib/supabase/server";
import { can, getSessionUser } from "@/lib/auth/roles";
import {
  ackStatusLabel,
  eventStatusLabel,
  formatThaiDate,
  urgencyLabel,
} from "@/lib/format";
import type { EventStatus } from "@/types/domain";

export const dynamic = "force-dynamic";

function statusTone(status: EventStatus) {
  if (status === "published") return "green";
  if (status === "canceled") return "red";
  if (status === "completed") return "blue";
  return "gray";
}

function formatThaiDateTime(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const event = await getEventById(id);
  if (!event) notFound();

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  const role = user?.role ?? "assignee";
  const audit = await getEventAuditLog(id);

  const canEdit = can.editPublished(role) && (event.status === "draft" || event.status === "published");
  const canPublish = can.publishEvent(role) && event.status === "draft";
  const canComplete = can.publishEvent(role) && event.status === "published";
  const canCancel = can.cancelEvent(role) && (event.status === "draft" || event.status === "published");
  const canDelete = can.cancelEvent(role);
  const canManageAssignments =
    can.manageAssignments(role) && (event.status === "draft" || event.status === "published");

  const formData = canManageAssignments ? await getEventFormData() : null;

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <h1 className="page-title">{event.title}</h1>
          <p className="page-subtitle">
            {formatThaiDate(event.eventDate)} เวลา {event.startTime}
            {event.endTime ? `-${event.endTime}` : ""} ที่ {event.location.name}
          </p>
        </div>
        <StatusPill label={eventStatusLabel(event.status)} tone={statusTone(event.status)} />
      </header>

      {error ? <div className="login-error">{error}</div> : null}

      <section className="panel">
        <h2>ข้อมูลหลัก</h2>
        {event.description ? <p>{event.description}</p> : null}
        <p>เจ้าของเรื่อง: {event.ownerDepartment.name}</p>
        <p>ประเภทงาน: {event.eventType} · ความสำคัญ: {urgencyLabel(event.urgency)}</p>
        <p>ช่องทางรับเรื่อง: {event.intakeChannel}</p>
        {event.shortNote ? <p>หมายเหตุจอมอนิเตอร์: {event.shortNote}</p> : null}
        {event.internalNote ? <p>หมายเหตุภายใน: {event.internalNote}</p> : null}
        {event.status === "canceled" && event.cancellationReason ? (
          <p className="login-error">เหตุผลการยกเลิก: {event.cancellationReason}</p>
        ) : null}
      </section>

      <section className="panel">
        <h2>ผู้ได้รับมอบหมาย</h2>
        {event.assignments.length > 0 ? (
          <div>
            {event.assignments.map((assignment) => (
              <div className="assignment-row" key={assignment.id}>
                <div className="assignment-main">
                  <strong>{assignment.role.name}</strong>: {assignment.person.displayName}{" "}
                  <span className="ack-tag">— {ackStatusLabel(assignment.ackStatus)}</span>
                </div>
                {canManageAssignments ? (
                  <form action={removeAssignment}>
                    <input type="hidden" name="eventId" value={event.id} />
                    <input type="hidden" name="assignmentId" value={assignment.id} />
                    <button className="button secondary" type="submit">นำออก</button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p>ยังไม่มีผู้รับผิดชอบ</p>
        )}

        {canManageAssignments && formData ? (
          <form action={addAssignment} className="assignment-add">
            <input type="hidden" name="eventId" value={event.id} />
            <label className="form-field">
              บุคคล
              <select className="select" name="personId" defaultValue="">
                <option value="">— เลือก —</option>
                {formData.people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              บทบาท
              <select className="select" name="roleId" defaultValue="">
                <option value="">— เลือก —</option>
                {formData.roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="button" type="submit">เพิ่มผู้รับผิดชอบ</button>
          </form>
        ) : null}
      </section>

      {canEdit || canPublish || canComplete || canDelete ? (
        <section className="panel">
          <h2>การดำเนินการ</h2>
          <div className="form-actions" style={{ justifyContent: "flex-start" }}>
            {canEdit ? (
              <Link className="button secondary" href={`/events/${event.id}/edit`}>แก้ไข</Link>
            ) : null}
            {canPublish ? (
              <form action={publishEvent}>
                <input type="hidden" name="eventId" value={event.id} />
                <button className="button" type="submit">เผยแพร่</button>
              </form>
            ) : null}
            {canComplete ? (
              <form action={completeEvent}>
                <input type="hidden" name="eventId" value={event.id} />
                <button className="button secondary" type="submit">ปิดงาน (เสร็จสิ้น)</button>
              </form>
            ) : null}
            {canDelete ? (
              <form action={deleteEvent}>
                <input type="hidden" name="eventId" value={event.id} />
                <button className="button secondary" type="submit">ลบงาน</button>
              </form>
            ) : null}
          </div>
        </section>
      ) : null}

      {canCancel ? (
        <section className="panel">
          <h2>ยกเลิกงาน</h2>
          <form action={cancelEvent} className="form-grid">
            <input type="hidden" name="eventId" value={event.id} />
            <label className="form-field full">
              เหตุผลการยกเลิก *
              <input className="input" name="reason" required placeholder="เช่น เจ้าของเรื่องแจ้งเลื่อน" />
            </label>
            <div className="form-actions full" style={{ justifyContent: "flex-start" }}>
              <button className="button secondary" type="submit">ยืนยันยกเลิกงาน</button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="panel">
        <h2>ประวัติการเปลี่ยนแปลง (Audit)</h2>
        {audit.length > 0 ? (
          <ul className="audit-list">
            {audit.map((entry) => (
              <li key={entry.id}>
                <span className="audit-time">{formatThaiDateTime(entry.changedAt)}</span>
                <span>{entry.summary}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>ยังไม่มีประวัติ หรือบัญชีของคุณไม่มีสิทธิ์ดู audit</p>
        )}
      </section>
    </AppShell>
  );
}
