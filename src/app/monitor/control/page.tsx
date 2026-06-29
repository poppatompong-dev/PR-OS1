"use client";

import { useEffect, useState } from "react";
import { readControl, writeControl, type ControlState } from "@/lib/signage/control";
import { STATIONS } from "@/lib/signage/radio";

const CHANNELS = [
  { id: "agenda", name: "วาระงาน", icon: "📋" },
  { id: "gold", name: "ราคาทอง", icon: "🏆" },
  { id: "oil", name: "ราคาน้ำมัน", icon: "⛽" },
  { id: "news", name: "ข่าว/ประกาศ", icon: "📰" },
  { id: "weather", name: "อากาศ/ปฏิทิน", icon: "🌦️" },
  { id: "fun", name: "น่าติดตาม", icon: "⚽" },
  { id: "team", name: "ทีมงาน", icon: "👥" },
];

export default function ControlPage() {
  const [s, setS] = useState<ControlState>(readControl());
  useEffect(() => { setS(readControl()); }, []);

  function patch(p: Partial<ControlState>) {
    const next = { ...s, ...p };
    setS(next);
    writeControl(p);
  }

  return (
    <main className="ctrl">
      <header className="ctrl-head">
        <div className="ctrl-badge">📺 PR-OS</div>
        <div>
          <h1>รีโมทควบคุมจอ</h1>
          <p>ควบคุมจอแสดงวาระงาน · เทศบาลนครนครสวรรค์</p>
        </div>
      </header>

      <section className="ctrl-sec">
        <h2>โหมดสลับช่อง</h2>
        <div className="ctrl-toggle">
          <button className={s.auto ? "on" : ""} onClick={() => patch({ auto: true, channel: null })}>
            🔄 สลับอัตโนมัติ
          </button>
          <button className={!s.auto ? "on" : ""} onClick={() => patch({ auto: false })}>
            📌 ค้างช่องที่เลือก
          </button>
        </div>
      </section>

      <section className="ctrl-sec">
        <h2>เลือกช่อง {s.auto ? <small>(ปิดสลับอัตโนมัติเพื่อค้างช่อง)</small> : null}</h2>
        <div className="ctrl-grid">
          {CHANNELS.map((c) => (
            <button
              key={c.id}
              className={`ctrl-ch${s.channel === c.id ? " active" : ""}`}
              onClick={() => patch({ channel: c.id, auto: false })}
            >
              <span className="ch-ico">{c.icon}</span>
              <span>{c.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="ctrl-sec">
        <h2>โหมดสี</h2>
        <div className="ctrl-toggle">
          <button className={s.theme === "dark" ? "on" : ""} onClick={() => patch({ theme: "dark" })}>🌙 มืด</button>
          <button className={s.theme === "light" ? "on" : ""} onClick={() => patch({ theme: "light" })}>☀️ สว่าง</button>
        </div>
      </section>

      <section className="ctrl-sec">
        <h2>วิทยุคลอเบา ๆ</h2>
        <div className="ctrl-toggle">
          <button className={s.radio ? "on" : ""} onClick={() => patch({ radio: true })}>📻 เปิด</button>
          <button className={!s.radio ? "on" : ""} onClick={() => patch({ radio: false })}>🔇 ปิด</button>
        </div>
        <div className="ctrl-stations">
          {STATIONS.map((st, i) => (
            <button key={st.name} className={`ctrl-st${s.stationIdx === i ? " active" : ""}`} onClick={() => patch({ stationIdx: i, radio: true })}>
              {st.name} <small>{st.genre}</small>
            </button>
          ))}
        </div>
      </section>

      <footer className="ctrl-foot">
        <a href="/monitor?tv=1" target="_blank" rel="noreferrer">🖥️ เปิดจอแสดงผล (โหมด TV)</a>
        <p>เปิดหน้านี้บนมือถือเพื่อควบคุมจอ · prototype ใช้ได้เมื่อจอกับรีโมทอยู่เบราว์เซอร์เดียวกัน</p>
      </footer>

      <style>{`
        .ctrl{max-width:560px;margin:0 auto;padding:20px 16px 40px;min-height:100dvh;
          font-family:var(--font-ui);color:#13233a;
          background:radial-gradient(circle at 80% 0,rgba(255,152,110,.18),transparent 320px),linear-gradient(180deg,#eef4f9,#dfe8f1);}
        .ctrl-head{display:flex;gap:14px;align-items:center;margin-bottom:22px;}
        .ctrl-badge{width:54px;height:54px;border-radius:14px;display:grid;place-items:center;font-size:24px;
          background:linear-gradient(135deg,#ff8a4c,#1d5aa6);box-shadow:0 8px 20px rgba(29,90,166,.3);}
        .ctrl-head h1{margin:0;font-size:24px;font-weight:800;font-family:var(--font-display);}
        .ctrl-head p{margin:2px 0 0;color:#5b6b7e;font-size:13px;}
        .ctrl-sec{background:#fff;border:1px solid #d8e2ea;border-radius:16px;padding:16px;margin-bottom:14px;box-shadow:0 4px 14px rgba(18,32,51,.05);}
        .ctrl-sec h2{margin:0 0 12px;font-size:15px;font-weight:800;color:#17314f;}
        .ctrl-sec h2 small{font-weight:500;color:#8294a6;font-size:12px;}
        .ctrl-toggle{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
        .ctrl-toggle button{padding:14px;border:2px solid #d8e2ea;background:#f6f9fb;border-radius:12px;font:inherit;font-weight:700;
          font-size:15px;cursor:pointer;color:#3f5168;transition:all .15s;min-height:52px;}
        .ctrl-toggle button.on{border-color:#1d5aa6;background:linear-gradient(135deg,#1d5aa6,#16b3a9);color:#fff;box-shadow:0 6px 16px rgba(29,90,166,.3);}
        .ctrl-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
        .ctrl-ch{display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px 10px;border:2px solid #d8e2ea;background:#f6f9fb;
          border-radius:14px;font:inherit;font-weight:700;font-size:14px;cursor:pointer;color:#3f5168;transition:all .15s;min-height:84px;justify-content:center;}
        .ctrl-ch:active{transform:scale(.96);}
        .ctrl-ch.active{border-color:#ff8a4c;background:linear-gradient(135deg,#ff8a4c,#f0673a);color:#fff;box-shadow:0 6px 16px rgba(255,138,76,.35);}
        .ch-ico{font-size:26px;}
        .ctrl-stations{display:flex;flex-direction:column;gap:8px;margin-top:10px;}
        .ctrl-st{padding:12px 14px;border:2px solid #d8e2ea;background:#f6f9fb;border-radius:10px;font:inherit;font-weight:600;
          cursor:pointer;color:#3f5168;text-align:left;display:flex;justify-content:space-between;align-items:center;}
        .ctrl-st small{color:#8294a6;font-weight:500;}
        .ctrl-st.active{border-color:#16b3a9;background:#e2f7f5;color:#0c6b66;}
        .ctrl-foot{text-align:center;margin-top:8px;}
        .ctrl-foot a{display:inline-block;padding:14px 22px;border-radius:12px;background:#13233a;color:#fff;font-weight:800;text-decoration:none;}
        .ctrl-foot p{color:#8294a6;font-size:12px;margin-top:12px;line-height:1.5;}
      `}</style>
    </main>
  );
}
