import Link from "next/link";
import type { PrEvent } from "@/types/domain";
import { eventStatusLabel, formatThaiDate, urgencyLabel } from "@/lib/format";
import { MapPin, Users } from "lucide-react";

function statusTone(status: PrEvent["status"]) {
  if (status === "published") return "green";
  if (status === "canceled") return "red";
  if (status === "completed") return "blue";
  return "gray";
}

function EventCard({ event }: { event: PrEvent }) {
  const pending = event.assignments.filter((a) => a.ackStatus === "pending").length;
  const names = event.assignments.map((a) => a.person.displayName).join(", ");

  return (
    <li className="event-card">
      <Link href={`/events/${event.id}`} className="event-card-link">
        <div className="event-card-time">
          <strong>{event.startTime}</strong>
          {event.endTime ? <small>ถึง {event.endTime}</small> : null}
        </div>

        <div className="event-card-body">
          <h3>{event.title}</h3>
          <p className="event-card-meta">
            <MapPin size={14} aria-hidden="true" />
            <span>
              {event.location.name} · {event.ownerDepartment.shortName}
            </span>
          </p>
          {names ? (
            <p className="event-card-meta">
              <Users size={14} aria-hidden="true" />
              <span>{names}</span>
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
}

/**
 * Work items as stacked cards. Used where a row of table columns would be
 * unreadable on a phone — which is the primary device for this system.
 *
 * `groupByDate` adds a sticky day heading per date; use it on any list that
 * spans more than one day, so the reader never has to hunt for which day a
 * card belongs to.
 */
export function EventCardList({
  events,
  emptyText,
  groupByDate = false,
  today,
}: {
  events: PrEvent[];
  emptyText: string;
  groupByDate?: boolean;
  today?: string;
}) {
  if (events.length === 0) {
    return <p className="empty-note">{emptyText}</p>;
  }

  if (!groupByDate) {
    return (
      <ul className="event-cards">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </ul>
    );
  }

  const byDate = new Map<string, PrEvent[]>();
  for (const event of events) {
    const bucket = byDate.get(event.eventDate);
    if (bucket) bucket.push(event);
    else byDate.set(event.eventDate, [event]);
  }

  return (
    <div className="day-groups">
      {[...byDate.entries()].map(([date, dayEvents]) => (
        <section key={date} className="day-group">
          <h2 className={`day-head${date === today ? " is-today" : ""}`}>
            <span>
              {formatThaiDate(date)}
              {date === today ? " · วันนี้" : ""}
            </span>
            <small>{dayEvents.length} งาน</small>
          </h2>
          <ul className="event-cards">
            {dayEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
