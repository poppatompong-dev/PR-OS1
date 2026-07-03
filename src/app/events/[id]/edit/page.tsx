import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { getEventById, getEventFormData } from "@/lib/events/queries";
import { editEvent } from "@/lib/events/mutations";

export const dynamic = "force-dynamic";

const INTAKE_CHANNELS = ["หนังสือราชการ", "LINE กลุ่มสารบรรณ", "โทรศัพท์", "เดินมาแจ้ง", "อื่นๆ"];

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const [event, formData] = await Promise.all([getEventById(id), getEventFormData()]);
  if (!event) notFound();

  const { locations, departments, eventTypes } = formData;

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <h1 className="page-title">แก้ไขงาน</h1>
          <p className="page-subtitle">
            {event.title} • การแก้ไขชื่อ/วันเวลา/สถานที่ ของงานที่เผยแพร่แล้ว จะรีเซ็ตการรับทราบและบันทึก audit
          </p>
        </div>
        <Link className="button secondary" href={`/events/${event.id}`}>
          ยกเลิก
        </Link>
      </header>

      {error ? <div className="login-error">{error}</div> : null}

      <form className="panel form-grid" action={editEvent}>
        <input type="hidden" name="eventId" value={event.id} />

        <label className="form-field full">
          ชื่องาน *
          <input className="input" name="title" required defaultValue={event.title} />
        </label>
        <label className="form-field">
          วันที่ *
          <input className="input" type="date" name="eventDate" required defaultValue={event.eventDate} />
        </label>
        <label className="form-field">
          เวลาเริ่ม *
          <input className="input" type="time" name="startTime" required defaultValue={event.startTime} />
        </label>
        <label className="form-field">
          เวลาสิ้นสุด
          <input className="input" type="time" name="endTime" defaultValue={event.endTime ?? ""} />
        </label>
        <label className="form-field">
          สถานที่
          <select className="select" name="locationId" defaultValue={event.location.id}>
            <option value="">— ไม่ระบุ —</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          หน่วยงานเจ้าของเรื่อง
          <select className="select" name="ownerDepartmentId" defaultValue={event.ownerDepartment.id}>
            <option value="">— ไม่ระบุ —</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          ประเภทงาน
          <select className="select" name="eventTypeId" defaultValue={event.eventTypeId ?? ""}>
            <option value="">— ไม่ระบุ —</option>
            {eventTypes.map((eventType) => (
              <option key={eventType.id} value={eventType.id}>
                {eventType.name}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          ช่องทางรับเรื่อง
          <select className="select" name="intakeChannel" defaultValue={event.intakeChannel || INTAKE_CHANNELS[0]}>
            {INTAKE_CHANNELS.map((channel) => (
              <option key={channel} value={channel}>
                {channel}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          ความสำคัญ
          <select className="select" name="urgency" defaultValue={event.urgency}>
            <option value="normal">ปกติ</option>
            <option value="important">สำคัญ</option>
            <option value="urgent">ด่วน</option>
          </select>
        </label>
        <label className="form-field full">
          หมายเหตุบนจอมอนิเตอร์
          <textarea className="textarea" name="shortNote" defaultValue={event.shortNote ?? ""} />
        </label>
        <label className="form-field full">
          หมายเหตุภายใน
          <textarea className="textarea" name="internalNote" defaultValue={event.internalNote ?? ""} />
        </label>

        <div className="form-actions full">
          <Link className="button secondary" href={`/events/${event.id}`}>
            ยกเลิก
          </Link>
          <button className="button" type="submit">
            บันทึกการแก้ไข
          </button>
        </div>
      </form>
    </AppShell>
  );
}
