import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { events } from "@/data/mock-data";
import { ackStatusLabel, eventStatusLabel, formatThaiDate } from "@/lib/format";

const event = events[0];

export default function EventDetailPage() {
  return (
    <AppShell>
      <header className="page-header">
        <div>
          <h1 className="page-title">{event.title}</h1>
          <p className="page-subtitle">
            {formatThaiDate(event.eventDate)} เวลา {event.startTime} ที่ {event.location.name}
          </p>
        </div>
        <div className="toolbar">
          <button className="button secondary">แก้ไข</button>
          <button className="button secondary">แจ้งเตือนซ้ำ</button>
          <button className="button">เสร็จสิ้น</button>
        </div>
      </header>

      <section className="panel">
        <h2>ข้อมูลหลัก</h2>
        <p>{event.description}</p>
        <p>เจ้าของเรื่อง: {event.ownerDepartment.name}</p>
        <p>ช่องทางรับเรื่อง: {event.intakeChannel}</p>
        <StatusPill label={eventStatusLabel(event.status)} tone="green" />
      </section>

      <section className="panel">
        <h2>ผู้ได้รับมอบหมาย</h2>
        <div className="assignee-list">
          {event.assignments.map((assignment) => (
            <span key={assignment.id}>
              {assignment.role.name}: {assignment.person.displayName} - {ackStatusLabel(assignment.ackStatus)}
            </span>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Audit Preview</h2>
        <p>สร้างงานโดย staff เมื่อ 29 มิ.ย. 2569 เวลา 09:20</p>
        <p>เผยแพร่โดย supervisor เมื่อ 29 มิ.ย. 2569 เวลา 09:45</p>
      </section>
    </AppShell>
  );
}
