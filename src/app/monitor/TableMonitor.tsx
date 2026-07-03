"use client";

import { useEffect, useState } from "react";
import { fetchMonitorEvents } from "@/lib/monitor/client";
import type { MonitorEvent } from "@/lib/monitor/types";
import "./monitor-table.css";

function formatThaiDateShort(iso: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${iso}T00:00:00+07:00`));
}

export function TableMonitor() {
  const [events, setEvents] = useState<MonitorEvent[]>([]);
  const [clock, setClock] = useState("--:--:--");
  const [today, setToday] = useState("");
  const [refreshIn, setRefreshIn] = useState(60);

  // Live feed: load on mount + refresh every 60s.
  useEffect(() => {
    let active = true;
    const load = async () => {
      const ev = await fetchMonitorEvents();
      if (active) {
        setEvents(ev);
        setRefreshIn(60);
      }
    };
    load();
    const id = setInterval(load, 60000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  // Clock + date + refresh countdown.
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(
        `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`,
      );
      setToday(
        new Intl.DateTimeFormat("th-TH", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(d),
      );
      setRefreshIn((n) => (n <= 1 ? 60 : n - 1));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="mt-stage">
      <header className="mt-head">
        <div className="mt-title">
          <span className="mt-dot" aria-hidden="true" />
          <div>
            <h1>เทศบาลนครนครสวรรค์</h1>
            <p>ตารางงานประชาสัมพันธ์ · วันนี้ถึง 7 วันข้างหน้า</p>
          </div>
        </div>
        <div className="mt-clockwrap">
          <div className="mt-clock">{clock}</div>
          <div className="mt-date">{today}</div>
          <div className="mt-refresh">อัปเดตอัตโนมัติใน {refreshIn} วินาที</div>
        </div>
      </header>

      {events.length > 0 ? (
        <div className="mt-tablewrap">
          <table className="mt-table">
            <thead>
              <tr>
                <th className="c-date">วันที่</th>
                <th className="c-time">เวลา</th>
                <th className="c-title">งาน / กิจกรรม</th>
                <th className="c-loc">สถานที่</th>
                <th className="c-people">ผู้รับผิดชอบ</th>
                <th className="c-note">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e, i) => {
                const newDay = i === 0 || events[i - 1].eventDate !== e.eventDate;
                return (
                  <tr key={e.id} className={newDay ? "mt-newday" : ""}>
                    <td className="c-date">{formatThaiDateShort(e.eventDate)}</td>
                    <td className="c-time">
                      {e.startTime}
                      {e.endTime ? `–${e.endTime}` : ""}
                    </td>
                    <td className="c-title">
                      {e.title}
                      {e.hasChanges ? <span className="mt-chg">เปลี่ยนแปลง</span> : null}
                    </td>
                    <td className="c-loc">{e.locationName}</td>
                    <td className="c-people">
                      {e.assignees.length > 0 ? e.assignees.join(", ") : "—"}
                    </td>
                    <td className="c-note">{e.shortNote || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-empty">ไม่มีงานประชาสัมพันธ์ในช่วงนี้</div>
      )}

      <footer className="mt-foot">
        🛡️ จอภายใน · ไม่แสดงเบอร์โทร หมายเหตุภายใน หรือไฟล์แนบส่วนตัว
      </footer>
    </main>
  );
}
