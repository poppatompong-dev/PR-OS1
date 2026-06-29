import { StatusPill } from "@/components/StatusPill";
import { events, people } from "@/data/mock-data";
import { ackStatusLabel, formatThaiDate } from "@/lib/format";
import { CheckCircle2, Clock3, MapPin } from "lucide-react";

const currentPerson = people[0];
const myEvents = events.filter((event) =>
  event.assignments.some((assignment) => assignment.person.id === currentPerson.id),
);

export default function MyTasksPage() {
  return (
    <main className="mobile-shell">
      <header className="page-header">
        <div>
          <h1 className="page-title">งานของฉัน</h1>
          <p className="page-subtitle">{currentPerson.displayName}</p>
        </div>
      </header>

      {myEvents.map((event) => {
        const assignment = event.assignments.find((item) => item.person.id === currentPerson.id);
        return (
          <article className="mobile-card" key={event.id}>
            <div className="toolbar">
              <StatusPill label={assignment ? assignment.role.name : "มอบหมาย"} tone="teal" />
              {event.hasChanges ? <StatusPill label="เปลี่ยนแปลง" tone="amber" /> : null}
            </div>
            <h2>{event.title}</h2>
            <p className="inline-meta">
              <Clock3 size={18} aria-hidden="true" />
              {formatThaiDate(event.eventDate)} เวลา {event.startTime}
            </p>
            <p className="inline-meta">
              <MapPin size={18} aria-hidden="true" />
              {event.location.name}
            </p>
            <p>{event.shortNote}</p>
            <p>{assignment ? ackStatusLabel(assignment.ackStatus) : ""}</p>
            <button className="button success">
              <CheckCircle2 size={18} aria-hidden="true" />
              รับทราบ
            </button>
          </article>
        );
      })}
    </main>
  );
}
