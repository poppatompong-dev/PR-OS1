import Link from "next/link";
import type { PrEvent } from "@/types/domain";
import { eventStatusLabel, urgencyLabel } from "@/lib/format";
import { MapPin, Users } from "lucide-react";

function statusTone(status: PrEvent["status"]) {
  if (status === "published") return "green";
  if (status === "canceled") return "red";
  if (status === "completed") return "blue";
  return "gray";
}

/**
 * Work items as stacked cards. Used where a row of table columns would be
 * unreadable on a phone — which is the primary device for this system.
 */
export function EventCardList({ events, emptyText }: { events: PrEvent[]; emptyText: string }) {
  if (events.length === 0) {
    return <p className="empty-note">{emptyText}</p>;
  }

  return (
    <ul className="event-cards">
      {events.map((event) => {
        const pending = event.assignments.filter((a) => a.ackStatus === "pending").length;
        const names = event.assignments.map((a) => a.person.displayName).join(", ");

        return (
          <li key={event.id} className="event-card">
            <Link href={`/events/${event.id}`} className="event-card-link">
              <div className="event-card-time">
                <strong>{event.startTime}</strong>
                {event.endTime ? <small>ถึง {event.endTime}</small> : null}
              </div>

              <div className="event-card-body">
                <h3>{event.title}</h3>
                <p className="event-card-meta">
                  <MapPin size={14} aria-hidden="true" />
                  {event.location.name}
                  <span aria-hidden="true">·</span>
                  {event.ownerDepartment.shortName}
                </p>
                {names ? (
                  <p className="event-card-meta">
                    <Users size={14} aria-hidden="true" />
                    {names}
                  </p>
                ) : null}
              </div>

              <div className="event-card-tags">
                {pending > 0 ? <span className="tag tag-wait">รอรับทราบ {pending}</span> : null}
                {event.hasChanges ? <span className="tag tag-late">มีการแก้ไข</span> : null}
                {event.urgency !== "normal" ? (
                  <span className="tag tag-late">{urgencyLabel(event.urgency)}</span>
                ) : null}
                <span className={`tag tag-${statusTone(event.status)}`}>{eventStatusLabel(event.status)}</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
