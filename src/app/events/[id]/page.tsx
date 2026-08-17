import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { getEventAuditLog, getEventById, getEventFormData } from "@/lib/events/queries";
import { cancelEvent, completeEvent, deleteEvent, publishEvent } from "@/lib/events/mutations";
import { addAssignment, removeAssignment } from "@/lib/assignments/mutations";
import { checkConflictsForEvent } from "@/lib/assignments/queries";
import { getEventAttachments } from "@/lib/attachments/queries";
import { deleteAttachment, uploadAttachment } from "@/lib/attachments/mutations";
import { createClient } from "@/lib/supabase/server";
import { can, getSessionUser, type AppRole } from "@/lib/auth/roles";
import { isSupabaseConfigured } from "@/lib/env";
import {
  ackStatusLabel,
  eventStatusLabel,
  formatFileSize,
  formatThaiDate,
  urgencyLabel,
} from "@/lib/format";
import { AlertTriangle, Copy, Download, Paperclip } from "lucide-react";
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

  let role: AppRole = "assignee";
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const user = await getSessionUser(supabase);
    role = user?.role ?? "assignee";
  }
  const audit = await getEventAuditLog(id);

  const canEdit = can.editPublished(role) && (event.status === "draft" || event.status === "published");
  const canPublish = can.publishEvent(role) && event.status === "draft";
  const canComplete = can.publishEvent(role) && event.status === "published";
  const canCancel = can.cancelEvent(role) && (event.status === "draft" || event.status === "published");
  const canDelete = can.cancelEvent(role);
  const canManageAssignments =
    can.manageAssignments(role) && (event.status === "draft" || event.status === "published");

  const formData = canManageAssignments ? await getEventFormData() : null;
  const personIds = event.assignments.map((a) => a.person.id).filter(Boolean);
  const conflicts = await checkConflictsForEvent(event.id, event.eventDate, personIds);
  // RLS decides visibility: backend roles see all files, an assignee only sees
  // files on events assigned to them. Upload/delete stay backend-only.
  const attachments = await getEventAttachments(id);
  const canManageAttachments = can.editPublished(role);

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
            {event.assignments.map((assignment) => {
              const personConflicts = conflicts[assignment.person.id] ?? [];
              return (
                <div className="assignment-row" key={assignment.id} style={{ flexDirection: "column", alignItems: "stretch" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%" }}>
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
                  {personConflicts.length > 0 ? (
                    <div
                      style={{
                        margin: "4px 0 6px 0",
                        padding: "6px 10px",
                        borderRadius: "var(--radius)",
                        background: "rgba(240, 166, 58, 0.12)",
                        border: "1px solid rgba(240, 166, 58, 0.4)",
                        color: "var(--amber)",
                        fontSize: "13px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <AlertTriangle size={15} aria-hidden="true" />
                      <span>
                        <strong>เวลาอาจชนกัน:</strong> มีงานอื่นในวันเดียวกัน —{" "}
                        {personConflicts
                          .map((c) => `${c.eventTitle} (${c.startTime}${c.endTime ? `-${c.endTime}` : ""}) ที่ ${c.locationName}`)
                          .join(", ")}
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
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

      <section className="panel">
        <h2>
          <Paperclip size={18} aria-hidden="true" /> ไฟล์แนบ (ส่วนตัว)
        </h2>
        <p className="panel-hint">
          ไฟล์แนบเป็นความลับ เปิดได้เฉพาะผู้มีสิทธิ์ ลิงก์ดาวน์โหลดหมดอายุใน 60 วินาที และไม่แสดงบนจอมอนิเตอร์
        </p>
        {attachments.length > 0 ? (
          <div>
            {attachments.map((file) => (
              <div className="assignment-row" key={file.id}>
                <div className="assignment-main">
                  <a className="attachment-link" href={`/api/attachments/${file.id}`}>
                    <Download size={16} aria-hidden="true" />
                    {file.fileName}
                  </a>{" "}
                  <span className="ack-tag">— {formatFileSize(file.sizeBytes)}</span>
                </div>
                {canManageAttachments ? (
                  <form action={deleteAttachment}>
                    <input type="hidden" name="eventId" value={event.id} />
                    <input type="hidden" name="attachmentId" value={file.id} />
                    <button className="button secondary" type="submit">ลบไฟล์</button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p>ยังไม่มีไฟล์แนบ</p>
        )}

        {canManageAttachments ? (
          <form action={uploadAttachment} className="assignment-add">
            <input type="hidden" name="eventId" value={event.id} />
            <label className="form-field">
              เลือกไฟล์ (PDF/Word/Excel/รูปภาพ ไม่เกิน 10 MB)
              <input
                className="input"
                type="file"
                name="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                required
              />
            </label>
            <button className="button" type="submit">แนบไฟล์</button>
          </form>
        ) : null}
      </section>

      {canEdit || canPublish || canComplete || canDelete ? (
        <section className="panel">
          <h2>การดำเนินการ</h2>
          <div className="form-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
            <Link className="button secondary" href={`/events/new?cloneFrom=${event.id}`}>
              <Copy size={16} aria-hidden="true" />
              คัดลอกงาน
            </Link>
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
