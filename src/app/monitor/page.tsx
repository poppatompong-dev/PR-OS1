"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useRef, useState } from "react";
import { events } from "@/data/mock-data";
import {
  ChannelAgenda, ChannelGold, ChannelOil, ChannelNews, ChannelWeather, ChannelFun, ChannelTeam,
} from "./channels";
import { STATIONS } from "@/lib/signage/radio";
import { readControl, type ControlState } from "@/lib/signage/control";
import "./monitor-retro.css";

const monitorEvents = events.filter((e) => e.status === "published");

function stateColor(e: (typeof events)[number]) {
  if (e.status === "canceled") return "#ff5b4d";
  if (e.hasChanges) return "#ff9a5c";
  const allAck = e.assignments.every((a) => a.ackStatus === "acknowledged");
  return allAck ? "#46d38a" : "#7af0e0";
}

const PR_TIPS = [
  "ภาพข่าวที่ดี เล่าเรื่องได้ใน 1 เฟรม",
  "เช็กชื่อ-ตำแหน่งผู้ใหญ่ให้ถูกก่อนเผยแพร่",
  "คลิปสั้นแนวตั้งเข้าถึงคนรุ่นใหม่ได้มากกว่า",
  "ตั้งชื่อไฟล์ภาพให้ค้นหาย้อนหลังได้ง่าย",
  "โพสต์ช่วงเช้าและเย็นมักมีคนเห็นมากที่สุด",
  "ทุกกิจกรรม ควรมีภาพหมู่และภาพบรรยากาศ",
];

// นิยามช่อง: dwell = เวลาค้าง (ms), วาระงานนาน หน้าอื่นสั้น
type ChDef = { id: string; name: string; dwell: number };
const CHANNELS: ChDef[] = [
  { id: "agenda", name: "วาระงาน", dwell: 30000 }, // เด่นสุด ค้างนานสุด
  { id: "gold", name: "ราคาทอง", dwell: 8000 },
  { id: "oil", name: "ราคาน้ำมัน", dwell: 8000 },
  { id: "news", name: "ข่าว/ประกาศ", dwell: 11000 },
  { id: "weather", name: "อากาศ/ปฏิทิน", dwell: 8000 },
  { id: "fun", name: "น่าติดตาม", dwell: 9000 },
  { id: "team", name: "ทีมงาน", dwell: 10000 },
];

