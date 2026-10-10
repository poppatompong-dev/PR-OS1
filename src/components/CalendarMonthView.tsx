"use client";

import { useState } from "react";
import Link from "next/link";
import type { PrEvent } from "@/types/domain";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

const WEEKDAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function CalendarMonthView({
  events,
  initialDate,
}: {
  events: PrEvent[];
  initialDate?: string;
}) {
  const [currentDate, setCurrentDate] = useState(() => {
    if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)) {
      return new Date(`${initialDate}T00:00:00`);
    }
    return new Date();
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-11
  const thaiYear = year + 543;
  const monthName = THAI_MONTHS[month];

  const todayIso = toIsoDate(new Date());

  // First day of month
  const firstDay = new Date(year, month, 1);
  const startingDayOfWeek = firstDay.getDay(); // 0 (Sun) - 6 (Sat)
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Days from previous month to fill first row
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = Array.from({ length: startingDayOfWeek }, (_, i) => {
    const day = daysInPrevMonth - startingDayOfWeek + i + 1;
    const prevMonthDate = new Date(year, month - 1, day);
    return {
      date: prevMonthDate,
      iso: toIsoDate(prevMonthDate),
      dayNumber: day,
      isCurrentMonth: false,
    };
  });

  // Days in current month
  const currentMonthDays = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const date = new Date(year, month, day);
    return {
      date,
      iso: toIsoDate(date),
      dayNumber: day,
      isCurrentMonth: true,
    };
  });

  // Days from next month to complete 5 or 6 rows (multiple of 7)
  const totalDays = prevMonthDays.length + currentMonthDays.length;
  const remainingDays = totalDays % 7 === 0 ? 0 : 7 - (totalDays % 7);
  const nextMonthDays = Array.from({ length: remainingDays }, (_, i) => {
    const day = i + 1;
    const nextMonthDate = new Date(year, month + 1, day);
    return {
      date: nextMonthDate,
      iso: toIsoDate(nextMonthDate),
      dayNumber: day,
      isCurrentMonth: false,
    };
  });

  const allCalendarDays = [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];

  // Group events by ISO date
  const eventsByDate = new Map<string, PrEvent[]>();
  for (const ev of events) {
    const list = eventsByDate.get(ev.eventDate) ?? [];
    list.push(ev);
    eventsByDate.set(ev.eventDate, list);
  }

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  return (
    <div className="calendar-wrap panel">
      <div className="cal-head">
        <div className="cal-title">
          <h2>
            {monthName} {thaiYear}
          </h2>
          <span>({events.length} งานในตาราง)</span>
        </div>

        <div className="cal-nav">
          <button className="button secondary" onClick={goToday} type="button">
            วันนี้
          </button>
          <button
            className="icon-button"
            onClick={prevMonth}
            type="button"
            title="เดือนก่อนหน้า"
            aria-label="เดือนก่อนหน้า"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            className="icon-button"
            onClick={nextMonth}
            type="button"
            title="เดือนถัดไป"
            aria-label="เดือนถัดไป"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="cal-weekdays">
        {WEEKDAYS.map((w, idx) => (
          <div key={w} className="cal-weekday" data-dow={idx}>
            {w}
          </div>
        ))}
      </div>

      <div className="cal-grid">
        {allCalendarDays.map((day) => {
          const dayEvents = eventsByDate.get(day.iso) ?? [];
          const isToday = day.iso === todayIso;

          return (
            <div
              key={day.iso}
              className={`cal-day${day.isCurrentMonth ? "" : " is-other"}${isToday ? " is-today" : ""}`}
            >
              <div className="cal-dayhead">
                <span className="cal-daynum">{day.dayNumber}</span>
                <Link
                  className="cal-add"
                  href={`/events/new?eventDate=${day.iso}`}
                  title={`เพิ่มงานวันที่ ${day.iso}`}
                  aria-label={`เพิ่มงานวันที่ ${day.iso}`}
                >
                  <Plus size={14} />
                </Link>
                {/* On a phone the cell is too small for titles, so the work
                    shows as a count instead; the pills below are hidden there. */}
                {dayEvents.length > 0 ? (
                  <span className="cal-count" aria-hidden="true">
                    {dayEvents.length}
                  </span>
                ) : null}
              </div>

              <div className="cal-events">
                {dayEvents.slice(0, 3).map((ev) => (
                  <Link
                    key={ev.id}
                    className={`cal-pill cal-${ev.status}`}
                    data-urgency={ev.urgency}
                    href={`/events/${ev.id}`}
                    title={`${ev.startTime} ${ev.title} (${ev.location.name})`}
                  >
                    <span className="cal-pill-time">{ev.startTime}</span>
                    <strong>{ev.title}</strong>
                  </Link>
                ))}

                {dayEvents.length > 3 && (
                  <span className="cal-more">+{dayEvents.length - 3} งานเพิ่มเติม</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
