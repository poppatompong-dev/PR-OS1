"use client";

import { useState } from "react";
import Link from "next/link";
import type { PrEvent } from "@/types/domain";
import { eventStatusLabel, formatThaiDate } from "@/lib/format";
import { StatusPill } from "@/components/StatusPill";
import { ChevronLeft, ChevronRight, Clock3, MapPin, Plus, UserCheck } from "lucide-react";

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 (Sun) - 6 (Sat)
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function statusTone(status: PrEvent["status"]) {
  if (status === "published") return "green";
  if (status === "canceled") return "red";
  if (status === "completed") return "blue";
  return "gray";
}

const WEEKDAY_NAMES = [
  "อาทิตย์",
  "จันทร์",
  "อังคาร",
  "พุธ",
  "พฤหัสบดี",
  "ศุกร์",
  "เสาร์",
];

export function CalendarWeekView({
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

  const startOfWeek = getStartOfWeek(currentDate);
  const todayIso = toIsoDate(new Date());

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    return {
      date: d,
      iso: toIsoDate(d),
      dayName: WEEKDAY_NAMES[i],
      dayNumber: d.getDate(),
      month: d.getMonth() + 1,
      isToday: toIsoDate(d) === todayIso,
    };
  });

  const prevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };

  const nextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  const goThisWeek = () => setCurrentDate(new Date());

  // Group events by date
  const eventsByDate = new Map<string, PrEvent[]>();
  for (const ev of events) {
    const list = eventsByDate.get(ev.eventDate) ?? [];
    list.push(ev);
    eventsByDate.set(ev.eventDate, list);
  }

  const firstDay = weekDays[0];
  const lastDay = weekDays[6];

  return (
    <div className="calendar-week-wrap panel" style={{ padding: "16px" }}>
      {/* Week Navigation Header */}
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
        <div>
          <h2 style={{ margin: 0, fontSize: "22px", fontFamily: "var(--font-display)" }}>
            สัปดาห์ที่ {formatThaiDate(firstDay.iso)} – {formatThaiDate(lastDay.iso)}
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button className="button secondary" onClick={goThisWeek} type="button">
            สัปดาห์นี้
          </button>
          <button
            className="icon-button"
            onClick={prevWeek}
            type="button"
            title="สัปดาห์ก่อนหน้า"
            aria-label="สัปดาห์ก่อนหน้า"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            className="icon-button"
            onClick={nextWeek}
            type="button"
            title="สัปดาห์ถัดไป"
            aria-label="สัปดาห์ถัดไป"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* 7 Columns Grid for Weekdays */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "10px",
          alignItems: "start",
        }}
      >
        {weekDays.map((day, idx) => {
          const dayEvents = eventsByDate.get(day.iso) ?? [];

          return (
            <div
              key={day.iso}
              style={{
                background: day.isToday ? "rgba(29, 90, 166, 0.04)" : "var(--surface)",
                border: day.isToday ? "2px solid var(--blue)" : "1px solid var(--line)",
                borderRadius: "var(--radius)",
                padding: "10px",
                minHeight: "350px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {/* Day Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingBottom: "8px",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <div>
                  <strong
                    style={{
                      display: "block",
                      fontSize: "14px",
                      color: idx === 0 ? "var(--red)" : idx === 6 ? "var(--violet)" : "inherit",
                    }}
                  >
                    {day.dayName}
                  </strong>
                  <small style={{ color: "var(--muted)" }}>
                    {day.dayNumber}/{day.month}
                  </small>
                </div>

                <Link
                  href={`/events/new?eventDate=${day.iso}`}
                  style={{
                    color: "var(--muted)",
                    padding: "4px",
                    borderRadius: "4px",
                    display: "grid",
                    placeItems: "center",
                  }}
                  title={`เพิ่มงานวันที่ ${day.iso}`}
                >
                  <Plus size={16} />
                </Link>
              </div>

              {/* Event Cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
                {dayEvents.length === 0 ? (
                  <div
                    style={{
                      padding: "20px 0",
                      textAlign: "center",
                      color: "var(--muted)",
                      fontSize: "13px",
                    }}
                  >
                    ไม่มีงาน
                  </div>
                ) : (
                  dayEvents.map((ev) => (
                    <article
                      key={ev.id}
                      style={{
                        padding: "10px",
                        background: "var(--surface-soft)",
                        border: "1px solid var(--line)",
                        borderRadius: "var(--radius)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: "800",
                            color: "var(--blue)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <Clock3 size={13} />
                          {ev.startTime}{ev.endTime ? `-${ev.endTime}` : ""}
                        </span>
                        <StatusPill label={eventStatusLabel(ev.status)} tone={statusTone(ev.status)} />
                      </div>

                      <Link
                        href={`/events/${ev.id}`}
                        style={{
                          fontWeight: "800",
                          fontSize: "14px",
                          color: "var(--text)",
                          lineHeight: "1.3",
                        }}
                      >
                        {ev.title}
                      </Link>

                      <div style={{ fontSize: "12px", color: "var(--muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                        <MapPin size={13} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {ev.location.name}
                        </span>
                      </div>

                      {ev.assignments.length > 0 && (
                        <div style={{ fontSize: "11px", color: "var(--muted)", display: "flex", flexDirection: "column", gap: "2px", marginTop: "2px" }}>
                          {ev.assignments.map((asg) => (
                            <span key={asg.id} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <UserCheck size={12} />
                              {asg.role.name}: {asg.person.displayName}
                            </span>
                          ))}
                        </div>
                      )}
                    </article>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