export default function MonitorPage() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [clock, setClock] = useState("--:--:--");
  const [refreshIn, setRefreshIn] = useState(60);
  const [activeIdx, setActiveIdx] = useState(0); // ไฮไลต์งานในหน้าวาระ
  const [tipIdx, setTipIdx] = useState(0);
  const [chIdx, setChIdx] = useState(0);          // ช่องปัจจุบัน
  const [switching, setSwitching] = useState(false); // เอฟเฟกต์เปลี่ยนช่อง
  const bgRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [radioOn, setRadioOn] = useState(false);
  const [stationIdx, setStationIdx] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [tvMode, setTvMode] = useState(false);
  const [forcedChannel, setForcedChannel] = useState<string | null>(null);
  const [autoSwitch, setAutoSwitch] = useState(true);

  const tickerItems = useMemo(
    () => monitorEvents.map((e) => `📢 ${e.startTime} • ${e.title} • ${e.location.name}`),
    [],
  );

  const radioTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function playStation(idx: number) {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
    const a = new Audio(STATIONS[idx].url);
    a.volume = 0.32;
    a.preload = "auto";
    audioRef.current = a;

    // ถ้าต่อไม่ติดใน 8 วิ -> ข้ามคลื่นถัดไปอัตโนมัติ
    if (radioTimerRef.current) clearTimeout(radioTimerRef.current);
    radioTimerRef.current = setTimeout(() => {
      const next = (idx + 1) % STATIONS.length;
      setStationIdx(next);
      playStation(next);
    }, 8000);

    const clearGuard = () => { if (radioTimerRef.current) { clearTimeout(radioTimerRef.current); radioTimerRef.current = null; } };
    a.addEventListener("playing", () => { clearGuard(); setRadioOn(true); });
    a.addEventListener("error", () => { clearGuard(); const next = (idx + 1) % STATIONS.length; setStationIdx(next); playStation(next); });
    // ถ้าสตรีมหลุดกลางคัน -> เล่นซ้ำคลื่นเดิม (reconnect)
    a.addEventListener("ended", () => { playStation(idx); });
    a.addEventListener("stalled", () => { a.load(); a.play().catch(() => {}); });

    a.play().then(() => { clearGuard(); setRadioOn(true); }).catch(() => {
      // autoplay ถูกบล็อก (ยังไม่ user-gesture) — ปล่อยให้ผู้ใช้กดอีกครั้ง
      clearGuard();
    });
  }

  function toggleRadio() {
    if (radioOn) {
      audioRef.current?.pause();
      if (radioTimerRef.current) clearTimeout(radioTimerRef.current);
      setRadioOn(false);
    } else {
      playStation(stationIdx);
    }
  }
  function nextStation() {
    const next = (stationIdx + 1) % STATIONS.length;
    setStationIdx(next);
    playStation(next);
  }

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  // อ่าน reduced-motion + ?tv=1 + ฟังคำสั่งจากหน้า control (localStorage)
  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const q = new URLSearchParams(window.location.search);
    setTvMode(q.get("tv") === "1");
    const apply = (c: ControlState) => {
      setAutoSwitch(c.auto);
      setForcedChannel(c.auto ? null : c.channel);
      setTheme(c.theme);
      if (c.channel && !c.auto) {
        const idx = ["agenda","gold","oil","news","weather","fun","team"].indexOf(c.channel);
        if (idx >= 0) setChIdx(idx);
      }
      if (c.radio && !radioOn) { try { toggleRadio(); } catch {} }
      if (!c.radio && radioOn) { audioRef.current?.pause(); setRadioOn(false); }
    };
    apply(readControl());
    const onStorage = () => apply(readControl());
    const onCustom = (e: Event) => apply((e as CustomEvent).detail);
    window.addEventListener("storage", onStorage);
    window.addEventListener("pros-control", onCustom as EventListener);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener("pros-control", onCustom as EventListener); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // นาฬิกา + refresh + ไฮไลต์งาน + เกร็ด PR
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setClock(`${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`);
      setRefreshIn((n) => (n <= 1 ? 60 : n - 1));
      const sec = d.getSeconds();
      if (sec % 6 === 0 && monitorEvents.length > 1) setActiveIdx((i) => (i + 1) % monitorEvents.length);
      if (sec % 8 === 0) setTipIdx((i) => (i + 1) % PR_TIPS.length);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // วนเปลี่ยนช่อง: แทรกวาระงาน (0) คั่นทุกช่อง ให้งาน PR เด่นและโผล่บ่อยสุด
  // 0=agenda,1=gold,2=oil,3=news,4=weather,5=fun,6=team
  const PLAY_ORDER = [0, 1, 0, 2, 0, 3, 0, 4, 0, 5, 0, 6];
  const [orderPos, setOrderPos] = useState(0);
  useEffect(() => {
    if (!autoSwitch) return; // control สั่งค้างช่อง
    const dwell = CHANNELS[chIdx].dwell;
    const t = setTimeout(() => {
      const nextPos = (orderPos + 1) % PLAY_ORDER.length;
      const nextCh = PLAY_ORDER[nextPos];
      const advance = () => { setOrderPos(nextPos); setChIdx(nextCh); };
      if (reduced) { advance(); return; }
      setSwitching(true);
      setTimeout(() => { advance(); setTimeout(() => setSwitching(false), 260); }, 360);
    }, dwell);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chIdx, orderPos, reduced, autoSwitch]);

  // ฉาก 3D หลังจอ (Three.js ผ่าน CDN)
  useEffect(() => {
    if (reduced || !bgRef.current) return;
    const host = bgRef.current;
    let renderer: any, raf = 0, disposed = false;
    function boot(THREE: any) {
      if (disposed) return;
      let W = host.clientWidth, H = host.clientHeight;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 1000);
      camera.position.set(0, 2, 42);
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(W, H);
      host.appendChild(renderer.domElement);
      scene.add(new THREE.AmbientLight(0x99bbdd, 1.0));
      const p1 = new THREE.PointLight(0xff986e, 1.2, 200); p1.position.set(22, 20, 22); scene.add(p1);
      const p2 = new THREE.PointLight(0x4f9fe0, 1.0, 200); p2.position.set(-24, -8, 16); scene.add(p2);
      const g3 = new THREE.Group(); scene.add(g3);
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 1),
        new THREE.MeshStandardMaterial({ color: 0x1d5aa6, emissive: 0x1d5aa6, emissiveIntensity: 0.45, metalness: 0.4, roughness: 0.35 }));
      g3.add(core);
      [3.8, 5, 6.2].forEach((rr, i) => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.045, 8, 90),
          new THREE.MeshBasicMaterial({ color: 0xff986e, transparent: true, opacity: 0.4, side: THREE.DoubleSide }));
        ring.rotation.x = Math.PI / 2 + i * 0.4; (ring as any)._s = (i % 2 ? 1 : -1) * (0.1 + i * 0.04); g3.add(ring);
      });
      const nodes: any[] = [];
      monitorEvents.forEach((ev, i) => {
        const allAck = ev.assignments.every((a) => a.ackStatus === "acknowledged");
        const col = ev.hasChanges ? 0xff9a5c : allAck ? 0x46d38a : 0x7af0e0;
        const ang = i * 2.3, rad = 13 + i * 2, y = Math.sin(i * 1.5) * 3;
        const g = new THREE.Group(); g.position.set(Math.cos(ang) * rad, y, Math.sin(ang) * rad);
        g.add(new THREE.Mesh(new THREE.OctahedronGeometry(1.4, 0),
          new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.5, metalness: 0.5, roughness: 0.25 })));
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), g.position.clone().multiplyScalar(-1)]),
          new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.22 })));
        (g as any)._d = { phase: i * 1.1, baseY: y }; nodes.push(g); g3.add(g);
      });
      const sg = new THREE.BufferGeometry();
      const N = 600, ps = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) { const r = 70 + Math.random() * 90, t = Math.random() * 6.28, ph = Math.acos(2 * Math.random() - 1);
        ps[i*3]=r*Math.sin(ph)*Math.cos(t); ps[i*3+1]=r*Math.sin(ph)*Math.sin(t); ps[i*3+2]=r*Math.cos(ph); }
      sg.setAttribute("position", new THREE.BufferAttribute(ps, 3));
      const dots = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xbfe3ff, size: 0.5, transparent: true, opacity: 0.5 }));
      scene.add(dots);
      const clk = new THREE.Clock();
      const loop = () => {
        raf = requestAnimationFrame(loop);
        const t = clk.getElapsedTime();
        g3.rotation.y = t * 0.04; g3.rotation.x = 0.1; core.rotation.y += 0.003;
        g3.children.forEach((c: any) => { if (c._s) c.rotation.z += c._s * 0.008; });
        nodes.forEach((nn: any) => { nn.position.y = nn._d.baseY + Math.sin(t * 0.7 + nn._d.phase) * 0.6; nn.children[0].rotation.y += 0.008; });
        dots.rotation.y += 0.0003; renderer.render(scene, camera);
      };
      loop();
      const onResize = () => { W = host.clientWidth; H = host.clientHeight; camera.aspect = W / H; camera.updateProjectionMatrix(); renderer.setSize(W, H); };
      window.addEventListener("resize", onResize);
      (host as any)._cleanup = () => window.removeEventListener("resize", onResize);
    }
    if ((window as any).THREE) boot((window as any).THREE);
    else {
      const sc = document.createElement("script");
      sc.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
      sc.onload = () => boot((window as any).THREE);
      sc.onerror = () => { if (host) host.style.display = "none"; };
      document.head.appendChild(sc);
    }
    return () => { disposed = true; cancelAnimationFrame(raf); (host as any)?._cleanup?.(); if (renderer) { renderer.dispose?.(); renderer.domElement?.remove(); } };
  }, [reduced]);

  // ความเข้มฉากหลังตามธีม
  useEffect(() => {
    if (bgRef.current) bgRef.current.style.opacity = theme === "light" ? "0.35" : "0.8";
  }, [theme, clock]);

  // ซ่อนปุ่มควบคุมเมื่อเมาส์นิ่ง 3 วิ (จอเปิดทั้งวันสะอาดตา)
  useEffect(() => {
    if (tvMode) return; // โหมด TV ไม่มีปุ่มอยู่แล้ว
    let timer: ReturnType<typeof setTimeout>;
    const stage = document.querySelector(".rtv-stage");
    const wake = () => {
      stage?.classList.remove("idle");
      clearTimeout(timer);
      timer = setTimeout(() => stage?.classList.add("idle"), 3000);
    };
    window.addEventListener("mousemove", wake);
    window.addEventListener("touchstart", wake);
    wake();
    return () => { clearTimeout(timer); window.removeEventListener("mousemove", wake); window.removeEventListener("touchstart", wake); };
  }, [tvMode]);

  const ch = CHANNELS[chIdx];
  function renderChannel() {
    switch (ch.id) {
      case "agenda": return <ChannelAgenda activeIdx={activeIdx} tip={PR_TIPS[tipIdx]} />;
      case "gold": return <ChannelGold />;
      case "oil": return <ChannelOil />;
      case "news": return <ChannelNews />;
      case "weather": return <ChannelWeather />;
      case "fun": return <ChannelFun />;
      case "team": return <ChannelTeam />;
      default: return null;
    }
  }

  return (
    <main className="rtv-stage" data-theme={theme} data-tv={tvMode ? "1" : "0"}>
      <div className="rtv-bg" ref={bgRef} aria-hidden="true" />

      <div className="rtv-controls" style={tvMode ? { display: "none" } : undefined}>
        <button className="rtv-btn" onClick={() => setChIdx((i) => (i + 1) % CHANNELS.length)} title="เปลี่ยนช่อง">📺 เปลี่ยนช่อง</button>
        <button className="rtv-btn" onClick={toggleRadio} title="วิทยุคลอเบา ๆ">
          {radioOn ? "⏸️" : "📻"} {radioOn ? STATIONS[stationIdx].name : "เปิดวิทยุ"}
        </button>
        {radioOn ? <button className="rtv-btn" onClick={nextStation} title="เปลี่ยนคลื่น">⏭️ {STATIONS[stationIdx].genre}</button> : null}
        <a className="rtv-btn" href="/monitor?tv=1" title="เปิดโหมดทีวีเต็มจอ ไม่มีปุ่ม">🖥️ จอเต็ม (TV)</a>
        <a className="rtv-btn" href="/monitor/control" title="หน้ารีโมทควบคุม">🎛️ รีโมท</a>
        <button className="rtv-btn" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
          {theme === "dark" ? "☀️ โหมดสว่าง" : "🌙 โหมดมืด"}
        </button>
      </div>

      <RetroMic /><RetroMegaphone /><RetroCamera /><RetroRadio />

      <div className="rtv-wrap">
        <div className="rtv-ant" aria-hidden="true"><span /><span /><i /><i /><b /></div>

        <div className="rtv-body">
          <div className="rtv-inner">
            <div className="rtv-bezel">
              <div className="rtv-screen">
                <div className="crt-glass" /><div className="crt-scan" /><div className="crt-flick" />
                {switching ? <div className="crt-switch" aria-hidden="true"><div className="crt-noise" /><div className="crt-rollbar" /></div> : null}

                {/* มาสคอตเดินรอบขอบจอ + บอลลูนลอย (โชว์ทุกช่อง) */}
                <div className="mascot-runner" aria-hidden="true">
                  <div className="mascot mascot-1"><Mascot kind="reporter" /></div>
                  <div className="mascot mascot-2"><Mascot kind="camera" /></div>
                </div>
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className="floaty" aria-hidden="true"
                    style={{ left: `${12 + i * 22}%`, animationDuration: `${14 + i * 4}s`, animationDelay: `${i * 3}s`, fontSize: `${20 + (i % 2) * 8}px` }}>
                    {["🎈", "✨", "📸", "⭐"][i]}
                  </span>
                ))}

                <div className="scr">
                  <header className="scr-head">
                    <div>
                      <div className="scr-kick"><span className="d" /> PR-OS · ช่อง {chIdx + 1}/{CHANNELS.length} · {ch.name}</div>
                      <div className="scr-title">เทศบาลนครนครสวรรค์</div>
                    </div>
                    <div className="scr-clockwrap">
                      <div className="scr-clock">{clock}</div>
                      <div className="scr-refresh">รีเฟรชใน <b>{refreshIn}</b> วิ</div>
                    </div>
                  </header>

                  <div className="scr-ticker">
                    <div className="scr-ticker-track">
                      {[...tickerItems, ...tickerItems].map((t, i) => <span key={i}>{t}</span>)}
                    </div>
                  </div>

                  {/* เนื้อหาช่อง — มี fade เข้า */}
                  <div className={`scr-body${switching ? " is-hidden" : ""}`} key={ch.id}>
                    {renderChannel()}
                  </div>

                  {/* แถบบอกช่อง (จุดวงกลม) */}
                  <div className="scr-chdots" aria-hidden="true">
                    {CHANNELS.map((c, i) => <i key={c.id} className={i === chIdx ? "on" : ""} />)}
                  </div>

                  <footer className="scr-foot">🛡️ ข้อมูลปลอดภัยสำหรับจอภายใน · ไม่แสดงเบอร์โทร หมายเหตุภายใน หรือไฟล์แนบส่วนตัว</footer>
                </div>
              </div>
            </div>

            <div className="rtv-knobs">
              <button className="rtv-knob" aria-label="ปรับช่อง" onClick={() => setChIdx((i) => (i + 1) % CHANNELS.length)} />
              <button className="rtv-knob" aria-label="ปรับเสียง" />
              <div className="rtv-grille" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
            </div>
          </div>
        </div>

        <div className="rtv-feet" aria-hidden="true"><span /><span /></div>
      </div>

      {/* ขบวนพาเหรดดินน้ำมัน — เดินช้า สบายตา กระจายทั่วจอ (negative delay = เริ่มกลางทาง) */}
      <div className="parade" aria-hidden="true">
        <div className="actor walk-r" style={{ animationDuration: "105s", animationDelay: "0s", bottom: "12px" }}><ClayPerson color="#ff8a4c" /></div>
        <div className="actor walk-l" style={{ animationDuration: "125s", animationDelay: "-50s", bottom: "8px" }}><ClayDog /></div>
        <div className="actor walk-r" style={{ animationDuration: "82s", animationDelay: "-50s", bottom: "10px" }}><ClayCar kind="city" /></div>
        <div className="actor walk-l" style={{ animationDuration: "115s", animationDelay: "-70s", bottom: "14px" }}><ClayPerson color="#16b3a9" /></div>
        <div className="actor walk-r" style={{ animationDuration: "120s", animationDelay: "-30s", bottom: "11px" }}><ClayBike /></div>
        <div className="actor walk-r" style={{ animationDuration: "74s", animationDelay: "-60s", bottom: "9px" }}><ClayCar kind="police" /></div>
        <div className="actor walk-l" style={{ animationDuration: "130s", animationDelay: "-12s", bottom: "13px" }}><ClayPerson color="#a8509a" /></div>
        <div className="actor walk-r" style={{ animationDuration: "110s", animationDelay: "-90s", bottom: "8px" }}><ClayDog brown /></div>
        <div className="actor walk-r" style={{ animationDuration: "92s", animationDelay: "-38s", bottom: "12px" }}><ClayCar kind="ambulance" /></div>
        <div className="actor walk-l" style={{ animationDuration: "128s", animationDelay: "-100s", bottom: "10px" }}><ClayTuktuk /></div>
        <div className="actor walk-l" style={{ animationDuration: "100s", animationDelay: "-44s", bottom: "7px" }}><ClayCat /></div>
        <div className="actor walk-r" style={{ animationDuration: "96s", animationDelay: "-80s", bottom: "13px" }}><ClayPerson color="#1d5aa6" /></div>
      </div>
        </main>
  );
}

