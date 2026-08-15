import { AppShell } from "@/components/AppShell";
import { getEventById, getEventFormData } from "@/lib/events/queries";
import { createEvent } from "@/lib/events/mutations";

export const dynamic = "force-dynamic";

const INTAKE_CHANNELS = ["หนังสือราชการ", "LINE กลุ่มสารบรรณ", "โทรศัพท์", "เดินมาแจ้ง", "อื่นๆ"];

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; cloneFrom?: string }>;
}) {
  const { error, cloneFrom } = await searchParams;
  const [{ locations, departments, eventTypes, roles, people }, clone] = await Promise.all([
    getEventFormData(),
    cloneFrom ? getEventById(cloneFrom) : Promise.resolve(null),
  ]);

  const defaultPersonId = clone?.assignments?.[0]?.person?.id ?? "";
  const defaultRoleId = clone?.assignments?.[0]?.role?.id ?? "";

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <h1 className="page-title">{clone ? "คัดลอกและสร้างงานใหม่" : "เพิ่มงานประชาสัมพันธ์"}</h1>
          <p className="page-subtitle">
            {clone
              ? `คัดลอกจาก: ${clone.title} (กรุณาตรวจสอบวันและเวลาก่อนบันทึก)`
              : "บันทึกงานใหม่ลงฐานข้อมูลจริง — บันทึกร่างหรือเผยแพร่ได้"}
          </p>
        </div>
      </header>

      {error ? <div className="login-error">{error}</div> : null}

      <form className="panel form-grid" action={createEvent}>
        <label className="form-field full">
          ชื่องาน *
          <input
            className="input"
            name="title"
            required
            defaultValue={clone ? `${clone.title}` : ""}
            placeholder="เช่น พิธีเปิดโครงการ..."
          />
        </label>
        <label className="form-field">
          วันที่ *
          <input
            className="input"
            type="date"
            name="eventDate"
            required
            defaultValue={clone?.eventDate ?? ""}
          />
        </label>
        <label className="form-field">
          เวลาเริ่ม *
          <input
            className="input"
            type="time"
            name="startTime"
            required
            defaultValue={clone?.startTime ?? ""}
          />
        </label>
        <label className="form-field">
          เวลาสิ้นสุด
          <input
            className="input"
            type="time"
            name="endTime"
            defaultValue={clone?.endTime ?? ""}
          />
        </label>
        <label className="form-field">
          สถานที่
          <select className="select" name="locationId" defaultValue={clone?.location?.id ?? ""}>
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
          <select
            className="select"
            name="ownerDepartmentId"
            defaultValue={clone?.ownerDepartment?.id ?? ""}
          >
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
          <select className="select" name="eventTypeId" defaultValue={clone?.eventTypeId ?? ""}>
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
          <select
            className="select"
            name="intakeChannel"
            defaultValue={clone?.intakeChannel || INTAKE_CHANNELS[0]}
          >
            {INTAKE_CHANNELS.map((channel) => (
              <option key={channel} value={channel}>
                {channel}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          ความสำคัญ
          <select className="select" name="urgency" defaultValue={clone?.urgency ?? "normal"}>
            <option value="normal">ปกติ</option>
            <option value="important">สำคัญ</option>
            <option value="urgent">ด่วน</option>
          </select>
        </label>
        <label className="form-field">
          ผู้ปฏิบัติงาน
          <select className="select" name="personId" defaultValue={defaultPersonId}>
            <option value="">— ไม่ระบุ —</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.display_name}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          บทบาท
          <select className="select" name="roleId" defaultValue={defaultRoleId}>
            <option value="">— ไม่ระบุ —</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field full">
          หมายเหตุบนจอมอนิเตอร์
          <textarea
            className="textarea"
            name="shortNote"
            defaultValue={clone?.shortNote ?? ""}
            placeholder="ข้อความสั้นที่แสดงบนจอมอนิเตอร์"
          />
        </label>
        <label className="form-field full">
          หมายเหตุภายใน
          <textarea
            className="textarea"
            name="internalNote"
            defaultValue={clone?.internalNote ?? ""}
            placeholder="ข้อมูลส่วนนี้ไม่แสดงบนจอมอนิเตอร์"
          />
        </label>

        <div className="form-actions full">
          <button className="button secondary" type="submit" name="intent" value="draft">
            บันทึกร่าง
          </button>
          <button className="button" type="submit" name="intent" value="publish">
            เผยแพร่
          </button>
        </div>
      </form>
    </AppShell>
  );
}
