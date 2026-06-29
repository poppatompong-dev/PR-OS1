"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { events, people } from "@/data/mock-data";
import { formatThaiDate } from "@/lib/format";
import { GOLD, OIL, OIL_UPDATED, WEATHER, NEWS, FUN_FACTS } from "@/lib/signage/data";

const monitorEvents = events.filter((e) => e.status === "published");

function stateColor(e: (typeof events)[number]) {
  if (e.status === "canceled") return "#ff5b4d";
  if (e.hasChanges) return "#ff9a5c";
  const allAck = e.assignments.every((a) => a.ackStatus === "acknowledged");
  return allAck ? "#46d38a" : "#7af0e0";
}

/* ---------- หน้า 1: วาระงาน ---------- */
export function ChannelAgenda({ activeIdx, tip }: { activeIdx: number; tip: string }) {
  return (
    <div className="ch ch-agenda">
      <div className="ch-grid">
        {monitorEvents.map((e, idx) => {
          const c = stateColor(e);
          const active = idx === activeIdx % monitorEvents.length;
          const allAck = e.assignments.every((a) => a.ackStatus === "acknowledged");
          return (
            <article className={`scr-card${active ? " is-active" : ""}`} key={e.id} style={{ ["--c" as any]: c }}>
              <div>
                <div className="scr-time" style={{ color: c }}>{e.startTime}</div>
                <div className="scr-date">{formatThaiDate(e.eventDate)}</div>
              </div>
              <div>
                <div className="scr-evt">{e.title}</div>
                <div className="scr-sub">{e.shortNote}</div>
              </div>
              <div className="scr-right">
                <div className="loc">📍 {e.location.name}</div>
                <div className="ppl">{e.ownerDepartment.shortName} · {e.assignments.map((a) => a.role.name).join(" + ")}</div>
                {e.hasChanges
                  ? <span className="scr-pill" style={{ background: "rgba(224,138,46,.2)", color: "#e0892e" }}>● มีการเปลี่ยนแปลง</span>
                  : <span className="scr-pill" style={{ background: "rgba(70,211,138,.18)", color: "#2a9d5c" }}>● {allAck ? "รับทราบครบ" : "พร้อมแสดง"}</span>}
              </div>
              {active ? <div className="scr-progress" style={{ gridColumn: "1 / -1" }}><i className="run" key={activeIdx} /></div> : null}
            </article>
          );
        })}
      </div>
      <div className="ch-tip">💡 <span key={tip}>{tip}</span></div>
    </div>
  );
}

/* ---------- หน้า 2: ราคาทอง ---------- */
export function ChannelGold() {
  const up = GOLD.changeTHB >= 0;
  return (
    <div className="ch ch-center">
      <div className="ch-hero gold">
        <div className="ch-emoji">🏆</div>
        <div className="ch-label">ราคาทองคำวันนี้</div>
        <div className="ch-sub">ตามประกาศสมาคมค้าทองคำ · {GOLD.updatedAt}</div>
        <div className="gold-rows">
          <div><span>ทองคำแท่ง (ขายออก)</span><b>{GOLD.barSell.toLocaleString()} <i>บาท</i></b></div>
          <div><span>ทองรูปพรรณ (ขายออก)</span><b>{GOLD.ornamentSell.toLocaleString()} <i>บาท</i></b></div>
        </div>
        <div className={`gold-change ${up ? "up" : "down"}`}>
          {up ? "▲" : "▼"} เปลี่ยนแปลง {up ? "+" : ""}{GOLD.changeTHB} บาท
        </div>
      </div>
    </div>
  );
}

/* ---------- หน้า 3: ราคาน้ำมัน ---------- */
export function ChannelOil() {
  return (
    <div className="ch ch-center">
      <div className="ch-hero oil">
        <div className="ch-emoji">⛽</div>
        <div className="ch-label">ราคาน้ำมันวันนี้</div>
        <div className="ch-sub">ปั๊มใหญ่ (ปตท./บางจาก) · {OIL_UPDATED} · บาท/ลิตร</div>
        <div className="oil-grid">
          {OIL.map((o) => (
            <div className="oil-cell" key={o.name}>
              <span>{o.name}</span><b>{o.price.toFixed(2)}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- หน้า 4: ข่าวเด่น/ประกาศเทศบาล ---------- */
export function ChannelNews() {
  return (
    <div className="ch ch-news">
      <div className="ch-news-head">📰 ข่าวเด่น &amp; ประกาศ · เทศบาลนครนครสวรรค์</div>
      <div className="news-list">
        {NEWS.map((n, i) => (
          <div className="news-item" key={i} style={{ animationDelay: `${i * 0.12}s` }}>
            <span className="news-tag">{n.tag}</span>
            <span className="news-title">{n.title}</span>
            <span className="news-time">{n.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- หน้า 5: อากาศ + ปฏิทิน ---------- */
export function ChannelWeather() {
  const today = new Date();
  const thDate = new Intl.DateTimeFormat("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(today);
  return (
    <div className="ch ch-center">
      <div className="ch-hero weather">
        <div className="ch-emoji big">{WEATHER.icon}</div>
        <div className="ch-label">{WEATHER.place}</div>
        <div className="weather-temp">{WEATHER.tempHigh}°<small>/ {WEATHER.tempLow}°C</small></div>
        <div className="ch-sub">{WEATHER.condition} · โอกาสฝน {WEATHER.rainChance}%</div>
        <div className="weather-cal">📅 {thDate}</div>
      </div>
    </div>
  );
}

/* ---------- หน้า 6: น่าติดตาม (บอลโลก/เทรนด์) ---------- */
export function ChannelFun() {
  return (
    <div className="ch ch-news">
      <div className="ch-news-head">⚽ น่าติดตาม &amp; รู้หรือไม่</div>
      <div className="news-list">
        {FUN_FACTS.map((n, i) => (
          <div className="news-item fun" key={i} style={{ animationDelay: `${i * 0.12}s` }}>
            <span className="news-tag">{n.tag}</span>
            <span className="news-title">{n.title}</span>
            <span className="news-time">{n.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- หน้า 7: ทีมงานประชาสัมพันธ์ ---------- */
export function ChannelTeam() {
  return (
    <div className="ch ch-news">
      <div className="ch-news-head">👥 ทีมงานประชาสัมพันธ์ · เทศบาลนครนครสวรรค์</div>
      <div className="team-grid">
        {people.filter((p) => p.isActive).map((p, i) => (
          <div className="team-card" key={p.id} style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="team-ava">{p.displayName.replace(/^(นางสาว|นาง|นาย)/, "").trim().charAt(0)}</div>
            <div className="team-info">
              <strong>{p.displayName}</strong>
              <span>{p.position}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