/* ===== ตัวละครดินน้ำมัน (claymation) เดินขบวนขอบล่าง ===== */
function ClayPerson({ color }: { color: string }) {
  return (
    <svg width="46" height="78" viewBox="0 0 46 78" aria-hidden="true">
      <g className="bob">
        <ellipse cx="23" cy="20" rx="13" ry="13" fill="#ffe0b8" />
        <path d="M10 16 q13 -12 26 0 l-2 5 q-11 -7 -22 0 Z" fill={color} />
        <circle cx="19" cy="20" r="1.8" fill="#23262b" /><circle cx="27" cy="20" r="1.8" fill="#23262b" />
        <path d="M19 25 q4 4 8 0" stroke="#23262b" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <rect x="13" y="32" width="20" height="26" rx="9" fill={color} />
      </g>
      <rect className="legA" x="17" y="55" width="6" height="20" rx="3" fill="#3a4250" />
      <rect className="legB" x="24" y="55" width="6" height="20" rx="3" fill="#3a4250" />
    </svg>
  );
}
function ClayDog({ brown }: { brown?: boolean }) {
  const c = brown ? "#b07a44" : "#e8c79a";
  return (
    <svg width="64" height="50" viewBox="0 0 64 50" aria-hidden="true">
      <g className="bob">
        <ellipse cx="32" cy="26" rx="22" ry="12" fill={c} />
        <circle cx="52" cy="20" r="10" fill={c} />
        <ellipse cx="47" cy="12" rx="3.5" ry="6" fill={brown ? "#8a5d30" : "#cda86f"} transform="rotate(-20 47 12)" />
        <circle cx="55" cy="19" r="1.7" fill="#23262b" />
        <circle cx="59" cy="22" r="2" fill="#23262b" />
        <path d="M10 24 q-7 -3 -8 4" stroke={c} strokeWidth="5" fill="none" strokeLinecap="round" />
      </g>
      <rect className="legA" x="18" y="34" width="6" height="14" rx="3" fill={c} />
      <rect className="legB" x="40" y="34" width="6" height="14" rx="3" fill={c} />
    </svg>
  );
}
function ClayCar({ kind }: { kind: "city" | "police" | "ambulance" }) {
  const body = kind === "police" ? "#2f6fd0" : kind === "ambulance" ? "#ffffff" : "#16b3a9";
  return (
    <svg width="84" height="50" viewBox="0 0 84 50" aria-hidden="true">
      <rect x="4" y="22" width="76" height="18" rx="8" fill={body} />
      <path d="M18 22 q6 -14 24 -14 t24 14 Z" fill={body} />
      <rect x="26" y="11" width="30" height="11" rx="4" fill="#bfe3ff" opacity="0.9" />
      {kind === "police"
        ? <rect x="36" y="2" width="12" height="6" rx="2" fill="#ff5b4d" />
        : kind === "ambulance"
        ? <g><rect x="36" y="2" width="12" height="6" rx="2" fill="#ff5b4d" /><rect x="38" y="28" width="14" height="4" fill="#ff5b4d" /><rect x="43" y="23" width="4" height="14" fill="#ff5b4d" /></g>
        : <rect x="6" y="14" width="14" height="9" rx="2" fill="#fff" opacity=".85" />}
      <circle className="wheel" cx="24" cy="42" r="8" fill="#23262b" /><circle cx="24" cy="42" r="3" fill="#7c8b9c" />
      <circle className="wheel" cx="60" cy="42" r="8" fill="#23262b" /><circle cx="60" cy="42" r="3" fill="#7c8b9c" />
    </svg>
  );
}
function ClayBike() {
  return (
    <svg width="64" height="52" viewBox="0 0 64 52" aria-hidden="true">
      <circle className="wheel" cx="14" cy="40" r="10" fill="none" stroke="#3a4250" strokeWidth="3" />
      <circle className="wheel" cx="50" cy="40" r="10" fill="none" stroke="#3a4250" strokeWidth="3" />
      <path d="M14 40 L30 40 L44 24 M30 40 L40 40 L50 40" stroke="#ff8a4c" strokeWidth="3" fill="none" strokeLinecap="round" />
      <line x1="44" y1="24" x2="50" y2="24" stroke="#3a4250" strokeWidth="3" strokeLinecap="round" />
      <g className="bob">
        <ellipse cx="33" cy="16" rx="8" ry="8" fill="#ffe0b8" />
        <rect x="27" y="22" width="14" height="14" rx="6" fill="#a8509a" />
      </g>
    </svg>
  );
}

