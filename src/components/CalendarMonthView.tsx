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
    <div className="calendar-wrap panel" style={{ padding: "16px" }}>
      {/* Calendar Header Navigation */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <h2 style={{ margin: 0, fontSize: "22px", fontFamily: "var(--font-display)" }}>
            {monthName} {thaiYear}
          </h2>
          <span style={{ fontSize: "14px", color: "var(--muted)" }}>
            ({events.length} งานในตาราง)
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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

      {/* Weekday Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: "6px",
          textAlign: "center",
          fontWeight: "800",
          fontSize: "14px",
          color: "var(--muted)",
          marginBottom: "6px",
        }}
      >
        {WEEKDAYS.map((w, idx) => (
          <div
            key={w}
            style={{
              padding: "8px 0",
              color: idx === 0 ? "var(--red)" : idx === 6 ? "var(--violet)" : "inherit",
            }}
          >
            {w}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: "6px",
        }}
      >
        {allCalendarDays.map((day) => {
          const dayEvents = eventsByDate.get(day.iso) ?? [];
          const isToday = day.iso === todayIso;

          return (
            <div
              key={day.iso}
              style={{
                minHeight: "115px",
                padding: "8px",
                borderRadius: "var(--radius)",
                background: day.isCurrentMonth
                  ? isToday
                    ? "rgba(29, 90, 166, 0.08)"
                    : "var(--surface)"
                  : "var(--surface-soft)",
                border: isToday
                  ? "2px solid var(--blue)"
                  : "1px solid var(--line)",
                opacity: day.isCurrentMonth ? 1 : 0.45,
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                transition: "background-color 0.15s ease",
              }}
            >
              {/* Day Number Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontWeight: isToday ? "900" : "700",
                    fontSize: "14px",
                    width: "24px",
                    height: "24px",
                    display: "grid",
                    placeItems: "center",
                    borderRadius: "50%",
                    background: isToday ? "var(--blue)" : "transparent",
                    color: isToday ? "#fff" : "inherit",
                  }}
                >
                  {day.dayNumber}
                </span>

                <Link
                  href={`/events/new?eventDate=${day.iso}`}
                  style={{
                    color: "var(--muted)",
                    padding: "2px",
                    borderRadius: "4px",
                    display: "grid",
                    placeItems: "center",
                  }}
                  title={`เพิ่มงานวันที่ ${day.iso}`}
                >
                  <Plus size={14} />
                </Link>
              </div>

              {/* Day Events Pills */}
              <div style={{ display: "flex", flexDirection: "column", gap: "3px", flex: 1 }}>
                {dayEvents.slice(0, 3).map((ev) => {
                  const toneColor =
                    ev.urgency === "urgent"
                      ? "var(--red)"
                      : ev.urgency === "important"
                        ? "var(--amber)"
                        : "var(--blue)";

                  return (
                    <Link
                      key={ev.id}
                      href={`/events/${ev.id}`}
                      style={{
                        padding: "3px 6px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        background:
                          ev.status === "published"
                            ? "rgba(24, 120, 74, 0.12)"
                            : ev.status === "canceled"
                              ? "rgba(186, 55, 55, 0.12)"
                              : "rgba(98, 112, 131, 0.12)",
                        borderLeft: `3px solid ${toneColor}`,
                        color: "var(--text)",
                        textDecoration: "none",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                      title={`${ev.startTime} ${ev.title} (${ev.location.name})`}
                    >
                      <span style={{ fontSize: "10px", color: "var(--muted)", flexShrink: 0 }}>
                        {ev.startTime}
                      </span>
                      <strong style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                        {ev.title}
                      </strong>
                    </Link>
                  );
                })}

                {dayEvents.length > 3 && (
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--muted)",
                      fontWeight: "700",
                      paddingLeft: "4px",
                    }}
                  >
                    +{dayEvents.length - 3} งานเพิ่มเติม
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
