import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { getEventAuditLog, getEventById, getEventFormData } from "@/lib/events/queries";
import { cancelEvent, completeEvent, deleteEvent, postponeEvent, publishEvent } from "@/lib/events/mutations";
import { addAssignment, removeAssignment, updateAssignmentRoles } from "@/lib/assignments/mutations";
import { RoleChips } from "@/components/RoleChips";
import { checkConflictsForEvent } from "@/lib/assignments/queries";
import { conflictLevel } from "@/lib/assignments/conflict";
import { getEventAttachments } from "@/lib/attachments/queries";
import { deleteAttachment, uploadAttachment } from "@/lib/attachments/mutations";
import { createClient } from "@/lib/supabase/server";
import { getAvatarOffIds } from "@/lib/avatar-choice";
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
import { AttachmentUpload } from "@/components/AttachmentUpload";
import { fileKind, isImageMime } from "@/lib/attachments/rules";

export const dynamic = "force-dynamic";

function statusTone(status: EventStatus) {
  if (status === "published") return "green";
  if (status === "canceled") return "red";
  if (status === "completed") return "blue";
  return "gray";
}

function formatThaiDateTime(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
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

  // Demo mode has no session to read a role from. Fall back to "staff" there
  // rather than "assignee", so the screen being demonstrated is the one the
  // office actually works in; with Supabase connected the real role decides,
  // and RLS still has the final say on every write.
  let role: AppRole = isSupabaseConfigured() ? "assignee" : "staff";
  let avatarOff = new Set<string>();
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const user = await getSessionUser(supabase);
    role = user?.role ?? "assignee";
    avatarOff = await getAvatarOffIds(supabase);
  }
  const audit = await getEventAuditLog(id);
  // Newest of "postpone" / "publish" decides whether the job is on hold right now.
  const lastHoldOrPublish = audit.find((a) => a.action === "postpone" || a.action === "publish");
  const onHold = event.status === "draft" && lastHoldOrPublish?.action === "postpone" ? lastHoldOrPublish : null;

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

      {onHold ? (
        <div className="hold-banner" role="status">
          <strong>⏸ งานนี้เลื่อนออกไปก่อน</strong> — {onHold.summary.replace(/^เลื่อนออกไปก่อน \(ยังไม่มีวันใหม่\): /, "เหตุผล: ")}
          <br />
          ทีมได้รับแจ้งแล้วว่ายังไม่ต้องไป · เมื่อได้วันใหม่: กด แก้ไข ใส่วันเวลาใหม่ แล้วกด เผยแพร่ ทีมจะได้การ์ดสีส้มให้รับทราบใหม่
        </div>
      ) : null}

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
                      <Avatar personId={assignment.person.id} name={assignment.person.displayName} size={30} off={avatarOff.has(assignment.person.id)} />{" "}
                      <strong>{assignment.role.name}</strong>: {assignment.person.displayName}{" "}
                      {assignment.unavailableReason && assignment.ackStatus !== "acknowledged" ? (
                        <span className="ack-tag status-unavailable">— ⛔ ไม่สะดวก: {assignment.unavailableReason}</span>
                      ) : (
                        <span className="ack-tag">— {ackStatusLabel(assignment.ackStatus)}</span>
                      )}
                    </div>
                    {canManageAssignments && formData ? (
                      <details className="role-edit">
                        <summary className="button secondary">แก้หน้าที่</summary>
                        <form action={updateAssignmentRoles} className="role-edit-form">
                          <input type="hidden" name="eventId" value={event.id} />
                          <input type="hidden" name="assignmentId" value={assignment.id} />
                          <RoleChips
                            roles={formData.roles}
                            name="roleIds"
                            defaultSelected={assignment.roleIds ?? [assignment.role.id]}
                            idPrefix={`edit-${assignment.id}`}
                          />
                          <button className="button" type="submit">บันทึกหน้าที่</button>
                          {event.status === "published" ? (
                            <small className="muted">เปลี่ยนหน้าที่แล้ว {assignment.person.displayName} จะได้การ์ดสีส้มให้กดรับทราบใหม่</small>
                          ) : null}
                        </form>
                      </details>
                    ) : null}
                    {canManageAssignments ? (
                      <form action={removeAssignment}>
                        <input type="hidden" name="eventId" value={event.id} />
                        <input type="hidden" name="assignmentId" value={assignment.id} />
                        <button className="button secondary" type="submit">นำออก</button>
                      </form>
                    ) : null}
                  </div>
                  {(() => {
                    const clashes = personConflicts.filter((c) => conflictLevel(event, c) === "clash");
                    const others = personConflicts.filter((c) => conflictLevel(event, c) !== "clash");
                    const label = (c: (typeof personConflicts)[number]) =>
                      `${c.eventTitle} (${c.startTime}${c.endTime ? `-${c.endTime}` : ""}) ที่ ${c.locationName}`;
                    return (
                      <>
                        {clashes.length > 0 ? (
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
                              <strong>เวลาชน:</strong> ทับกันหรือห่างกันไม่ถึง 30 นาที — {clashes.map(label).join(", ")}
                            </span>
                          </div>
                        ) : null}
                        {others.length > 0 ? (
                          <div style={{ margin: "2px 0 6px 0", fontSize: "12.5px", color: "var(--muted)" }}>
                            วันนี้มีงานอื่นด้วย: {others.map(label).join(", ")}
                          </div>
                        ) : null}
                      </>
                    );
                  })()}
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
            <div className="form-field">
              หน้าที่ (เลือกได้หลายอย่าง)
              <RoleChips roles={formData.roles} name="roleIds" idPrefix="add-role" />
            </div>
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
          <ul className="file-tiles">
            {attachments.map((file) => {
              const kind = fileKind(file.mimeType, file.fileName);
              return (
                <li className="file-tile" key={file.id}>
                  <a className="file-tile-link" href={`/api/attachments/${file.id}`} title={`เปิด ${file.fileName}`}>
                    <span className={`file-thumb file-thumb-${kind.tone}`}>
                      {isImageMime(file.mimeType) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/attachments/${file.id}/thumb`} alt="" loading="lazy" />
                      ) : (
                        <span aria-hidden="true">
                          {kind.icon}
                          <small>{kind.label}</small>
                        </span>
                      )}
                    </span>
                    <span className="file-name">{file.fileName}</span>
                    <span className="file-size">
                      <Download size={13} aria-hidden="true" /> {formatFileSize(file.sizeBytes)}
                    </span>
                  </a>
                  {canManageAttachments ? (
                    <form action={deleteAttachment}>
                      <input type="hidden" name="eventId" value={event.id} />
                      <input type="hidden" name="attachmentId" value={file.id} />
                      <button className="file-delete" type="submit" aria-label={`ลบ ${file.fileName}`}>
                        ลบ
                      </button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p>ยังไม่มีไฟล์แนบ</p>
        )}

        {canManageAttachments ? (
          <AttachmentUpload eventId={event.id} action={uploadAttachment} />
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

      {event.status === "published" && canComplete ? (
        <section className="panel">
          <h2>เลื่อนออกไปก่อน (ยังไม่มีวันใหม่)</h2>
          <p className="ack-tag">
            ถ้ารู้วันเวลาใหม่แล้ว ให้กด แก้ไข แทน · ปุ่มนี้พักงานไว้ ทีมได้แจ้งใน LINE ว่ายังไม่ต้องไป
            งานหายจากจอทีวีและการเตือน เมื่อได้วันใหม่ให้แก้วันเวลา แล้วกด เผยแพร่ ทีมจะได้การ์ดสีส้มให้รับทราบใหม่
          </p>
          <form action={postponeEvent} className="form-grid">
            <input type="hidden" name="eventId" value={event.id} />
            <label className="form-field full">
              เหตุผลที่เลื่อน *
              <input className="input" name="reason" required maxLength={200} placeholder="เช่น ผู้บริหารติดภารกิจ รอกำหนดวันใหม่" />
            </label>
            <div className="form-actions full" style={{ justifyContent: "flex-start" }}>
              <button className="button secondary" type="submit">⏸ เลื่อนออกไปก่อน</button>
            </div>
          </form>
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