function ClayCat() {
  return (
    <svg width="52" height="42" viewBox="0 0 52 42" aria-hidden="true">
      <g className="bob">
        <ellipse cx="26" cy="24" rx="18" ry="9" fill="#9aa6b2" />
        <circle cx="40" cy="18" r="8" fill="#9aa6b2" />
        <path d="M34 12 l3 -7 l4 6 Z" fill="#9aa6b2" /><path d="M44 12 l2 -7 l4 6 Z" fill="#9aa6b2" />
        <circle cx="42" cy="17" r="1.4" fill="#23262b" />
        <path d="M8 22 q-8 -6 -6 4" stroke="#9aa6b2" strokeWidth="4" fill="none" strokeLinecap="round" />
      </g>
      <rect className="legA" x="16" y="30" width="5" height="11" rx="2.5" fill="#9aa6b2" />
      <rect className="legB" x="32" y="30" width="5" height="11" rx="2.5" fill="#9aa6b2" />
    </svg>
  );
}
function ClayTuktuk() {
  return (
    <svg width="72" height="56" viewBox="0 0 72 56" aria-hidden="true">
      <rect x="14" y="20" width="42" height="22" rx="6" fill="#ffd166" />
      <path d="M18 20 q4 -14 18 -14 t14 14 Z" fill="#f0673a" />
      <rect x="26" y="9" width="20" height="11" rx="3" fill="#bfe3ff" opacity="0.85" />
      <rect x="10" y="26" width="6" height="14" rx="2" fill="#16b3a9" />
      <circle className="wheel" cx="22" cy="44" r="8" fill="#23262b" /><circle cx="22" cy="44" r="3" fill="#7c8b9c" />
      <circle className="wheel" cx="48" cy="44" r="8" fill="#23262b" /><circle cx="48" cy="44" r="3" fill="#7c8b9c" />
      <circle className="wheel" cx="13" cy="46" r="5" fill="#23262b" />
    </svg>
  );
}

