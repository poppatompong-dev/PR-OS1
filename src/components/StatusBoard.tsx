import Link from "next/link";
import type { PrEvent, EventStatus } from "@/types/domain";
import { eventStatusLabel, formatThaiDate } from "@/lib/format";

const COLUMNS: { status: EventStatus; tone: string; hint: string }[] = [
  { status: "draft", tone: "gray", hint: "ยังไม่แสดงบนจอมอนิเตอร์" },
  { status: "published", tone: "green", hint: "แสดงบนจอมอนิเตอร์แล้ว" },
  { status: "completed", tone: "blue", hint: "ปฏิบัติงานเสร็จแล้ว" },
  { status: "canceled", tone: "red", hint: "ต้องแจ้งผู้ปฏิบัติงาน" },
];

/**
 * The same work seen by where it is in the workflow rather than by date —
 * which is the question "อะไรยังไม่ได้เผยแพร่" asks, and a calendar cannot
 * answer. Columns on a wide screen, stacked sections on a phone.
 */
export function StatusBoard({ events, today }: { events: PrEvent[]; today: string }) {
  return (
    <div className="board">
      {COLUMNS.map((column) => {
        const items = events.filter((event) => event.status === column.status);

        return (
          <section key={column.status} className="board-col">
            <header className="board-head">
              <h2>
                <span className={`tag tag-${column.tone}`}>{eventStatusLabel(column.status)}</span>
              </h2>
              <span className="board-count">{items.length}</span>
            </header>
            <p className="board-hint">{column.hint}</p>

            {items.length === 0 ? (
              <p className="empty-note">ไม่มีงานในสถานะนี้</p>
            ) : (
              <ul className="board-list">
                {items.map((event) => {
                  const pending = event.assignments.filter((a) => a.ackStatus === "pending").length;

                  return (
                    <li key={event.id} className="board-card">
                      <Link href={`/events/${event.id}`}>
                        <strong>{event.title}</strong>
                        <span className="board-when">
                          {formatThaiDate(event.eventDate)}
                          {event.eventDate === today ? " · วันนี้" : ""} · {event.startTime}
                        </span>
                        <span className="board-where">{event.ownerDepartment.shortName}</span>
                        {pending > 0 ? (
                          <span className="tag tag-wait">รอรับทราบ {pending}</span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
