import { AppShell } from "@/components/AppShell";
import { departments, locations, people, roles } from "@/data/mock-data";

export default function NewEventPage() {
  return (
    <AppShell>
      <header className="page-header">
        <div>
          <h1 className="page-title">เพิ่มงานประชาสัมพันธ์</h1>
          <p className="page-subtitle">Mock form สำหรับคุย requirement กับผู้ใช้งานและโปรแกรมเมอร์</p>
        </div>
        <div className="toolbar">
          <button className="button secondary">บันทึกร่าง</button>
          <button className="button">เผยแพร่</button>
        </div>
      </header>

      <form className="panel form-grid">
        <label className="form-field full">
          ชื่องาน
          <input className="input" defaultValue="กิจกรรมตัวอย่างประชาสัมพันธ์" />
        </label>
        <label className="form-field">
          วันที่
          <input className="input" type="date" defaultValue="2026-07-05" />
        </label>
        <label className="form-field">
          เวลาเริ่ม
          <input className="input" type="time" defaultValue="09:00" />
        </label>
        <label className="form-field">
          สถานที่
          <select className="select" defaultValue={locations[0].id}>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          หน่วยงานเจ้าของเรื่อง
          <select className="select" defaultValue={departments[0].id}>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          ช่องทางรับเรื่อง
          <select className="select" defaultValue="official_letter">
            <option value="official_letter">หนังสือราชการ</option>
            <option value="line">LINE กลุ่มสารบรรณ</option>
            <option value="phone">โทรศัพท์</option>
            <option value="walk_in">เดินมาแจ้ง</option>
          </select>
        </label>
        <label className="form-field">
          ความสำคัญ
          <select className="select" defaultValue="normal">
            <option value="normal">ปกติ</option>
            <option value="important">สำคัญ</option>
            <option value="urgent">ด่วน</option>
          </select>
        </label>
        <label className="form-field">
          ผู้ปฏิบัติงาน
          <select className="select" defaultValue={people[0].id}>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          บทบาท
          <select className="select" defaultValue={roles[1].id}>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field full">
          หมายเหตุบนจอมอนิเตอร์
          <textarea className="textarea" defaultValue="เตรียมถ่ายภาพช่วงประธานเปิดงาน" />
        </label>
        <label className="form-field full">
          หมายเหตุภายใน
          <textarea className="textarea" defaultValue="ข้อมูลส่วนนี้ไม่แสดงบนจอมอนิเตอร์" />
        </label>
      </form>
    </AppShell>
  );
}
