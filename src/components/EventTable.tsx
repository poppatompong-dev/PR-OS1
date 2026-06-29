import type { PrEvent } from "@/types/domain";
import { ackStatusLabel, eventStatusLabel, formatThaiDate, urgencyLabel } from "@/lib/format";
import { StatusPill } from "@/components/StatusPill";
import { Clock3, MapPin, UserCheck } from "lucide-react";

function statusTone(status: PrEvent["status"]) {
  if (status === "published") return "green";
  if (status === "canceled") return "red";
  if (status === "completed") return "blue";
  return "gray";
}

export function EventTable({ events }: { events: PrEvent[] }) {
  return (
    <div className="table-wrap">
      <table className="event-table">
        <thead>
          <tr>
            <th>วันเวลา</th>
            <th>งาน</th>
            <th>สถานที่</th>
            <th>เจ้าของเรื่อง</th>
            <th>ผู้ปฏิบัติงาน</th>
            <th>สถานะ</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td className="time-cell">
                <strong>{formatThaiDate(event.eventDate)}</strong>
                <span>
                  <Clock3 size={15} aria-hidden="true" />
                  {event.startTime}{event.endTime ? `-${event.endTime}` : ""}
                </span>
              </td>
              <td>
                <div className="table-title">{event.title}</div>
                <div className="table-note">
                  {urgencyLabel(event.urgency)}
                  {event.hasChanges ? " / มีการเปลี่ยนแปลง" : ""}
                </div>
              </td>
              <td>
                <span className="inline-meta">
                  <MapPin size={15} aria-hidden="true" />
                  {event.location.name}
                </span>
              </td>
              <td>{event.ownerDepartment.shortName}</td>
              <td>
                <div className="assignee-list">
                  {event.assignments.map((assignment) => (
                    <span key={assignment.id}>
                      <UserCheck size={15} aria-hidden="true" />
                      {assignment.role.name}: {assignment.person.displayName} ({ackStatusLabel(assignment.ackStatus)})
                    </span>
                  ))}
                </div>
              </td>
              <td>
                <StatusPill label={eventStatusLabel(event.status)} tone={statusTone(event.status)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