/* ===== มาสคอตดุ๊กดิ๊กเดินรอบจอ ===== */
function Mascot({ kind }: { kind: "reporter" | "camera" }) {
  const main = kind === "reporter" ? "#ff8a4c" : "#1d5aa6";
  return (
    <svg width="54" height="64" viewBox="0 0 54 64" aria-hidden="true">
      <rect className="leg l" x="20" y="44" width="6" height="16" rx="3" fill="#3a4250" />
      <rect className="leg r" x="28" y="44" width="6" height="16" rx="3" fill="#3a4250" />
      <g className="body">
        <rect x="14" y="26" width="26" height="24" rx="10" fill={main} />
        <rect className="arm l" x="9" y="28" width="6" height="16" rx="3" fill={main} />
        <rect className="arm r" x="39" y="28" width="6" height="16" rx="3" fill={main} />
        <circle cx="27" cy="16" r="13" fill="#ffe0b8" />
        <circle cx="22" cy="15" r="2.4" fill="#23262b" />
        <circle cx="32" cy="15" r="2.4" fill="#23262b" />
        <path d="M22 21 q5 5 10 0" stroke="#23262b" strokeWidth="2" fill="none" strokeLinecap="round" />
        {kind === "reporter"
          ? <g><rect x="40" y="24" width="4" height="12" rx="2" fill="#5a6877" /><circle cx="42" cy="22" r="5" fill="#3a4250" /></g>
          : <g><rect x="38" y="22" width="12" height="9" rx="2" fill="#23262b" /><circle cx="44" cy="26" r="3" fill="#7af0e0" /></g>}
        <path d="M16 9 q11 -9 22 0 l-2 3 q-9 -5 -18 0 Z" fill={main} />
      </g>
    </svg>
  );
}

/* ===== ของเล่นย้อนยุค PR ===== */
function RetroMic() {
  return (
    <svg className="rtv-prop prop-mic" width="96" height="150" viewBox="0 0 96 150" aria-hidden="true">
      <rect x="42" y="70" width="12" height="62" rx="6" fill="#7c8b9c" />
      <rect x="30" y="128" width="36" height="10" rx="5" fill="#5a6877" />
      <ellipse cx="48" cy="40" rx="28" ry="34" fill="#3a4250" />
      <ellipse cx="48" cy="40" rx="22" ry="28" fill="#586577" />
      {[0, 1, 2, 3, 4].map((i) => <line key={i} x1="28" y1={20 + i * 10} x2="68" y2={20 + i * 10} stroke="#3a4250" strokeWidth="2" />)}
      <rect x="40" y="60" width="16" height="14" rx="3" fill="#ff8a4c" />
      <circle className="mic-led" cx="48" cy="67" r="2.4" fill="#46d38a" />
      <circle className="mic-wave" cx="48" cy="40" r="34" fill="none" stroke="#ff986e" strokeWidth="2" opacity="0.3" />
      <circle className="mic-wave2" cx="48" cy="40" r="40" fill="none" stroke="#8ee8df" strokeWidth="2" opacity="0.25" />
    </svg>
  );
}
function RetroMegaphone() {
  return (
    <svg className="rtv-prop prop-mega" width="140" height="110" viewBox="0 0 140 110" aria-hidden="true">
      <path d="M20 40 L20 70 L55 78 L55 32 Z" fill="#f0673a" />
      <path d="M55 26 L120 6 L120 104 L55 84 Z" fill="#ff8a4c" />
      <ellipse cx="120" cy="55" rx="10" ry="49" fill="#ffd166" />
      <rect x="40" y="80" width="10" height="26" rx="4" fill="#5a6877" transform="rotate(18 45 90)" />
      <circle cx="33" cy="55" r="7" fill="#ffd166" />
      <g style={{ transformBox: "fill-box" }}>
        <path className="sound" d="M126 40 q8 15 0 30" fill="none" stroke="#ff6670" strokeWidth="3" strokeLinecap="round" />
        <path className="sound2" d="M132 34 q12 21 0 42" fill="none" stroke="#ff986e" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  );
}
function RetroCamera() {
  return (
    <svg className="rtv-prop prop-cam" width="130" height="100" viewBox="0 0 130 100" aria-hidden="true">
      <circle cx="34" cy="26" r="18" fill="#3a4250" /><circle cx="34" cy="26" r="11" fill="#586577" />
      <circle cx="96" cy="26" r="18" fill="#3a4250" /><circle cx="96" cy="26" r="11" fill="#586577" />
      <rect x="20" y="40" width="90" height="48" rx="10" fill="#f0673a" />
      <rect x="48" y="34" width="34" height="20" rx="4" fill="#3a4250" />
      <circle cx="65" cy="64" r="15" fill="#23262b" /><circle className="lens" cx="65" cy="64" r="9" fill="#7af0e0" opacity="0.6" />
      <rect x="100" y="50" width="18" height="10" rx="3" fill="#ffd166" />
      <circle className="rec" cx="30" cy="50" r="3.5" fill="#ff5b4d" />
      <rect className="flash" x="0" y="0" width="130" height="100" rx="10" fill="#fff" opacity="0" />
    </svg>
  );
}
function RetroRadio() {
  return (
    <svg className="rtv-prop prop-radio" width="130" height="96" viewBox="0 0 130 96" aria-hidden="true">
      <rect x="8" y="20" width="114" height="68" rx="12" fill="#ff8a4c" />
      <rect x="18" y="30" width="56" height="48" rx="8" fill="#ffd166" />
      {[0, 1, 2, 3, 4].map((i) => <line key={i} x1="24" y1={38 + i * 9} x2="68" y2={38 + i * 9} stroke="#c4531f" strokeWidth="3" />)}
      <circle cx="92" cy="44" r="11" fill="#fff" stroke="#f0673a" strokeWidth="3" />
      <circle cx="92" cy="70" r="8" fill="#fff" stroke="#f0673a" strokeWidth="3" />
      <line x1="100" y1="20" x2="120" y2="2" stroke="#c7ccd2" strokeWidth="3" strokeLinecap="round" />
      <circle cx="120" cy="2" r="4" fill="#fff" />
      <line className="needle" x1="46" y1="78" x2="46" y2="34" stroke="#ff5b4d" strokeWidth="2.5" strokeLinecap="round" />
      <circle className="rdot" cx="92" cy="44" r="3" fill="#46d38a" />
      <path className="rwave" d="M120 2 q12 6 14 18" fill="none" stroke="#8ee8df" strokeWidth="2" opacity="0.5" />
    </svg>
  );
}
