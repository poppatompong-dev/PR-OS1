/* eslint-disable */
// @ts-nocheck — ported from the approved prototype (scratchpad anime.html, owner
// 4 Nov 2026: "เอาทั้งหมดเลย"); plain DOM + GSAP, nothing typed flows in or out.
//
// ฉากเทคนิคการ์ตูนญี่ปุ่น 9 ฉาก — ตัวใหญ่ตะโกน/ตัวหดจิบิ, วิญญาณหลุด, เส้นโฟกัส, เหงื่อตก,
// เมฆหม่น, ไฟลุก, สายฟ้า, ฝุ่นตลบ, ตาดาว ฯลฯ — with the right face for the moment
// (public/cast/<id>/<pose>-<emo>.webp: angry · shout · sad · cry · shock).
// TvCast picks who plays each role (least on screen so far goes first) and passes
// them in as R. Board-covering effects (focus lines, red tint) stay under ~2 s so
// people reading the job queue are barely interrupted.

import gsap from "gsap";
import { MALE_IDS } from "@/lib/monitor/catchphrases";
import { stepTime } from "@/lib/monitor/cast";
import { CAR_SVG } from "./tv-gags";

export const SCENE_EARTH = "00000000-0000-0000-0000-000000000502";
/** earth: needs พี่เอิร์ธ (+ ป้าจิตร) · n: people (never พี่ไป๋) · all: whole cast · badge: a real badge holder */
export const SCENES = [
  { key: "A1", earth: true }, // ตัวใหญ่ตะโกน + ตัวหดจิบิ
  { key: "A2", earth: true }, // วิญญาณหลุด + น้ำตาตก
  { key: "B1", n: 1 }, // งานด่วน! ล้มหน้าทิ่ม
  { key: "B2", n: 3 }, // มุกแป้ก + อีกาบิน
  { key: "B3", n: 2 }, // จ้องหน้า สายฟ้า
  { key: "B4", n: 2 }, // ฝุ่นตลบแย่งขนม
  { key: "B5", all: true }, // ไฟลุก ทั้งทีมสู้!
  { key: "C1", badge: true }, // ได้เหรียญ ตาดาว
  { key: "C2", badge: true }, // วิ่งมารับเหรียญ เส้นความเร็ว
  // 5 Nov 2026 ("feedback ดี คิดเผื่อยาว ๆ"): TvCast casts these from the data it has.
  { key: "J", kind: "joke" }, // มุกจากตู้ส่งมุก (หรือมุกสำรอง) — R = [คนเล่า, คนฟัง…]
  { key: "FL1", kind: "fest", fest: ["loy", "loycd"], n: 2 }, // ลอยกระทง ขอพร งานด่วนลอยกลับ
  { key: "FL2", kind: "fest", fest: ["loy", "loycd"], earth: true }, // ลอยกระทง เงาป้าจิตร
  { key: "FN1", kind: "fest", fest: ["newyear"], n: 3 }, // ของขวัญปีใหม่
  { key: "FN2", kind: "fest", fest: ["newyear", "cny"], all: true }, // นับถอยหลัง พลุ
  { key: "FS1", kind: "fest", fest: ["songkran"], n: 2 }, // สงกรานต์
  { key: "T1", kind: "time", all: true }, // พักเที่ยง
  { key: "T2", kind: "time", n: 1 }, // เช้า สายแล้ว
  { key: "T3", kind: "time", n: 2, pai: true }, // ศุกร์แล้ว เต้น
  { key: "W1", kind: "work" }, // งานใหม่ — R = คนในงาน
  { key: "W2", kind: "work" }, // รับทราบครบทีม
  { key: "W3", kind: "work" }, // วันนี้เคลียร์ครบ
  { key: "S", kind: "serial" }, // ละครตอนต่อ — R = [พี่เอิร์ธ, นักสืบ, ผู้ต้องสงสัย], data.ep 1–5
  // 12 Nov 2026 (owner: "ฝึกทำแก็กตลกไว้ เดี๋ยวจะสร้างละครสั้นเป็นตอน ๆ" · แนวซิตคอมออฟฟิศ ปชส.):
  // eight office skits, each a whole little story. TvCast casts them (kind "skit").
  { key: "K1", kind: "skit", n: 3, dir: true }, // แอ็กชั่น! / คัต! — R = [ผู้กำกับ (คุณสมัชชา), นักแสดง…]
  { key: "K2", kind: "skit", n: 4 }, // เที่ยงตรง
  { key: "K3", kind: "skit", n: 4 }, // ถ่ายรูปหมู่ — R = [ตากล้อง, คนถูกถ่าย…]
  { key: "K4", kind: "skit", n: 3 }, // ไฟล์ final จริง ๆ — R = [คนหา, เพื่อน, เพื่อน]
  { key: "K5", kind: "skit", n: 4 }, // ประชุมแป๊บเดียว
  { key: "K6", kind: "skit", n: 2 }, // แบตกล้องหมด — R = [ตากล้อง, ฮีโร่]
  { key: "K7", kind: "skit", n: 3, nat: true }, // ฝนตก — R = [นัท (นางเงือก), เพื่อน…]
  { key: "K8", kind: "skit", earth: true }, // ถุงของเข้าบ้าน — พี่เอิร์ธ + ป้าจิตร + รถแดง
];

/** มุกสำรอง when nobody has sent one yet (office life, nobody is the butt of it). */
export const BUILTIN_JOKES = [
  { setup: "ประชุมสั้น ๆ แค่ 5 นาที", punch: "…ของจริง 2 ชั่วโมงครึ่ง ⏰" },
  { setup: "หัวหน้าบอกว่า 'ไม่ด่วนนะ'", punch: "แปลว่า… ขอก่อนเที่ยง 😇" },
  { setup: "ไฟล์งานล่าสุดชื่ออะไร?", punch: "final_final_ล่าสุดจริง ๆ_v7.jpg 📁" },
  { setup: "แบตกล้องเหลือ 1 ขีด", punch: "…จะหมดตอนประธานขึ้นเวทีพอดี 🔋" },
  { setup: "ถ่ายรูปหมู่ 30 ช็อต", punch: "ทุกคนหลับตา… คนละช็อต 😑📸" },
  { setup: "Wi-Fi ห้องเราเร็วมาก", punch: "…เร็วที่จะหลุด 📶❌" },
  { setup: "แอร์ห้องเรามีกี่โหมด?", punch: "2 โหมด: ขั้วโลกเหนือ กับ ทะเลทราย 🥶🥵" },
  { setup: "ทำไมกลุ่มไลน์งานเงียบ?", punch: "ทุกคนกำลังพิมพ์ 'รับทราบครับ' พร้อมกัน 📱" },
  { setup: "ขนมในตู้เย็นหายไปไหน?", punch: "…ขอบคุณที่ช่วยลดน้ำหนักให้นะคะ 🍰" },
  { setup: "ปากกาในห้องหายไปไหนหมด?", punch: "ไปประชุมกับคนยืม… ไม่กลับมาอีกเลย 🖊️" },
  { setup: "กาแฟแก้วที่ 3 ช่วยอะไร?", punch: "ไม่ได้ช่วยให้ตื่น… แค่ใจสั่นตอนเห็นงานใหม่ ☕" },
  { setup: "ทำไมช่างภาพไม่ค่อยโกรธ?", punch: "เพราะโฟกัสแต่เรื่องดี ๆ 📷✨" },
  { setup: "งานด่วนกับฝนตกเหมือนกันยังไง?", punch: "มาตอนไม่ได้พกร่มทุกที ☔" },
  { setup: "วันจันทร์กับวันศุกร์ ยาวเท่ากันมั้ย?", punch: "เท่ากัน… แต่ใจไม่เท่ากัน 😩🎉" },
];

export const BADGE_TEXT = {
  job5: "🏅 ขยันออกงาน (ทองแดง)",
  job10: "🏅 ขยันออกงาน (เงิน)",
  job15: "🏅 ขยันออกงาน (ทอง)",
  fast: "⚡ ไวทันใจ",
  help: "🤝 เพื่อนช่วยเพื่อน",
  self: "✍️ ลงงานเอง",
};

const POSES = ["stand", "walkA", "walkB", "runA", "runB", "wave", "up"];
const EMOS = ["", "-angry", "-shout", "-sad", "-cry", "-shock"];
const JIT = ["standE", "standAngry", "walkA", "walkB", "trayA", "trayB", "tiffin"];
const url = (who, pose) => (who === "jit" ? `/cast/jit/${pose}.webp` : `/cast/${who}/${pose}.webp`);

/** Warm the cache for these people's faces (all moods) before a scene starts. */
export function preloadScene(ids) {
  const list = [...ids.flatMap((id) => POSES.flatMap((p) => EMOS.map((e) => url(id, p + e)))), ...JIT.map((p) => url("jit", p))];
  return Promise.all(list.map((u) => new Promise((ok) => { const im = new Image(); im.onload = im.onerror = () => ok(); im.src = u; })));
}

const BOOM = `<svg viewBox="0 0 620 300"><polygon points="310,8 350,70 430,20 430,95 560,60 500,135 612,160 505,190 575,270 455,235 420,292 350,240 300,295 255,238 170,290 160,220 40,262 95,185 8,150 110,120 50,45 175,85 190,15 250,70" fill="#fff" stroke="#1b1024" stroke-width="9" stroke-linejoin="round"/></svg>`;
const FOCUS = (() => { let s = '<svg viewBox="0 0 1920 1080" width="1920" height="1080">'; for (let i = 0; i < 110; i++) { const a = (i / 110) * Math.PI * 2 + Math.random() * 0.03, w = 0.008 + Math.random() * 0.014, r1 = 430 + Math.random() * 180, R = 1500; const p = (rr, aa) => `${960 + Math.cos(aa) * rr},${560 + Math.sin(aa) * rr}`; s += `<polygon points="${p(r1, a)} ${p(R, a - w)} ${p(R, a + w)}" fill="#1b1024" opacity=".75"/>`; } return s + "</svg>"; })();
const SPEED = (() => { let s = '<svg viewBox="0 0 1920 1080" width="1920" height="1080">'; for (let i = 0; i < 46; i++) { const y = 560 + Math.random() * 470, x = Math.random() * 1700, l = 200 + Math.random() * 500; s += `<rect x="${x}" y="${y}" width="${l}" height="${3 + Math.random() * 5}" fill="#fff" opacity="${0.35 + Math.random() * 0.5}"/>`; } return s + "</svg>"; })();
const SOUL = `<svg viewBox="0 0 90 120"><path d="M45 6 C78 6 86 40 78 62 C72 80 60 88 60 100 C60 112 48 118 40 108 C46 100 34 96 26 90 C8 78 4 50 14 30 C22 14 32 6 45 6Z" fill="#fff" stroke="#1b1024" stroke-width="5"/><circle cx="34" cy="44" r="5" fill="#1b1024"/><circle cx="56" cy="44" r="5" fill="#1b1024"/><path d="M36 60 Q45 54 54 60" stroke="#1b1024" stroke-width="4" fill="none"/></svg>`;
const DROP = `<svg viewBox="0 0 46 64"><path d="M23 3 C30 20 43 32 43 44 C43 56 34 62 23 62 C12 62 3 56 3 44 C3 32 16 20 23 3Z" fill="#9fd8ff" stroke="#1b1024" stroke-width="4"/><ellipse cx="16" cy="44" rx="5" ry="8" fill="#fff"/></svg>`;
const CLOUD = `<svg viewBox="0 0 240 90"><path d="M30 80 C0 80 0 45 28 42 C26 14 66 6 80 28 C92 2 146 2 154 30 C176 12 214 22 206 50 C236 52 236 82 206 82Z" fill="#3b2b4d" stroke="#1b1024" stroke-width="5"/></svg>`;
const FIRE = `<svg viewBox="0 0 330 460"><defs><linearGradient id="tvfg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff3b1f"/><stop offset=".55" stop-color="#ff9a1f"/><stop offset="1" stop-color="#ffe066" stop-opacity=".2"/></linearGradient></defs><path d="M165 460 C40 460 0 380 30 300 C50 250 40 200 70 150 C80 210 110 220 110 220 C100 140 140 60 190 10 C180 90 240 120 250 190 C262 160 282 150 290 120 C320 200 340 280 320 340 C300 420 250 460 165 460Z" fill="url(#tvfg)"/></svg>`;
const ZAP = `<svg viewBox="0 0 300 80"><polyline points="0,40 50,10 90,60 140,15 180,62 230,18 300,40" fill="none" stroke="#ffe066" stroke-width="12" stroke-linejoin="round"/><polyline points="0,40 50,10 90,60 140,15 180,62 230,18 300,40" fill="none" stroke="#fff" stroke-width="4"/></svg>`;

/** Plays scene i on a fresh 1920×1080 stage inside host. floor = the ticker's top in stage pixels. */
export function playScene(i, host, floor, scale, R, data, onDone) {
  data = data || {};
  const tv = document.createElement("div");
  tv.className = "tv-gag tv-scene";
  tv.style.transform = `scale(${scale})`;
  const st = document.createElement("div");
  st.className = "st";
  tv.appendChild(st);
  host.appendChild(tv);
const W=1920, FLOOR=floor, SW=190, SH=340;
let tl=null, ivs=[], follows=[], tos=[];
const el=(cls,html)=>{const d=document.createElement('div');d.className=cls;if(html!==undefined)d.innerHTML=html;st.appendChild(d);return d};
const sprite=(who,pose,x)=>{const d=el('sp');d.style.width=SW+'px';d.style.height=SH+'px';d.style.backgroundImage=`url(${url(who,pose)})`;d.dataset.who=who;gsap.set(d,{xPercent:-50,yPercent:-100,x,y:FLOOR,transformOrigin:'50% 100%'});return d};
const show=(d,pose)=>{d.style.backgroundImage=`url(${url(d.dataset.who,pose)})`};
const cyc=(d,a,b,s)=>{let k=0;show(d,a);const iv=setInterval(()=>{k^=1;show(d,k?b:a)},stepTime(d.dataset.who,s)*1000);ivs.push(iv)};
const stopCyc=()=>{ivs.forEach(clearInterval);ivs=[]};
const follow=(e,t,dx,dy)=>follows.push([e,t,dx,dy]);
const tick=()=>follows.forEach(([e,t,dx,dy])=>{const s=gsap.getProperty(t,'scaleY')||1;gsap.set(e,{x:gsap.getProperty(t,'x')+dx*Math.abs(s),y:gsap.getProperty(t,'y')+dy*Math.abs(s)})});
gsap.ticker.add(tick);
const bubble=(t,c='')=>el('bubble '+c,t);
const pop=(b,t)=>tl.fromTo(b,{opacity:0,scale:.4},{opacity:1,scale:1,duration:.3,ease:'back.out(2.5)'},t);
const hide=(a,t)=>tl.to(a,{opacity:0,duration:.3},t);
const shake=(t,n=10,amp=18)=>tl.to(st,{x:`random(-${amp},${amp})`,y:`random(-${amp},${amp})`,duration:.04,repeat:n,yoyo:true,repeatRefresh:true},t).set(st,{x:0,y:0},t+.04*(n+1));
const E=id=>MALE_IDS.has(id)?'ครับ':'ค่ะ';
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const KT=`<svg viewBox="0 0 96 76"><ellipse cx="48" cy="62" rx="44" ry="12" fill="#6fbf5a" stroke="#1b1024" stroke-width="4"/><path d="M14 58 Q20 30 32 52 Q38 22 48 50 Q58 22 64 52 Q76 30 82 58Z" fill="#ff8fb3" stroke="#1b1024" stroke-width="4" stroke-linejoin="round"/><rect x="45" y="18" width="6" height="26" fill="#fff6d6" stroke="#1b1024" stroke-width="3"/><path d="M48 4 Q54 12 48 18 Q42 12 48 4Z" fill="#ffd36b" stroke="#1b1024" stroke-width="2"/></svg>`;
function river(){const r=el('river');gsap.set(r,{x:0,y:FLOOR-40});return r}
function confetti(t,n=40,x0=W*.5,y0=FLOOR-SH){tl.call(()=>{const C=['#ff5d8a','#ffd36b','#7fd3ff','#9b7bff','#7fe0a0'];for(let i=0;i<n;i++){const c=el('conf');c.style.background=C[i%C.length];gsap.fromTo(c,{x:x0,y:y0,opacity:1,rotation:0},{x:x0+(Math.random()-.5)*900,y:y0-150-Math.random()*250,rotation:Math.random()*720,duration:.7,ease:'power2.out',onComplete:()=>{gsap.to(c,{y:FLOOR,rotation:'+=360',opacity:0,duration:1.4+Math.random(),ease:'power1.in',onComplete:()=>c.remove()})}})}},null,t)}
function firework(x,y,t,color){tl.call(()=>{for(let i=0;i<18;i++){const s=el('spark');s.style.background=color;const a=i/18*Math.PI*2;gsap.fromTo(s,{x,y,opacity:1,scale:1},{x:x+Math.cos(a)*170,y:y+Math.sin(a)*170+30,opacity:0,scale:.4,duration:1.1,ease:'power2.out',onComplete:()=>s.remove()})}},null,t)}
function title(txt,t,dur=1.6){const b=el('ttl',txt);gsap.set(b,{x:W*.5,xPercent:-50,y:Math.max(30,FLOOR-SH-250)});tl.fromTo(b,{opacity:0,scale:.6},{opacity:1,scale:1,duration:.3,ease:'back.out(2)'},t).to(b,{opacity:0,duration:.3},t+dur);return b}
// Board-covering effects: short and a little see-through so the queue stays readable.
function focusLines(t,dur){dur=Math.min(dur,2);const f=el('focus',FOCUS);tl.to(f,{opacity:.6,duration:.08},t).to(f,{rotation:2,duration:.08,yoyo:true,repeat:Math.round(dur/.08),transformOrigin:'50% 52%'},t).to(f,{opacity:0,duration:.2},t+dur);return f}
function flash(t,color='#fff'){const f=el('flash');f.style.background=color;tl.fromTo(f,{opacity:.7},{opacity:0,duration:.3,immediateRender:false},t)}
function impact(t){tl.set(st,{filter:'invert(1)'},t).set(st,{filter:'none'},t+.08).set(st,{filter:'invert(1)'},t+.14).set(st,{filter:'none'},t+.2)}
function sfx(txt,x,y,t,rot=-8,size=150){const s=el('sfx',txt);s.style.fontSize=size+'px';gsap.set(s,{x,y,rotation:rot});tl.fromTo(s,{opacity:0,scale:2.2},{opacity:1,scale:1,duration:.22,ease:'back.out(3)'},t).to(s,{opacity:0,duration:.4},t+1.1);return s}
function soul(who,t){const s=el('soul',SOUL);tl.call(()=>{const x=gsap.getProperty(who,'x'),y=gsap.getProperty(who,'y');gsap.set(s,{x:x-45,y:y-SH-110})},null,t).to(s,{opacity:1,duration:.3},t).to(s,{y:'-=260',duration:2.4,ease:'sine.out'},t).to(s,{x:'+=40',duration:.4,yoyo:true,repeat:5,ease:'sine.inOut'},t).to(s,{opacity:0,duration:.5},t+2.2)}
function drop(who,t,dx=84,dy=-SH-10){const d=el('drop',DROP);follow(d,who,dx,dy);tl.fromTo(d,{opacity:0,scale:.3},{opacity:1,scale:1.2,duration:.3,ease:'back.out(3)'},t);return d}
function gloom(who,t,dur){const g=el('gloom'),c=el('cloud',CLOUD);follow(g,who,-100,-SH-60);follow(c,who,-120,-SH-150);g.style.height='90px';tl.to([g,c],{opacity:1,duration:.4},t).to([g,c],{opacity:0,duration:.4},t+dur);return[g,c]}
function tears(who,t,dur){const a=el('tear'),b=el('tear');follow(a,who,-36,-SH*.66);follow(b,who,14,-SH*.66);tl.to([a,b],{opacity:1,height:130,duration:.5},t).to([a,b],{height:150,duration:.25,yoyo:true,repeat:Math.round(dur/.25)},t+.5).to([a,b],{opacity:0,duration:.3},t+dur)}
function hearts(who,t,n=8,emo='❤️'){tl.call(()=>{for(let i=0;i<n;i++){const h=el('emo',emo);const x=gsap.getProperty(who,'x'),y=gsap.getProperty(who,'y');gsap.fromTo(h,{x:x-28+(Math.random()-.5)*170,y:y-SH-40,opacity:1,scale:.6},{y:y-SH-170-Math.random()*80,x:`+=${(Math.random()-.5)*160}`,opacity:0,scale:1.2,duration:1.6,delay:i*.14,onComplete:()=>h.remove()})}},null,t)}
function dustPuff(who,t,dur){tl.call(()=>{const iv=setInterval(()=>{const x=gsap.getProperty(who,'x'),y=gsap.getProperty(who,'y');const p=el('emo','💨');gsap.fromTo(p,{x:x-80,y:y-50,opacity:.9},{x:x-180,opacity:0,duration:.5,onComplete:()=>p.remove()})},180);ivs.push(iv);tos.push(setTimeout(()=>clearInterval(iv),dur*1000))},null,t)}

// one cycle per sprite (stopCyc stops them all) + walk/run that end in a pose — for the skits
const cyc1=(d,a,b,s)=>{clearInterval(d._iv);let k=0;show(d,a);d._iv=setInterval(()=>{k^=1;show(d,k?b:a)},stepTime(d.dataset.who,s)*1000);ivs.push(d._iv)};
const stop1=(d,pose)=>{clearInterval(d._iv);if(pose)show(d,pose)};
const walk=(d,x,t,dur,end='stand',a='walkA',b='walkB')=>{tl.call(()=>cyc1(d,a,b,.26),null,t).to(d,{x,duration:dur,ease:'none'},t).call(()=>stop1(d,end),null,t+dur)};
const run=(d,x,t,dur,end,a='runA',b='runB')=>{tl.call(()=>cyc1(d,a,b,.09),null,t).to(d,{x,duration:dur,ease:'power1.in'},t).to(d,{y:FLOOR-12,duration:.09,yoyo:true,repeat:Math.max(1,Math.round(dur/.09/2)*2-1)},t).call(()=>stop1(d,end),null,t+dur)};
const emo=(ch,size=56)=>{const d=el('emo',ch);d.style.fontSize=size+'px';return d};
const say=(who,txt,t,dur=1.8,cls='sm',dx=-70,dy=-SH-100)=>{const b=bubble(txt,cls);follow(b,who,dx,dy);pop(b,t);hide(b,t+dur);return b};
const hop=(d,t,n=3,h=46)=>tl.set(d,{y:FLOOR},t).to(d,{y:FLOOR-h,duration:.18,yoyo:true,repeat:n*2-1,ease:'power2.out'},t);
const SIT=46; // the sit sprites float this far above the standing foot line
const sit=(d,t)=>tl.call(()=>show(d,'sit'),null,t).fromTo(d,{y:FLOOR+SIT-30},{y:FLOOR+SIT,duration:.25,ease:'bounce.out',immediateRender:false},t);
const rise=(d,t,pose)=>tl.call(()=>show(d,pose),null,t).set(d,{y:FLOOR},t);

const SC=[
// A1 ตัวใหญ่ตะโกน + ตัวหดจิบิ
()=>{const ew=R[0];const e=sprite(ew,'walkA',-150),j=sprite('jit','standAngry',W*.66),say=bubble('คืนนี้ผมกลับดึกนะ~ 😎'),red=el('reddim'),bm=el('boom',BOOM+'<b>ว่ายังไงนะ!?</b>'),a1=el('emo','💢'),a2=el('emo','💢'),a3=el('emo','💢'),ok=bubble('…ห้าโมงตรงครับ 🙇','sm');
 gsap.set(j,{opacity:0});follow(say,e,-60,-SH-110);follow(ok,e,-60,-SH-210);
 tl.call(()=>cyc(e,'walkA','walkB',.26),null,0).to(e,{x:W*.36,duration:1.8,ease:'power1.out'},0).call(()=>{stopCyc();show(e,'wave')},null,1.8);pop(say,1.9);
 tl.to(j,{opacity:1,duration:.2},3.0).to(red,{opacity:.8,duration:.15},3.3);focusLines(3.3,1.8);impact(3.3);
 tl.fromTo(j,{scale:1},{scale:2.7,duration:.35,ease:'back.out(2)'},3.3);shake(3.3,14,22);
 tl.set(bm,{x:W*.66-900,y:Math.max(40,FLOOR-SH*2.7+40)},3.4);pop(bm,3.45);tl.to(bm,{rotation:2,duration:.06,yoyo:true,repeat:16},3.6);
 [a1,a2,a3].forEach((a,i)=>{gsap.set(a,{x:W*.66+170+i*55,y:FLOOR-SH*2.7-40+i*40,fontSize:'90px'});tl.to(a,{opacity:1,scale:1.3,duration:.15,yoyo:true,repeat:5},3.5+i*.1)});
 hide(say,3.3);tl.call(()=>show(e,'stand-shock'),null,3.3).to(e,{scale:.45,duration:.3,ease:'back.in(2)'},3.6);drop(e,3.9,40,-SH*.45);
 tl.to(red,{opacity:0,duration:.4},5.0);hide([bm,a1,a2,a3],5.1);tl.to(j,{scale:1,duration:.4,ease:'power2.out'},5.1).call(()=>show(e,'stand-sad'),null,5.3);pop(ok,5.4);
 tl.to(e,{rotation:10,duration:.25,yoyo:true,repeat:5},5.5);hide(ok,7.4);tl.to([e,j],{opacity:0,duration:.5},7.8);},
// A2 วิญญาณหลุด + น้ำตาตก
()=>{const ew=R[0];const e=sprite(ew,'walkA',-150),j=sprite('jit','walkA',W+150),wal=el('emo','👛'),say=bubble('เงินเดือนออกแล้ว!! 💰'),her=bubble('ขอบคุณค่า~ 😊','sm'),dots=el('dots','…');
 follow(say,e,-60,-SH-110);follow(her,j,-80,-SH-100);follow(wal,e,40,-SH*.55);
 tl.call(()=>cyc(e,'walkA','walkB',.26),null,0).to(e,{x:W*.40,duration:1.8,ease:'power1.out'},0).call(()=>{stopCyc();show(e,'up')},null,1.8);pop(say,1.9);tl.to(wal,{opacity:1,duration:.2},1.9);
 tl.set(j,{scaleX:-1},0).call(()=>cyc(j,'walkA','walkB',.26),null,2.4).to(j,{x:W*.6,duration:1.4,ease:'power1.out'},2.4).call(()=>{stopCyc();show(j,'standE')},null,3.8);
 tl.call(()=>{follows=follows.filter(f=>f[0]!==wal)},null,3.9).to(wal,{x:W*.6-20,y:FLOOR-SH*.55,duration:.6,ease:'power2.inOut'},3.9);pop(her,4.4);hide(say,3.9);
 tl.call(()=>show(e,'stand-shock'),null,4.2).call(()=>show(e,'stand-cry'),null,4.8);soul(e,4.6);
 gloom(e,4.6,3.6);tears(e,5.0,3.0);tl.set(dots,{x:W*.40+70,y:FLOOR-SH-120},5.4).to(dots,{opacity:1,duration:.3},5.4);
 hide([her,wal,dots],8.0);tl.to([e,j],{opacity:0,duration:.5},8.6);},
// B1 งานด่วน! ล้มหน้าทิ่ม
()=>{const k=sprite(R[0],'walkA',-150),card=el('ucard','‼ งานด่วน! 30 นาที'),up=bubble(E(R[0])==='ครับ'?'ครับผม!! 🫡':'ได้ค่ะ!! 🫡','sm');
 follow(up,k,-60,-SH-100);
 tl.call(()=>cyc(k,'walkA','walkB',.26),null,0).to(k,{x:W*.45,duration:2.0,ease:'none'},0).call(()=>{stopCyc();show(k,'stand')},null,2.0);
 tl.set(card,{x:W*.45-220,y:-200},2.1).to(card,{opacity:1,y:FLOOR-SH-220,duration:.28,ease:'power4.in'},2.1);impact(2.38);shake(2.38,10,20);sfx('ตู้ม!!',W*.45+180,FLOOR-SH-300,2.38,10);flash(2.38,'#ff3b4f');
 tl.call(()=>show(k,'stand-shock'),null,2.38);
 tl.to(k,{rotation:-100,y:FLOOR-20,duration:.18,ease:'power3.in'},2.6).to(k,{rotation:-180,y:FLOOR-SH,duration:.2},2.85).to(k,{x:'+=6',duration:.05,yoyo:true,repeat:9},3.1);
 tl.to(k,{rotation:0,y:FLOOR,duration:.35,ease:'back.out(2)'},4.0);drop(k,4.3);tl.call(()=>show(k,'up-shout'),null,4.45);pop(up,4.5);hide([card],4.6);
 tl.call(()=>cyc(k,'runA-shock','runB-shock',.08),null,5.4).to(k,{x:W+200,duration:1.0,ease:'power2.in'},5.5);dustPuff(k,5.5,1.0);hide(up,5.6);},
// B2 มุกแป้ก + อีกาบิน
()=>{const n=sprite(R[0],'walkA',-150),p=sprite(R[1],'stand',W*.55),a=sprite(R[2],'stand',W*.66),joke=bubble('ทำไมกล้องถึงเขิน… เพราะโดนซูม 😎'),dots=el('dots','…'),crow=el('emo','🐦'),caw=el('emo','<span style="font-size:34px;font-weight:900;color:#fff;-webkit-text-stroke:3px #1b1024;paint-order:stroke fill">อ๊าก~ อ๊าก~</span>');
 gsap.set([p,a],{opacity:0,scaleX:-1});follow(joke,n,-60,-SH-110);crow.style.filter='brightness(0)';crow.style.fontSize='80px';
 tl.to([p,a],{opacity:1,duration:.4},0).call(()=>cyc(n,'walkA','walkB',.26),null,0).to(n,{x:W*.40,duration:1.8,ease:'power1.out'},0).call(()=>{stopCyc();show(n,'wave')},null,1.8);pop(joke,2.0);
 hide(joke,4.0);tl.call(()=>{show(p,'stand-sad');show(a,'stand-shock')},null,4.0);tl.set(dots,{x:W*.52,y:FLOOR-SH-150},4.1).to(dots,{opacity:1,duration:.3},4.1);
 tl.set(crow,{x:W+40,y:Math.max(80,FLOOR-SH-380),scaleX:-1},4.4).to(crow,{opacity:1,duration:.1},4.4).to(crow,{x:-120,duration:3.2,ease:'none'},4.4).to(crow,{y:'+=26',duration:.3,yoyo:true,repeat:10,ease:'sine.inOut'},4.4);
 tl.set(caw,{x:W*.55,y:Math.max(40,FLOOR-SH-430)},5.0).to(caw,{opacity:1,duration:.2},5.0).to(caw,{opacity:0,duration:.3},6.4);
 drop(p,5.2,40);drop(a,5.4,40);tl.call(()=>show(n,'stand-cry'),null,5.6);gloom(n,5.6,2.2);hide([dots],7.4);tl.to([n,p,a],{opacity:0,duration:.5},8.0);},
// B3 จ้องหน้า สายฟ้า
()=>{const a=sprite(R[0],'stand',W*.40),b=sprite(R[1],'stand',W*.60),z=el('zap',ZAP),cake=el('emo','🍰'),t1=bubble('ชิ้นสุดท้าย…','sm'),fl1=el('fire',FIRE),fl2=el('fire',FIRE);
 gsap.set(b,{scaleX:-1});gsap.set([a,b],{opacity:0});st.prepend(fl1);st.prepend(fl2);gsap.set(fl1,{x:W*.40-165,y:FLOOR-460});gsap.set(fl2,{x:W*.60-165,y:FLOOR-460});
 tl.to([a,b],{opacity:1,duration:.4},0).set(cake,{x:W*.5-28,y:FLOOR-260,fontSize:'64px'},.4).to(cake,{opacity:1,duration:.3},.4);tl.set(t1,{x:W*.5-110,y:FLOOR-380},.6);pop(t1,.6);
 hide(t1,2.2);tl.call(()=>{show(a,'stand-angry');show(b,'stand-angry')},null,2.3);focusLines(2.3,2.0);tl.to([fl1,fl2],{opacity:.9,duration:.3},2.3).to([fl1,fl2],{scaleY:1.08,duration:.15,yoyo:true,repeat:16,transformOrigin:'50% 100%'},2.3);
 tl.set(z,{x:W*.5-150,y:FLOOR-SH*.72},2.5).to(z,{opacity:1,duration:.06,yoyo:true,repeat:21},2.5);sfx('เปรี๊ยะ!',W*.5-200,FLOOR-SH-280,2.6,-6,120);
 tl.to([a,b],{y:FLOOR-14,duration:.08,yoyo:true,repeat:24},2.5);
 tl.to([fl1,fl2,z],{opacity:0,duration:.3},5.0).call(()=>{show(a,'wave');show(b,'wave')},null,5.2);const lol=bubble('แบ่งครึ่งกันก็ได้ 555 😂','sm');tl.set(lol,{x:W*.5-200,y:FLOOR-SH-120},5.3);pop(lol,5.3);hearts(a,5.5,5);hearts(b,5.6,5);hide([lol,cake],7.6);tl.to([a,b],{opacity:0,duration:.5},8.0);},
// B4 ฝุ่นตลบแย่งขนม
()=>{const a=sprite(R[0],'runA-angry',-150),b=sprite(R[1],'runA-angry',W+150),d=el('dust'),cake=el('emo','🍩');
 gsap.set(b,{scaleX:-1});d.innerHTML='<svg viewBox="0 0 520 300">'+Array.from({length:14},()=>`<circle cx="${70+Math.random()*380}" cy="${80+Math.random()*150}" r="${50+Math.random()*40}" fill="#efe6f7" stroke="#1b1024" stroke-width="5"/>`).join('')+'</svg>';
 tl.set(cake,{x:W*.5-28,y:FLOOR-200,fontSize:'70px'},0).to(cake,{opacity:1,duration:.3},0);
 tl.call(()=>{cyc(a,'runA-angry','runB-angry',.08);cyc(b,'runA-angry','runB-angry',.08)},null,.2).to(a,{x:W*.5-60,duration:1.0,ease:'power2.in'},.2).to(b,{x:W*.5+60,duration:1.0,ease:'power2.in'},.2);
 tl.set(d,{x:W*.5-260,y:FLOOR-300},1.2).to(d,{opacity:1,duration:.1},1.2).to([a,b,cake],{opacity:0,duration:.05},1.2);impact(1.2);
 tl.to(d,{rotation:4,x:'+=12',duration:.07,yoyo:true,repeat:36},1.25);
 const bits=['👟','✋','⭐','🦶','💫','✋','⭐'].map(e=>el('emo',e));bits.forEach((x,i)=>{tl.call(()=>{gsap.fromTo(x,{x:W*.5-40+(Math.random()-.5)*300,y:FLOOR-150-(Math.random()*120),opacity:1,scale:.6},{x:`+=${(Math.random()-.5)*220}`,y:`-=${80+Math.random()*80}`,opacity:0,scale:1.3,duration:.5,repeat:4,repeatDelay:.1})},null,1.3+i*.25)});
 sfx('ตุบ! ตับ!',W*.5-260,FLOOR-SH-260,1.6,-8,130);
 tl.to(d,{opacity:0,scale:1.3,duration:.4},4.0).call(()=>{stopCyc();show(a,'wave');show(b,'wave')},null,4.0).to([a,b],{opacity:1,duration:.2},4.0);
 const half=bubble('🍩 ได้คนละครึ่ง 😁','sm');tl.set(half,{x:W*.5-150,y:FLOOR-SH-120},4.3);pop(half,4.3);hearts(a,4.5,4);hearts(b,4.5,4);hide(half,6.6);tl.to([a,b],{opacity:0,duration:.5},7.0);},
// B5 ไฟลุก ทั้งทีมสู้!
()=>{const n=R.length,step=Math.min(W*.108,W*.86/Math.max(n,1)),X=i=>W*.5+(i-(n-1)/2)*step;const ss=R.map((w,i)=>sprite(w,'stand',X(i)));const fl=R.map(()=>el('fire',FIRE));
 fl.forEach((f,i)=>{st.prepend(f);gsap.set(f,{x:X(i)-165,y:FLOOR-460,scale:.65,transformOrigin:'50% 100%'})});gsap.set(ss,{opacity:0});
 const big=el('sfx','สู้!! 🔥');big.style.fontSize='190px';gsap.set(big,{x:W*.5-330,y:Math.max(40,FLOOR-SH-330)});
 tl.to(ss,{opacity:1,duration:.3,stagger:.06},0);focusLines(1.2,1.8);tl.to(fl,{opacity:.85,duration:.3,stagger:.04},1.2).to(fl,{scaleY:.55,duration:.14,yoyo:true,repeat:22},1.3);
 tl.call(()=>ss.forEach(s=>show(s,'up-shout')),null,1.4).to(ss,{y:FLOOR-70,duration:.22,yoyo:true,repeat:5,stagger:.05,ease:'power2.out'},1.5);
 tl.fromTo(big,{opacity:0,scale:3},{opacity:1,scale:1,duration:.3,ease:'back.out(2)'},1.6);shake(1.6,10,14);
 tl.to([big,...fl],{opacity:0,duration:.4},4.6).call(()=>ss.forEach(s=>show(s,'wave')),null,4.6).to(ss,{opacity:0,duration:.5,stagger:.04},5.8);},
// C1 ได้เหรียญ ตาดาว
()=>{const p=sprite(R[0],'walkA',-150),bg=el('sparkbg'),medal=el('emo',data.icon||'🏅'),hb=bubble(data.label),bl1=el('blush'),bl2=el('blush'),s1=el('emo','⭐'),s2=el('emo','⭐');
 st.prepend(bg);follow(hb,p,-200,-SH-130);follow(medal,p,-25,-SH*.42);follow(bl1,p,-78,-SH*.55);follow(bl2,p,10,-SH*.55);follow(s1,p,-150,-SH*.86);follow(s2,p,96,-SH*.86);
 tl.call(()=>cyc(p,'walkA','walkB',.26),null,0).to(p,{x:W*.5,duration:2.0,ease:'power1.out'},0).call(()=>{stopCyc();show(p,'wave')},null,2.0);
 tl.to(bg,{opacity:.7,duration:.5},2.1);pop(hb,2.2);tl.fromTo(medal,{opacity:0,scale:3},{opacity:1,scale:1,duration:.35,ease:'back.out(2)'},2.3);
 tl.to([bl1,bl2],{opacity:.9,duration:.3},2.6).fromTo([s1,s2],{opacity:0,scale:.2},{opacity:1,scale:1,duration:.3,ease:'back.out(3)'},2.6).to([s1,s2],{rotation:20,duration:.3,yoyo:true,repeat:9},2.9);
 tl.call(()=>{for(let i=0;i<20;i++){const b=el('bub');const r=20+Math.random()*60;b.style.width=b.style.height=r+'px';gsap.fromTo(b,{x:W*.2+Math.random()*W*.6,y:FLOOR-Math.random()*200,opacity:0},{y:`-=${300+Math.random()*300}`,opacity:.9,duration:2+Math.random()*1.5,delay:Math.random()*1.2,yoyo:true,repeat:1,onComplete:()=>b.remove()})}},null,2.4);
 hearts(p,4.4,10,'✨');tl.to(p,{scaleY:.86,scaleX:1.12,duration:.12,yoyo:true,repeat:1},3.0).to(p,{y:FLOOR-90,duration:.25,yoyo:true,repeat:3,ease:'power2.out'},3.3);
 hide([hb,medal,bl1,bl2,s1,s2],6.4);tl.to(bg,{opacity:0,duration:.6},6.4).to(p,{opacity:0,duration:.5},6.8);},
// C2 วิ่งมารับเหรียญ เส้นความเร็ว
()=>{const s=sprite(R[0],'runA',-200),sp=el('focus',SPEED),badge=bubble(data.label);
 tl.to(sp,{opacity:1,duration:.1},.2).to(sp,{x:-300,duration:.25,repeat:9,ease:'none'},.2);
 tl.call(()=>cyc(s,'runA','runB',.06),null,.2).to(s,{x:W*.5,duration:.5,ease:'power3.out'},.2).to(s,{rotation:8,duration:.1},.2);sfx('ฟิ้ว~',W*.5-420,FLOOR-SH-120,.4,-12,120);
 tl.call(()=>{stopCyc();show(s,'wave')},null,.8).to(s,{rotation:0,duration:.2},.8);tl.set(badge,{x:W*.5-330,y:FLOOR-SH-130},.9);pop(badge,.9);hearts(s,1.0,8,data.icon||'⚡');
 tl.to(sp,{opacity:0,duration:.3},2.6);tl.call(()=>cyc(s,'runA','runB',.06),null,4.6).to(s,{x:W+260,duration:.45,ease:'power3.in'},4.6);tl.to(sp,{opacity:1,duration:.1},4.6).to(sp,{opacity:0,duration:.3},5.1);hide(badge,4.5);},
// ---------- J มุกจากทีม (ตู้ส่งมุก Telegram / มุกสำรอง) ----------
()=>{const t=sprite(R[0],'walkA',-150),L=R.slice(1).map((id,i)=>sprite(id,'stand',W*(.58+i*.1)));
 gsap.set(L,{opacity:0,scaleX:-1});
 const cr=data.name?el('credit',`💌 มุกจาก ${data.name}`):null,q1=data.setup?bubble(data.setup):null,q2=bubble(data.punch);
 follow(q2,t,-80,-SH-120);if(q1)follow(q1,t,-80,-SH-120);
 tl.to(L,{opacity:1,duration:.4},0).call(()=>cyc(t,'walkA','walkB',.26),null,0).to(t,{x:W*.40,duration:1.8,ease:'power1.out'},0).call(()=>{stopCyc();show(t,'wave')},null,1.8);
 if(cr){gsap.set(cr,{x:W*.40-180,y:FLOOR-SH-250});tl.to(cr,{opacity:1,duration:.3},1.9)}
 let k=2.1;if(q1){pop(q1,k);k+=Math.min(4,1.8+[...data.setup].length*.05);hide(q1,k);k+=.6}
 tl.call(()=>show(t,'up-shout'),null,k);pop(q2,k);tl.to(t,{y:FLOOR-40,duration:.18,yoyo:true,repeat:1},k);k+=Math.min(4.5,2+[...data.punch].length*.05);
 if(data.react==='laugh'){
  tl.call(()=>L.forEach(s=>show(s,'up-shout')),null,k);sfx('ฮ่า ๆ ๆ 5555+',W*.5,FLOOR-SH-330,k,-6,110);
  L.forEach((s,i)=>tl.to(s,{rotation:i%2?80:-80,y:FLOOR-10,duration:.35,ease:'power2.in'},k+.3+i*.15).to(s,{x:'+=8',duration:.06,yoyo:true,repeat:18},k+.7+i*.15));
  L.forEach(s=>hearts(s,k+.5,6,'🤣'));tl.call(()=>show(t,'wave'),null,k+.4).to(t,{y:FLOOR-80,duration:.22,yoyo:true,repeat:3,ease:'power2.out'},k+.5);
  hide([q2,cr].filter(Boolean),k+2.4);tl.to(L,{rotation:0,y:FLOOR,duration:.3},k+2.6);k+=3.2;
 }else{
  const crow=el('emo','🐦'),dots=el('dots','…');crow.style.filter='brightness(0)';crow.style.fontSize='80px';
  tl.call(()=>L.forEach((s,i)=>show(s,i%2?'stand-shock':'stand-sad')),null,k);tl.set(dots,{x:W*.6,y:FLOOR-SH-150},k).to(dots,{opacity:1,duration:.3},k);
  tl.set(crow,{x:W+40,y:Math.max(80,FLOOR-SH-380),scaleX:-1},k+.3).to(crow,{opacity:1,duration:.1},k+.3).to(crow,{x:-120,duration:3,ease:'none'},k+.3);
  L.forEach((s,i)=>drop(s,k+.6+i*.2,40));hide(q2,k+.9);tl.call(()=>show(t,'stand-cry'),null,k+1);gloom(t,k+1,2);
  hide([dots,cr].filter(Boolean),k+2.8);k+=3.3;
 }
 tl.to([t,...L],{opacity:0,duration:.5},k);},
// ---------- FL1 ลอยกระทง ขอพร แล้วงานด่วนลอยกลับมา ----------
()=>{const a=sprite(R[0],'walkA',-150),b=sprite(R[1],'walkA',-420),riv=river(),k1=el('kt',KT),k2=el('kt',KT);
 follow(k1,a,30,-SH*.5);follow(k2,b,30,-SH*.5);
 const w1=bubble(`ขอให้งานด่วนน้อยลง 🙏`,'sm'),w2=bubble(`ขอให้ได้หยุดยาว ๆ 🙏`,'sm'),big=el('ucard','‼ งานด่วน!');
 follow(w1,a,-60,-SH-100);follow(w2,b,-120,-SH-170);
 tl.to(riv,{opacity:1,duration:.5},0).to([k1,k2],{opacity:1,duration:.3},0).call(()=>{cyc(a,'walkA','walkB',.26);cyc(b,'walkA','walkB',.26)},null,0)
  .to(a,{x:W*.5,duration:2,ease:'power1.out'},0).to(b,{x:W*.38,duration:2,ease:'power1.out'},0).call(()=>{stopCyc();show(a,'stand');show(b,'stand')},null,2);
 tl.call(()=>{follows=follows.filter(f=>f[0]!==k1&&f[0]!==k2)},null,2.2).to(k1,{x:W*.5+40,y:FLOOR-64,duration:.5},2.2).to(k2,{x:W*.38+40,y:FLOOR-64,duration:.5},2.4);
 tl.to([k1,k2],{x:'+=900',duration:5.4,ease:'none'},2.9).to([k1,k2],{y:'+=6',duration:.4,yoyo:true,repeat:12,ease:'sine.inOut'},2.9);
 tl.call(()=>{show(a,'wave');show(b,'wave')},null,2.9);pop(w1,3.0);pop(w2,3.5);hide([w1,w2],5.2);
 gsap.set(big,{x:W+40,y:FLOOR-130,rotation:-6});tl.to(big,{opacity:1,duration:.2},5.4).to(big,{x:W*.56,duration:1.4,ease:'power1.out'},5.4).to(big,{y:'+=8',duration:.35,yoyo:true,repeat:5},5.4);
 tl.call(()=>{show(a,'stand-shock');show(b,'stand-shock')},null,6.4);drop(a,6.5);drop(b,6.6);sfx('เฮ้ย!!',W*.36,FLOOR-SH-300,6.5,-8,120);
 tl.to([a,b],{scaleX:-1,duration:.01},7.4).call(()=>{cyc(a,'runA-shock','runB-shock',.08);cyc(b,'runA-shock','runB-shock',.08)},null,7.4).to([a,b],{x:-260,duration:1.2,ease:'power2.in'},7.5);dustPuff(a,7.5,1);
 tl.to([big,riv,k1,k2],{opacity:0,duration:.5},8.8);},
// ---------- FL2 ลอยกระทง พี่เอิร์ธขอพร เงาป้าจิตรมา ----------
()=>{const e=sprite(R[0],'walkA',-150),riv=river(),k=el('kt',KT),sh=(()=>{const d=el('shadow');st.prepend(d);return d})(),w=bubble('ขอให้ได้ไปเที่ยวกับเพื่อน ๆ …'),fix=bubble('…กับภรรยาสุดสวยคนเดียวครับ!! 😅','sm');
 follow(k,e,30,-SH*.5);follow(w,e,-80,-SH-110);follow(fix,e,-200,-SH-110);sh.style.backgroundImage=`url(${url('jit','standAngry')})`;
 tl.to(riv,{opacity:1,duration:.5},0).to(k,{opacity:1,duration:.3},0).call(()=>cyc(e,'walkA','walkB',.26),null,0).to(e,{x:W*.42,duration:2,ease:'power1.out'},0).call(()=>{stopCyc();show(e,'stand')},null,2);
 tl.call(()=>{follows=follows.filter(f=>f[0]!==k)},null,2.2).to(k,{x:W*.42+40,y:FLOOR-64,duration:.5},2.2).to(k,{x:'+=800',duration:6,ease:'none'},2.8);
 tl.call(()=>show(e,'wave'),null,2.8);pop(w,3.0);
 tl.fromTo(sh,{x:W+100,y:FLOOR-1960+40,opacity:0},{x:W*.42-120,opacity:.55,duration:1.2,ease:'power2.out'},4.4);
 tl.call(()=>show(e,'stand-shock'),null,5.4);drop(e,5.5);hide(w,5.6);tl.to(e,{x:'+=6',duration:.05,yoyo:true,repeat:12},5.6);
 pop(fix,6.3);tl.to(sh,{opacity:0,x:'+=300',duration:.8},7.6);hearts(e,7.8,6);tl.call(()=>show(e,'wave'),null,7.8);
 hide(fix,9.0);tl.to([e,riv,k],{opacity:0,duration:.5},9.4);},
// ---------- FN1 ปีใหม่ ของขวัญกล่องใหญ่ ----------
()=>{const a=sprite(R[0],'walkA',-150),b=sprite(R[1],'stand',W*.56),c=R[2]?sprite(R[2],'stand',W*.68):null,gift=el('emo','🎁'),card=el('ucard','‼ งานด่วน 2 ม.ค.'),
  s1=bubble(`สวัสดีปีใหม่~ ของขวัญ 🎁`,'sm'),s2=bubble(`ว้าว!! ขอบคุณ${E(R[1])} 😍`,'sm'),s3=bubble(`ปีใหม่ก็ยังมีงาน… 😭`,'sm');
 gift.style.fontSize='120px';gsap.set([b,c].filter(Boolean),{scaleX:-1,opacity:0});follow(gift,a,20,-SH*.62);follow(s1,a,-60,-SH-100);follow(s2,b,-80,-SH-100);follow(s3,b,-120,-SH-100);
 tl.to([b,c].filter(Boolean),{opacity:1,duration:.4},0).to(gift,{opacity:1,duration:.3},0).call(()=>cyc(a,'walkA','walkB',.26),null,0).to(a,{x:W*.42,duration:2,ease:'power1.out'},0).call(()=>{stopCyc();show(a,'wave')},null,2);
 pop(s1,2.1);tl.call(()=>{follows=follows.filter(f=>f[0]!==gift)},null,3.2).to(gift,{x:W*.49,y:FLOOR-SH*.62,duration:.5,ease:'power1.inOut'},3.2);hide(s1,3.3);
 tl.call(()=>show(b,'up'),null,3.6);pop(s2,3.6);tl.to(gift,{rotation:8,duration:.08,yoyo:true,repeat:9},4.4);hide(s2,4.9);
 tl.to(gift,{scale:1.4,opacity:0,duration:.25},5.2);confetti(5.2,36,W*.5,FLOOR-SH*.6);flash(5.2,'#ffd36b');
 gsap.set(card,{x:W*.5-220,y:FLOOR-SH-120});tl.fromTo(card,{opacity:0,scale:.3},{opacity:1,scale:1,duration:.35,ease:'back.out(2.5)'},5.3);
 tl.call(()=>show(b,'stand-cry'),null,5.9);tears(b,6.0,2.4);pop(s3,6.2);hide(card,6.6);
 if(c){tl.call(()=>show(c,'up-shout'),null,6.4);tl.to(c,{rotation:-70,duration:.3},6.8).to(c,{x:'+=8',duration:.06,yoyo:true,repeat:14},7.1);hearts(c,6.8,5,'🤣')}
 tl.call(()=>show(a,'stand-shock'),null,6.4);hide(s3,8.4);tl.to([a,b,c].filter(Boolean),{opacity:0,duration:.5},8.8);},
// ---------- FN2 นับถอยหลัง พลุ ทั้งทีม (ปีใหม่ / ตรุษจีน) ----------
()=>{const n=R.length,step=Math.min(W*.108,W*.86/Math.max(n,1)),X=i=>W*.5+(i-(n-1)/2)*step;const ss=R.map((w,i)=>sprite(w,'stand',X(i)));gsap.set(ss,{opacity:0});
 tl.to(ss,{opacity:1,duration:.3,stagger:.06},0);
 ['3','2','1'].forEach((d,i)=>sfx(d,W*.5-40,FLOOR-SH-330,.8+i*.8,0,170));
 const C=['#ffd36b','#ff5d8a','#7fd3ff','#9b7bff','#7fe0a0','#ff9a1f'];
 for(let i=0;i<9;i++)firework(W*(.15+Math.random()*.7),FLOOR-SH-200-Math.random()*220,3.2+i*.32,C[i%C.length]);
 const big=el('sfx',data.greet||'สวัสดีปีใหม่ 🎆');big.style.fontSize='120px';gsap.set(big,{x:W*.5,xPercent:-50,y:Math.max(40,FLOOR-SH-300)});
 tl.fromTo(big,{opacity:0,scale:2.4},{opacity:1,scale:1,duration:.35,ease:'back.out(2)'},3.3).to(big,{opacity:0,duration:.4},7.2);
 tl.call(()=>ss.forEach(s=>show(s,'up-shout')),null,3.3).to(ss,{y:FLOOR-70,duration:.22,yoyo:true,repeat:7,stagger:.05,ease:'power2.out'},3.4);
 confetti(4.2,50,W*.5,FLOOR-SH-120);tl.call(()=>ss.forEach(s=>show(s,'wave')),null,6.0).to(ss,{opacity:0,duration:.5,stagger:.04},7.6);},
// ---------- FS1 สงกรานต์ ปืนฉีดน้ำ vs ถังน้ำ ----------
()=>{const a=sprite(R[0],'walkA',-150),b=sprite(R[1],'stand',W*.62),gun=el('emo','🔫'),bucket=el('emo','🪣'),hi=bubble('สุขสันต์วันสงกรานต์ 💦','sm'),rev=bubble(`เอาคืนบ้าง!! 😤`,'sm');
 gun.style.fontSize='64px';bucket.style.fontSize='84px';gsap.set(b,{scaleX:-1,opacity:0});follow(gun,a,40,-SH*.55);follow(bucket,b,-90,-SH*.62);follow(hi,a,-60,-SH-100);follow(rev,b,-80,-SH-100);
 tl.to(b,{opacity:1,duration:.4},0).to(gun,{opacity:1,duration:.2},0).call(()=>cyc(a,'walkA','walkB',.26),null,0).to(a,{x:W*.40,duration:1.8,ease:'power1.out'},0).call(()=>{stopCyc();show(a,'up-shout')},null,1.8);pop(hi,1.9);
 tl.call(()=>{for(let i=0;i<22;i++){const d=el('emo','💧');d.style.fontSize='34px';gsap.fromTo(d,{x:W*.40+90,y:FLOOR-SH*.6,opacity:1},{x:W*.62-40+Math.random()*30,y:FLOOR-SH*.6+(Math.random()-.5)*80,opacity:.2,duration:.35,delay:i*.07,ease:'none',onComplete:()=>d.remove()})}},null,2.3);
 tl.call(()=>show(b,'stand-shock'),null,2.6);drop(b,2.7,40);hide(hi,3.6);
 tl.call(()=>show(b,'up-shout'),null,4.0);tl.to(bucket,{opacity:1,duration:.2},4.0);pop(rev,4.1);
 tl.to(b,{x:W*.48,duration:.5,ease:'power2.out'},4.6).to(bucket,{rotation:-120,duration:.25},5.1);
 const wave=el('splash');gsap.set(wave,{x:W*.40-130,y:FLOOR-SH-40});tl.fromTo(wave,{opacity:0,scaleY:.2,transformOrigin:'50% 0%'},{opacity:.45,scaleY:1,duration:.2},5.2).to(wave,{opacity:0,y:'+=120',duration:.4},5.4);
 sfx('ซ่าาา!!',W*.30,FLOOR-SH-300,5.2,-8,120);tl.call(()=>show(a,'stand-cry'),null,5.3);hide(rev,5.4);
 tl.call(()=>{show(a,'wave');show(b,'wave')},null,6.6);hearts(a,6.7,5,'💦');hearts(b,6.8,5,'😂');tl.to([gun,bucket],{opacity:0,duration:.3},7.6).to([a,b],{opacity:0,duration:.5},8.2);},
// ---------- T1 พักเที่ยง แห่กันวิ่ง ----------
()=>{const sign=el('sfx','🍜 พักเที่ยง!!');sign.style.fontSize='120px';gsap.set(sign,{x:W*.5,xPercent:-50,y:Math.max(40,FLOOR-SH-280)});
 tl.fromTo(sign,{opacity:0,scale:2.4},{opacity:1,scale:1,duration:.3,ease:'back.out(2)'},0).to(sign,{rotation:3,duration:.08,yoyo:true,repeat:11},.3).to(sign,{opacity:0,duration:.3},1.6);
 R.forEach((id,i)=>{const s=sprite(id,'runA-shout',-150-i*235);tl.call(()=>cyc(s,'runA-shout','runB-shout',.08),null,1.0+i*.18).to(s,{x:W+260+i*10,duration:2.2,ease:'power1.in'},1.0+i*.18).to(s,{y:FLOOR-12,duration:.08,yoyo:true,repeat:26},1.0+i*.18);if(i%2===0)dustPuff(s,1.2+i*.18,1.8)});
 sfx('ตึก ตึก ตึก!',W*.3,FLOOR-SH-260,1.8,-6,110);
 const last=sprite(R[R.length-1],'walkA',-150);gsap.set(last,{opacity:0});const wait=bubble(`รอด้วย${E(R[R.length-1])}~ 😩`,'sm');follow(wait,last,-60,-SH-100);
 tl.set(last,{opacity:1},4.0).call(()=>cyc(last,'walkA','walkB',.36),null,4.0).to(last,{x:W*.45,duration:2.4,ease:'none'},4.0);pop(wait,4.6);tl.call(()=>cyc(last,'runA-cry','runB-cry',.08),null,6.4).to(last,{x:W+220,duration:1.1,ease:'power2.in'},6.5);hide(wait,6.6);},
// ---------- T2 เช้า สายแล้ว! ขนมปังคาปาก ----------
()=>{const k=sprite(R[0],'runA-shock',-150),toast=el('emo','🍞'),clk=el('emo','🕗');follow(toast,k,26,-SH*.78);toast.style.fontSize='54px';clk.style.fontSize='110px';
 const ok=bubble(`ทันนน!! 😮‍💨`,'sm');follow(ok,k,-60,-SH-100);
 tl.to(toast,{opacity:1,duration:.2},0).call(()=>cyc(k,'runA-shock','runB-shock',.08),null,0).to(k,{x:W*.42,duration:1.4,ease:'none'},0);dustPuff(k,0,1.4);sfx('สายแล้ว!!',W*.12,FLOOR-SH-300,.3,-8,120);
 tl.to(k,{rotation:-100,y:FLOOR-20,duration:.18,ease:'power3.in'},1.4).to(k,{rotation:-180,y:FLOOR-SH,duration:.2},1.6).to(k,{x:'+=6',duration:.05,yoyo:true,repeat:7},1.8);
 tl.call(()=>{follows=follows.filter(f=>f[0]!==toast)},null,1.5).to(toast,{y:'-=220',x:'+=140',rotation:360,duration:.6,ease:'power2.out'},1.5).to(toast,{y:FLOOR-SH-40,x:W*.42+10,duration:.5,ease:'bounce.out'},2.1);
 tl.to(k,{rotation:0,y:FLOOR,duration:.35,ease:'back.out(2)'},2.4).call(()=>show(k,'stand-shock'),null,2.4);drop(k,2.7);
 gsap.set(clk,{x:W*.55,y:FLOOR-SH-120});tl.fromTo(clk,{opacity:0,scale:.3},{opacity:1,scale:1,duration:.3,ease:'back.out(3)'},2.9).to(clk,{rotation:15,duration:.1,yoyo:true,repeat:7},3.2);
 tl.call(()=>{follow(toast,k,26,-SH*.78);show(k,'up')},null,3.6);pop(ok,3.7);hide([ok,clk],5.0);tl.call(()=>cyc(k,'runA','runB',.08),null,5.2).to(k,{x:W+220,duration:1,ease:'power2.in'},5.2).to(toast,{opacity:0,duration:.2},6.0);},
// ---------- T3 ศุกร์แล้ว เต้น ----------
()=>{const a=sprite(R[0],'stand',W*.40),b=sprite(R[1],'stand',W*.58),say=bubble('ศุกร์แล้ววว~ 🎉','sm');gsap.set([a,b],{opacity:0});gsap.set(b,{scaleX:-1});follow(say,a,-60,-SH-110);
 tl.to([a,b],{opacity:1,duration:.4},0);pop(say,.5);
 for(let i=0;i<10;i++){const t=.8+i*.45,p=i%2?'up':'wave';tl.call(()=>{show(a,p);show(b,i%2?'wave':'up')},null,t).to([a,b],{y:FLOOR-50,duration:.2,yoyo:true,repeat:1,ease:'power2.out'},t).to(a,{rotation:i%2?8:-8,duration:.2},t).to(b,{rotation:i%2?-8:8,duration:.2},t)}
 tl.call(()=>{for(let i=0;i<14;i++){const n=el('emo',i%2?'🎵':'🎶');gsap.fromTo(n,{x:W*.4+Math.random()*W*.2,y:FLOOR-SH-140,opacity:1},{y:FLOOR-SH-360,x:`+=${(Math.random()-.5)*200}`,opacity:0,duration:1.6,delay:i*.3,onComplete:()=>n.remove()})}},null,.8);
 hide(say,3.0);tl.to([a,b],{rotation:0,duration:.2},5.4).to([a,b],{opacity:0,duration:.5},5.8);},
// ---------- W1 งานใหม่! (จากงานจริงที่เพิ่งลงระบบ) ----------
()=>{const n=R.length,ss=R.map((id,i)=>sprite(id,'runA-shock',-150-i*235)),card=el('ucard',`📌 งานใหม่!<br><small>${esc(data.title||'')}</small>`),ok=bubble(`รับทราบ${E(R[0])}!! 🫡`,'sm');
 card.style.whiteSpace='normal';follow(ok,ss[0],-60,-SH-100);
 gsap.set(card,{x:W*.5-220,y:-260});tl.to(card,{opacity:1,y:FLOOR-SH-330,duration:.35,ease:'power4.in'},.2);impact(.55);shake(.55,8,14);sfx('ตึง!',W*.5+230,FLOOR-SH-320,.55,10,120);
 ss.forEach((s,i)=>{tl.call(()=>cyc(s,'runA-shock','runB-shock',.08),null,1.0+i*.15).to(s,{x:W*(.34+i*.125),duration:1.1,ease:'power2.out'},1.0+i*.15)});
 tl.call(()=>{stopCyc();ss.forEach(s=>show(s,'up-shout'))},null,2.5);pop(ok,2.6);ss.forEach(s=>drop(s,2.7,40));tl.to(ss,{y:FLOOR-60,duration:.2,yoyo:true,repeat:3,stagger:.06},2.6);
 hide([ok],4.6);tl.to(card,{opacity:0,y:'-=60',duration:.4},4.6).call(()=>ss.forEach(s=>cyc(s,'runA','runB',.08)),null,4.8).to(ss,{x:W+260,duration:1.2,ease:'power2.in',stagger:.08},4.8);},
// ---------- W2 รับทราบครบทีม ----------
()=>{const ss=R.map((id,i)=>sprite(id,'runA',-200-i*160)),sp=el('focus',SPEED),badge=bubble(`✅ รับทราบครบทีม! · ${esc(data.title||'')}`);
 tl.to(sp,{opacity:1,duration:.1},.2).to(sp,{x:-300,duration:.25,repeat:7,ease:'none'},.2);
 ss.forEach((s,i)=>{tl.call(()=>cyc(s,'runA','runB',.06),null,.2+i*.12).to(s,{x:W*(.42+i*.08),duration:.5,ease:'power3.out'},.2+i*.12)});
 tl.call(()=>{stopCyc();ss.forEach(s=>show(s,'wave'))},null,1.2);gsap.set(badge,{x:W*.5,xPercent:-50,y:FLOOR-SH-130});pop(badge,1.2);ss.forEach(s=>hearts(s,1.3,5,'⚡'));
 tl.to(sp,{opacity:0,duration:.3},2.2);hide(badge,4.2);tl.to(ss,{opacity:0,duration:.5},4.6);},
// ---------- W3 วันนี้เคลียร์ครบ ----------
()=>{const n=R.length,step=Math.min(W*.108,W*.86/Math.max(n,1)),X=i=>W*.5+(i-(n-1)/2)*step;const ss=R.map((w,i)=>sprite(w,'stand',X(i)));gsap.set(ss,{opacity:0});
 const big=el('sfx',`🎉 วันนี้เคลียร์ครบ ${data.count||''} งาน!`);big.style.fontSize='96px';gsap.set(big,{x:W*.5,xPercent:-50,y:Math.max(40,FLOOR-SH-280)});
 tl.to(ss,{opacity:1,duration:.3,stagger:.06},0).fromTo(big,{opacity:0,scale:2.2},{opacity:1,scale:1,duration:.35,ease:'back.out(2)'},.8).to(big,{opacity:0,duration:.4},4.6);
 tl.call(()=>ss.forEach(s=>show(s,'up')),null,.9).to(ss,{y:FLOOR-70,duration:.22,yoyo:true,repeat:5,stagger:.05,ease:'power2.out'},1.0);confetti(1.0,50,W*.5,FLOOR-SH-100);
 tl.call(()=>ss.forEach(s=>show(s,'wave')),null,3.4).to(ss,{opacity:0,duration:.5,stagger:.04},5.2);},
// ---------- S ละครตอนต่อ "ปิ่นโตหายไปไหน?" (จ.–ศ. วันละตอน) ----------
()=>{const ep=data.ep||1,EP=['','ปิ่นโตหาย!','รอยเท้าปริศนา','ผู้ต้องสงสัย','ไล่ล่าตัวจริง','ความจริงเปิดเผย'];
 const head=title(`📺 ปิ่นโตหายไปไหน? · ตอนที่ ${ep} ${EP[ep]}`,0,1.8);const [eid,did,sid]=R;
 let k=2.0;const end=(txt)=>{const c=title(txt,k,2.2);k+=2.6};
 if(ep===1){const e=sprite(eid,'walkA',-150),tf=el('tif2'),go=bubble('ไปล้างมือก่อนนะ~ 🎵','sm'),cry=bubble('ปิ่นโตผมหายยย!! 😱');tf.style.backgroundImage=`url(/cast/jit/tiffin.webp)`;follow(tf,e,30,-SH*.45);follow(go,e,-60,-SH-100);follow(cry,e,-80,-SH-110);
  tl.to(tf,{opacity:1,duration:.2},k).call(()=>cyc(e,'walkA','walkB',.26),null,k).to(e,{x:W*.40,duration:1.6,ease:'power1.out'},k).call(()=>{stopCyc();show(e,'wave');follows=follows.filter(f=>f[0]!==tf)},null,k+1.6);
  tl.to(tf,{x:W*.40+60,y:FLOOR-70,duration:.3},k+1.7);pop(go,k+1.8);hide(go,k+3);tl.to(e,{scaleX:-1,duration:.01},k+3).call(()=>cyc(e,'walkA','walkB',.26),null,k+3).to(e,{x:-200,duration:1.4,ease:'none'},k+3);
  const puff=el('dust');puff.innerHTML='<svg viewBox="0 0 520 300">'+Array.from({length:8},()=>`<circle cx="${160+Math.random()*200}" cy="${120+Math.random()*80}" r="${30+Math.random()*30}" fill="#efe6f7" stroke="#1b1024" stroke-width="5"/>`).join('')+'</svg>';
  gsap.set(puff,{x:W*.40-200,y:FLOOR-260,scale:.6});tl.to(puff,{opacity:1,duration:.1},k+4.8).to(tf,{opacity:0,duration:.05},k+4.9).to(puff,{opacity:0,scale:1,duration:.5},k+5.2);sfx('ฟึ่บ!',W*.40,FLOOR-SH-280,k+4.8,-8,110);
  tl.set(e,{scaleX:1},k+6).call(()=>cyc(e,'walkA','walkB',.26),null,k+6).to(e,{x:W*.40,duration:1.4,ease:'none'},k+6).call(()=>{stopCyc();show(e,'stand-shock')},null,k+7.4);
  focusLines(k+7.4,1.4);soul(e,k+7.6);pop(cry,k+7.5);hide(cry,k+9.6);k+=10;end('⏩ ติดตามตอนต่อไป พรุ่งนี้!');}
 if(ep===2){const d=sprite(did,'walkA',-150),e=sprite(eid,'stand-cry',W*.2),mg=el('emo','🔍'),say=bubble('รอยเท้าปริศนา… 🤔','sm'),go=bubble('ไปทางนั้น!!','sm'),help=bubble(`ช่วยด้วยครับ… 😢`,'sm');
  mg.style.fontSize='70px';follow(mg,d,40,-SH*.6);follow(say,d,-60,-SH-100);follow(go,d,-60,-SH-100);follow(help,e,-60,-SH-100);gsap.set(e,{opacity:0});
  tl.to(e,{opacity:1,duration:.3},k);pop(help,k+.2);hide(help,k+1.8);tl.to(mg,{opacity:1,duration:.2},k+.8).call(()=>cyc(d,'walkA','walkB',.3),null,k+.8).to(d,{x:W*.38,duration:1.6,ease:'none'},k+.8).call(()=>{stopCyc();show(d,'stand')},null,k+2.4);
  for(let i=0;i<6;i++){const f=el('emo','🐾');f.style.fontSize='44px';gsap.set(f,{x:W*(.45+i*.07),y:FLOOR-50,rotation:90});tl.to(f,{opacity:1,duration:.15},k+2.6+i*.2).to(f,{opacity:0,duration:.4},k+7.4)}
  tl.to(d,{rotation:18,duration:.3},k+2.8).to(mg,{scale:1.6,duration:.3,yoyo:true,repeat:3},k+2.8);pop(say,k+3.0);hide(say,k+4.6);tl.to(d,{rotation:0,duration:.2},k+4.6).call(()=>show(d,'up-shout'),null,k+4.8);pop(go,k+4.8);
  hide(go,k+6);tl.call(()=>cyc(d,'runA','runB',.08),null,k+6.1).to(d,{x:W+220,duration:1.2,ease:'power2.in'},k+6.1);dustPuff(d,k+6.1,1);tl.to(e,{opacity:0,duration:.4},k+7);k+=8;end('⏩ ใครคือเจ้าของรอยเท้า? พรุ่งนี้!');}
 if(ep===3){const s=sprite(sid,'stand',W*.62),d=sprite(did,'walkA',-150),rice=el('emo','🍚'),mg=el('emo','🔍'),got=bubble('เจอแล้ว!!','sm'),no=bubble(`ไม่ใช่${E(sid)}นะ!! 😰`,'sm'),hm=bubble('แต่… ทำไมมีข้าวติดปาก? 🧐');
  rice.style.fontSize='40px';mg.style.fontSize='70px';gsap.set(s,{scaleX:-1,opacity:0});follow(rice,s,44,-SH*.62);follow(mg,d,40,-SH*.6);follow(got,d,-60,-SH-100);follow(no,s,-80,-SH-100);follow(hm,d,-120,-SH-110);
  tl.to([s,rice,mg],{opacity:1,duration:.3},k).call(()=>cyc(d,'walkA','walkB',.26),null,k).to(d,{x:W*.44,duration:1.6,ease:'power1.out'},k).call(()=>{stopCyc();show(d,'up-shout')},null,k+1.6);
  focusLines(k+1.7,1.4);pop(got,k+1.7);tl.call(()=>show(s,'stand-shock'),null,k+1.8);drop(s,k+2);hide(got,k+3);pop(no,k+3.1);tl.to(s,{x:'+=6',duration:.05,yoyo:true,repeat:12},k+3.1);
  hide(no,k+4.6);tl.call(()=>show(d,'stand'),null,k+4.6);pop(hm,k+4.8);tl.to(rice,{scale:1.5,duration:.4,ease:'back.out(2)'},k+5.2);sfx('!!!',W*.62,FLOOR-SH-300,k+5.4,0,120);hide(hm,k+7.2);k+=7.6;end('⏩ ตอนหน้า: ไล่ล่าตัวจริง!');}
 if(ep===4){const s=sprite(sid,'stand',W*.56),d=sprite(did,'stand',W*.44),e=sprite(eid,'walkA',-400),cat=el('emo','🐈'),tf=el('tif2'),ex=bubble(`ข้าวมันไก่ของ${E(sid)}เองนะ! 🍗`,'sm'),meow=bubble('เมี้ยว~ 😼','sm');
  cat.style.fontSize='96px';tf.style.backgroundImage=`url(/cast/jit/tiffin.webp)`;gsap.set(s,{scaleX:-1});gsap.set([s,d],{opacity:0});follow(ex,s,-80,-SH-100);follow(tf,cat,40,-10);follow(meow,cat,-40,-170);
  tl.to([s,d],{opacity:1,duration:.3},k);pop(ex,k+.3);hide(ex,k+2);
  gsap.set(cat,{x:W+80,y:FLOOR-110,scaleX:-1});tl.to([cat,tf],{opacity:1,duration:.1},k+2.2).to(cat,{x:W*.66,duration:.8,ease:'power2.out'},k+2.2);pop(meow,k+2.6);
  tl.call(()=>{show(d,'stand-shock');show(s,'stand-shock')},null,k+2.8);sfx('ตัวจริง!!',W*.36,FLOOR-SH-300,k+3,-8,120);hide(meow,k+3.8);
  tl.to(cat,{x:-160,duration:2.2,ease:'power1.in'},k+3.9).to(cat,{y:FLOOR-150,duration:.15,yoyo:true,repeat:13},k+3.9);
  tl.to([d,s],{scaleX:-1,duration:.01},k+4.0).set(s,{scaleX:-1},k+4.0).call(()=>{cyc(d,'runA-shout','runB-shout',.08);cyc(s,'runA-shout','runB-shout',.08);cyc(e,'runA-cry','runB-cry',.08);gsap.set(e,{scaleX:-1,x:W+150})},null,k+4.1)
   .to([d,s],{x:-260,duration:1.8,ease:'power1.in'},k+4.2).to(e,{x:-300,duration:2.6,ease:'none'},k+4.4);dustPuff(d,k+4.2,1.6);k+=7.2;end('⏩ ตอนจบ: ความจริงเปิดเผย · พรุ่งนี้!');}
 if(ep===5){const cat=el('emo','🐈'),tf=el('tif2'),j=sprite('jit','walkA',W+150),e=sprite(eid,'stand',W*.30),d=sprite(did,'stand',W*.20),s=sprite(sid,'stand',W*.10),sorry=bubble('น้องเหมียวของป้าเองค่ะ ขอโทษนะคะ 🙏','sm'),more=bubble('ทำมาเผื่อทุกคนเลยค่ะ 🍱','sm'),yay=bubble('เย้!! ป้าจิตรน่ารักที่สุด 😍','sm');
  cat.style.fontSize='96px';tf.style.backgroundImage=`url(/cast/jit/tiffin.webp)`;gsap.set(cat,{x:W*.5,y:FLOOR-110});gsap.set(tf,{x:W*.5+60,y:FLOOR-80});gsap.set([e,d,s],{opacity:0});gsap.set(j,{scaleX:-1});follow(sorry,j,-300,-SH-110);follow(more,j,-260,-SH-110);follow(yay,e,-60,-SH-100);
  tl.to([cat,tf,e,d,s],{opacity:1,duration:.3},k).call(()=>cyc(j,'walkA','walkB',.26),null,k).to(j,{x:W*.62,duration:1.6,ease:'power1.out'},k).call(()=>{stopCyc();show(j,'standE')},null,k+1.6);
  pop(sorry,k+1.7);tl.to(cat,{x:W*.6,y:FLOOR-SH*.55,duration:.5,ease:'power1.inOut'},k+2.4);hide(sorry,k+3.6);
  tl.call(()=>{show(j,'trayA');cyc(j,'trayA','trayB',.3)},null,k+3.8);pop(more,k+3.9);tl.to(j,{x:W*.5,duration:1,ease:'none'},k+3.9).call(()=>{stopCyc();show(j,'trayA')},null,k+4.9);hide(more,k+5.4);
  tl.call(()=>[e,d,s].forEach(x=>show(x,'up')),null,k+5.4).to([e,d,s],{y:FLOOR-60,duration:.2,yoyo:true,repeat:3,stagger:.06},k+5.4);pop(yay,k+5.5);[e,d,s].forEach(x=>hearts(x,k+5.6,5));confetti(k+5.6,30,W*.4,FLOOR-SH);hide(yay,k+7.6);
  tl.to([cat,tf,j,e,d,s],{opacity:0,duration:.5},k+8);k+=8.5;end('🎬 จบบริบูรณ์ · สัปดาห์หน้าเรื่องใหม่!');}
 },

// ---------- K1 แอ็กชั่น! / คัต! (ผู้กำกับคุมกอง ทุกคนเก๊ก แล้วทรุดพัก — ผู้กำกับชม) ----------
()=>{const dir=sprite(R[0],'walkA',W+150),act=R.slice(1).map((id,i)=>sprite(id,'walkA',-150-i*200)),xs=[W*.22,W*.37,W*.52],POSE=['up','wave','stand-shout'],clap=emo('🎬',90);
 walk(dir,W*.80,0,1.8,'stand');act.forEach((a,i)=>walk(a,xs[i],.1+i*.15,1.9,'stand'));
 title('🎬 กองถ่าย ปชส. · เทคที่ 1',.4,1.8);
 tl.call(()=>{gsap.set(clap,{x:W*.80-150,y:FLOOR-SH*.75})},null,2.3).fromTo(clap,{opacity:0,scale:.3,rotation:-30},{opacity:1,scale:1,rotation:0,duration:.25,ease:'back.out(3)'},2.3).to(clap,{rotation:-18,duration:.08,yoyo:true,repeat:3},2.6);
 tl.call(()=>show(dir,'up'),null,2.5);say(dir,'แอ็กชั่น!! 🎬',2.6,1.7,'',-170,-SH-130);flash(2.7);
 act.forEach((a,i)=>{tl.call(()=>show(a,POSE[i%3]),null,2.8+i*.12).fromTo(a,{scale:1},{scale:1.12,duration:.2,yoyo:true,repeat:1},2.8+i*.12);const sp=emo('✨',70);follow(sp,a,40,-SH-30);tl.to(sp,{opacity:1,scale:1.3,duration:.25,yoyo:true,repeat:5},2.9+i*.12).to(sp,{opacity:0,duration:.2},4.5)});
 hide(clap,4.3);tl.call(()=>show(dir,'wave'),null,4.6);say(dir,'คัต!',4.7,1.2,'',-90,-SH-130);
 act.forEach((a,i)=>{sit(a,5.0+i*.1);const d=drop(a,5.2+i*.1,70,-SH*.6);hide(d,6.6)});
 say(act[1]||act[0],'เฮ้อ~ เก๊กจนเมื่อย 😮‍💨',5.4,1.3);
 tl.call(()=>show(dir,'up'),null,6.9);say(dir,'ดีมากค่ะ 👏 ผ่าน!',7.0,2.0,'',-190,-SH-130);confetti(7.1,36,W*.45,FLOOR-SH);
 act.forEach((a,i)=>{rise(a,7.3+i*.08,'up');hop(a,7.3+i*.08,2)});say(act[0],'เย้!! 🎉',7.5,1.5);
 tl.to([dir,...act],{opacity:0,duration:.5},9.4);},
// ---------- K2 เที่ยงตรง (11:59 ตั้งใจทำงาน → 12:00 หายเกลี้ยง) ----------
()=>{const xs=R.map((_,i)=>W*(.18+i*.15)),ps=R.map((id,i)=>sprite(id,'sit',xs[i])),clock=el('card','<div style="font-size:70px;line-height:1">🕛</div><b class="k2t">11:59</b>'),sign=el('sign','🍜 พักเที่ยง · เดี๋ยวมา'),bag=emo('👛',70);
 gsap.set(ps,{opacity:0,y:FLOOR+SIT});gsap.set(clock,{x:W*.5-95,y:Math.max(30,FLOOR-SH-260),opacity:0});
 tl.to(ps,{opacity:1,duration:.4,stagger:.08},0).to(clock,{opacity:1,duration:.3},.2);
 ps.forEach((p,i)=>{const k=emo('💻',52);follow(k,p,46,-SH*.42);tl.to(k,{opacity:1,duration:.2},.5).to(k,{y:'-=6',duration:.12,yoyo:true,repeat:13},.6+i*.07).to(k,{opacity:0,duration:.15},2.9)});
 sfx('ต๊อก ต๊อก ต๊อก',W*.16,FLOOR-SH-210,.8,-4,80);say(ps[1],'ตั้งใจทำงานสุด ๆ 💪',1.0,1.5);
 tl.to(clock,{scale:1.08,duration:.12,yoyo:true,repeat:5},2.3).call(()=>{clock.querySelector('.k2t').textContent='12:00'},null,3.0);sfx('ติ๊ง!',W*.5+120,FLOOR-SH-300,3.0,8,130);flash(3.0,'#ffd36b');
 ps.forEach((p,i)=>{rise(p,3.05,'stand-shock');tl.to(p,{y:FLOOR-40,duration:.12,yoyo:true,repeat:1},3.06);run(p,W+260+i*40,3.4+(ps.length-1-i)*.1,1.5,null,'runA-shout','runB-shout');if(i%2===0)dustPuff(p,3.5,1.3)});
 sfx('ฟิ้ววว!',W*.55,FLOOR-SH-120,3.6,-6,120);
 tl.call(()=>gsap.set(sign,{x:W*.30,y:FLOOR-150}),null,5.0).fromTo(sign,{opacity:0,y:FLOOR-420},{opacity:1,y:FLOOR-150,duration:.5,ease:'bounce.out'},5.0);
 tl.call(()=>gsap.set(bag,{x:xs[0]-20,y:FLOOR-70,opacity:1}),null,5.2);
 const back=sprite(R[0],'runA-shock',W+200);gsap.set(back,{opacity:0});
 tl.set(back,{opacity:1},5.9);run(back,xs[0]+70,5.9,1.1,'stand-shock','runA-shock','runB-shock');say(back,`ลืมกระเป๋าตังค์${E(R[0])}! 😱`,7.0,1.3);
 tl.to(bag,{x:xs[0]+40,y:FLOOR-SH*.5,duration:.25},7.3).call(()=>follow(bag,back,-30,-SH*.5),null,7.6);run(back,W+260,8.3,1.1,null,'runA-shout','runB-shout');
 tl.to([clock,sign],{opacity:0,duration:.4},9.4);},
// ---------- K3 ถ่ายรูปหมู่ (มีคนหลับตาทุกรอบ → ครบแล้ว แต่ลืมเปิดฝาเลนส์) ----------
()=>{const ph=sprite(R[0],'walkA',W+150),sub=R.slice(1).map((id,i)=>sprite(id,'walkA',-150-i*190)),xs=[W*.20,W*.33,W*.46],cam=emo('📷',80);
 sub.forEach((s,i)=>walk(s,xs[i],0+i*.12,1.6,'wave'));walk(ph,W*.74,0,1.6,'stand');follow(cam,ph,-95,-SH*.62);tl.to(cam,{opacity:1,duration:.2},1.6);
 const shot=(t,blink)=>{say(ph,'1… 2… 3!',t,.9,'sm',-150,-SH-100);tl.call(()=>show(ph,'up'),null,t+.7);flash(t+.9);sfx('แชะ!',W*.60,FLOOR-SH-200,t+.9,-8,110);tl.call(()=>show(ph,'stand'),null,t+1.3);
  if(blink>=0){const z=emo('😑',80);follow(z,sub[blink],-40,-SH-70);tl.fromTo(z,{opacity:0,scale:.3},{opacity:1,scale:1.2,duration:.2,ease:'back.out(3)'},t+.85).to(z,{opacity:0,duration:.2},t+2.2);}};
 shot(1.9,1);say(ph,'มีคนหลับตา~ เอาใหม่!',3.1,1.2,'sm',-250,-SH-100);
 shot(4.5,Math.min(2,sub.length-1));say(ph,'อีกแล้ว!! 😩 เอาใหม่!',5.7,1.2,'sm',-250,-SH-100);
 sub.forEach((s,i)=>{tl.call(()=>show(s,'up'),null,7.0+i*.05);const sp=emo('✨',64);follow(sp,s,30,-SH-30);tl.to(sp,{opacity:1,duration:.2},7.9).to(sp,{opacity:0,duration:.2},8.9)});
 say(ph,'1… 2… 3!',7.1,.9,'sm',-150,-SH-100);tl.call(()=>show(ph,'up'),null,7.8);sfx('…',W*.60,FLOOR-SH-200,8.0,0,110);
 say(sub[0],'รอบนี้ลืมตาครบ! 😁',8.0,1.3);
 const cap=emo('⚫',60);follow(cap,ph,-112,-SH*.60);tl.to(cap,{opacity:1,scale:1.4,duration:.2,yoyo:true,repeat:3},9.2).call(()=>show(ph,'stand-shock'),null,9.2);drop(ph,9.3);
 say(ph,'…ลืมเปิดฝาเลนส์ 😱',9.4,2.0,'sm',-250,-SH-100);
 sub.forEach((s,i)=>sit(s,10.0+i*.1));say(sub[1]||sub[0],'โธ่~ 🤣',10.2,1.4);
 tl.to([ph,cam,cap,...sub],{opacity:0,duration:.5},11.8);},
// ---------- K4 ไฟล์ final จริง ๆ (วิ่งหาทั่ว — อยู่ในมือตัวเอง) ----------
()=>{const a=sprite(R[0],'runA-shock',-150),b=sprite(R[1],'stand',W*.50),c=sprite(R[2]||R[1],'stand',W*.80),file=emo('📄',64),q=emo('❓',70);
 if(!R[2])gsap.set(c,{display:'none'});gsap.set([b,c],{opacity:0});tl.to([b,c],{opacity:1,duration:.4},0);follow(file,a,62,-SH*.50);follow(q,a,-20,-SH-60);tl.to(file,{opacity:1,duration:.2},.2);
 run(a,W*.36,.1,1.4,'stand-shock','runA-shock','runB-shock');tl.to(q,{opacity:1,duration:.2},1.5).to(q,{rotation:14,duration:.15,yoyo:true,repeat:7},1.5);
 say(a,'ไฟล์ final_v2_จริง_ล่าสุด.jpg อยู่ไหน!? 😵',1.6,1.9,'sm',-200,-SH-170);
 tl.call(()=>show(b,'wave'),null,3.2);say(b,`ไม่เห็นนะ${E(R[1])} 🤷`,3.5,1.2);
 run(a,W*.68,4.7,.9,'stand-shock','runA-cry','runB-cry');dustPuff(a,4.7,.8);
 say(a,'ใครเห็นบ้างงง 😭',5.6,1.1,'sm',-200,-SH-170);
 tl.call(()=>show(c,'wave'),null,6.5);say(c,'…ลองดูในมือสิ 👉',6.7,1.5,'sm',-230,-SH-100);
 tl.to(q,{opacity:0,duration:.2},7.6).to(file,{scale:2,duration:.25,yoyo:true,repeat:3,ease:'power1.inOut'},7.8);sfx('วิ้ง~',W*.68+110,FLOOR-SH*.8,7.8,6,80);
 tl.call(()=>show(a,'stand-sad'),null,8.2);const d=drop(a,8.2);say(a,'…อยู่ในมือนี่เอง 😅',8.4,2.0,'sm',-200,-SH-170);
 [b,c].forEach((p,i)=>{tl.call(()=>show(p,'up'),null,8.8+i*.1);hop(p,8.8+i*.1,2,30)});say(b,'555+ 🤣',8.9,1.5);
 tl.to([a,b,c,file,d],{opacity:0,duration:.5},10.6);},
// ---------- K5 ประชุมแป๊บเดียว (5 นาที… จนพระจันทร์ขึ้น) ----------
()=>{const xs=R.map((_,i)=>W*(.20+i*.16)),ps=R.map((id,i)=>sprite(id,'stand',xs[i])),sign=el('sign','📋 ประชุม 5 นาที'),clock=emo('🕐',90),sun=emo('☀️',100),moon=emo('🌙',100),night=el('reddim'),top=Math.max(30,FLOOR-SH-300);
 night.style.background='linear-gradient(rgba(10,6,40,.55),rgba(10,6,40,.25))';
 gsap.set(ps,{opacity:0});gsap.set(sign,{x:W*.5-170,y:top+40});gsap.set(clock,{x:W*.5+150,y:top+20});
 tl.to(ps,{opacity:1,duration:.4,stagger:.08},0);pop(sign,.3);tl.to(clock,{opacity:1,duration:.2},.5);
 say(ps[0],`แป๊บเดียวเอง${E(R[0])} 😄`,.8,1.4);
 tl.to(clock,{rotation:360*6,duration:6.0,ease:'power1.in'},1.4);
 tl.fromTo(sun,{x:W*.15,y:top+120,opacity:0},{opacity:1,duration:.3},1.6).to(sun,{x:W*.85,duration:3.2,ease:'none'},1.6).to(sun,{y:top-10,duration:1.6,ease:'sine.out',yoyo:true,repeat:1},1.6).to(sun,{opacity:0,duration:.3},4.6);
 ps.forEach((p,i)=>{const t=2.6+i*.7;sit(p,t);const z=emo('💤',60);follow(z,p,30,-SH*.75);tl.to(z,{opacity:1,duration:.3},t+1.4).to(z,{y:'-=10',duration:.5,yoyo:true,repeat:5},t+1.4).to(z,{opacity:0,duration:.2},8.6)});
 tl.call(()=>{sign.textContent='📋 อีกแป๊บเดียว…'},null,4.4).fromTo(sign,{scale:1.2},{scale:1,duration:.3},4.4);
 tl.to(night,{opacity:1,duration:.8},4.6).fromTo(moon,{x:W*.2,y:top+120,opacity:0},{opacity:1,duration:.3},4.9).to(moon,{x:W*.6,y:top,duration:2.6,ease:'sine.out'},4.9);
 sfx('ติ๊ก ต๊อก ติ๊ก ต๊อก',W*.12,FLOOR-SH-150,5.4,-4,70);
 tl.call(()=>{sign.textContent='📋 สรุป: นัดประชุมต่อพรุ่งนี้ 😇'},null,7.6).fromTo(sign,{scale:1.25},{scale:1,duration:.3},7.6);
 tl.to(night,{opacity:0,duration:.5},8.6).to(moon,{opacity:0,duration:.4},8.6);
 ps.forEach((p,i)=>rise(p,8.7+i*.06,'stand-shock'));say(ps[ps.length-1],'หา!? 😳',8.8,1.3);
 tl.to([sign,clock,...ps],{opacity:0,duration:.5},10.4);},
// ---------- K6 แบตกล้องหมด (ฮีโร่ยื่นแบตสำรอง) ----------
()=>{const a=sprite(R[0],'runA',-150),h=sprite(R[1],'runA',W+200),cam=emo('📷',80),low=emo('🪫',110),bat=emo('🔋',80);
 follow(cam,a,70,-SH*.62);tl.to(cam,{opacity:1,duration:.2},.2);run(a,W*.42,.1,1.5,'up');dustPuff(a,.2,1.2);
 say(a,'ทันพอดี! ถ่ายละนะ—',1.7,1.1,'sm',-120,-SH-110);
 tl.call(()=>gsap.set(low,{x:W*.42+60,y:FLOOR-SH-190}),null,2.8).fromTo(low,{opacity:0,scale:.3},{opacity:1,scale:1,duration:.25,ease:'back.out(3)'},2.8).to(low,{opacity:.3,duration:.25,yoyo:true,repeat:5},3.1);
 sfx('ปิ๊บ…',W*.42-260,FLOOR-SH-150,2.8,-8,100);tl.call(()=>show(a,'stand-shock'),null,2.9);gloom(a,3.1,2.3);say(a,'แบตหมด… 😨',3.3,1.6,'sm',-120,-SH-110);
 follow(bat,h,-80,-SH*.62);tl.to(bat,{opacity:1,duration:.2},5.0);run(h,W*.62,5.0,1.1,'up');dustPuff(h,5.0,1.0);
 flash(6.1,'#ffe066');sfx('ชิ้ง!!',W*.62-80,FLOOR-SH-260,6.1,6,130);say(h,`แบตสำรองมาแล้ว${E(R[1])}! 🦸`,6.2,1.8,'sm',-260,-SH-110);
 tl.to(low,{opacity:0,duration:.2},6.1).call(()=>{follows=follows.filter(f=>f[0]!==bat)},null,6.9).to(bat,{keyframes:[{x:W*.52,y:FLOOR-SH-120,duration:.35,ease:'power1.out'},{x:W*.42+60,y:FLOOR-SH*.62,duration:.35,ease:'power1.in'}]},6.9);
 tl.call(()=>show(a,'up'),null,7.7);hop(a,7.7,3);say(a,'รอดแล้ว!! 🙏✨',7.8,1.8,'sm',-120,-SH-110);hearts(a,7.9,6,'✨');flash(8.6);sfx('แชะ!',W*.3,FLOOR-SH-200,8.6,-8,110);
 tl.to([a,h,cam,bat],{opacity:0,duration:.5},9.9);},
// ---------- K7 ฝนตก (ทุกคนวิ่งหลบ — นางเงือกดีใจอยู่คนเดียว) ----------
()=>{const nat=sprite(R[0],'stand',W*.50),fr=R.slice(1).map((id,i)=>sprite(id,'stand',W*(i%2?.66+.12*(i>>1):.34-.12*(i>>1)))),clouds=[.25,.5,.75].map(()=>emo('🌧️',130)),top=Math.max(20,FLOOR-SH-300),rainbow=emo('🌈',150);
 gsap.set([nat,...fr],{opacity:0});tl.to([nat,...fr],{opacity:1,duration:.4},0);say(fr[0],'วันนี้อากาศดีจัง ☀️',.5,1.4);
 clouds.forEach((c,i)=>{tl.fromTo(c,{x:-200,y:top,opacity:0},{x:W*(.2+i*.28),opacity:1,duration:1.2,ease:'power2.out'},1.6+i*.15)});
 tl.call(()=>{const iv=setInterval(()=>{for(let k=0;k<5;k++){const d=el('emo','💧');d.style.fontSize='34px';const x=Math.random()*W;gsap.fromTo(d,{x,y:top+110,opacity:.9},{y:FLOOR-10,x:x-60,opacity:.2,duration:.7,ease:'none',onComplete:()=>d.remove()})}},110);ivs.push(iv);tos.push(setTimeout(()=>clearInterval(iv),5200))},null,2.6);
 sfx('ซ่าาา!',W*.12,FLOOR-SH-120,2.7,-5,110);
 fr.forEach((f,i)=>{tl.call(()=>show(f,'stand-shock'),null,2.8);const left=gsap.getProperty(f,'x')<W*.5;run(f,left?-260:W+260,3.2+i*.12,1.3,null,'runA-shout','runB-shout')});say(fr[0],'ฝนตก!! หลบเร็ว 😱',2.9,1.0);
 tl.call(()=>show(nat,'up'),null,4.0);hop(nat,4.0,2,40);say(nat,'น้ำมาแล้ว~ 🧜‍♀️💕',4.2,2.4,'sm',-110,-SH-110);hearts(nat,4.4,7,'💦');
 tl.to(nat,{x:'+=170',duration:.9,ease:'sine.inOut',yoyo:true,repeat:3},4.8).to(nat,{y:FLOOR-26,duration:.3,yoyo:true,repeat:11,ease:'sine.inOut'},4.8).to(nat,{rotation:8,duration:.45,yoyo:true,repeat:7,ease:'sine.inOut'},4.8);
 tl.to(clouds,{opacity:0,x:'+=300',duration:.8},7.9).fromTo(rainbow,{x:W*.5-75,y:top+20,opacity:0,scale:.4},{opacity:1,scale:1,duration:.5,ease:'back.out(2)'},8.2);
 const peek=fr[0]?sprite(R[1],'walkA',-150):null;if(peek){gsap.set(peek,{opacity:0});tl.set(peek,{opacity:1},8.4);walk(peek,W*.22,8.4,1.2,'stand');say(peek,'…มีคนเดียวที่ชอบ 😂',9.0,1.6);}
 tl.to([nat,rainbow,peek].filter(Boolean),{opacity:0,duration:.5},10.9);},
// ---------- K8 ถุงของเข้าบ้าน (ป้าจิตรตัวเปล่า พี่เอิร์ธแบกถุงท่วมหัว) ----------
()=>{const car=el('car is-stop',CAR_SVG),j=sprite('jit','walkA',430),e=sprite(R[0],'walkA',250),bags=[0,1,2,3,4].map(()=>emo('🛍️',78)),spark=emo('✨',80);
 gsap.set(car,{x:-40,y:FLOOR-256,opacity:0});gsap.set([j,e],{opacity:0});
 tl.to(car,{opacity:1,duration:.4},0).to(j,{opacity:1,duration:.3},.5).to(e,{opacity:1,duration:.3},.9);
 bags.forEach((b,i)=>{follow(b,e,-40+(i%2?10:-10),-SH*.55-i*66);tl.to(b,{opacity:1,duration:.15},1.0+i*.12)});
 walk(j,W*.62,.9,3.6,'standE');say(j,'ถือดี ๆ นะคะ 😊',1.4,1.8,'sm',-90,-SH-100);
 tl.call(()=>cyc1(e,'walkA-sad','walkB-sad',.34),null,1.8).to(e,{x:W*.42,duration:3.6,ease:'none'},1.8).to(e,{rotation:3,duration:.34,yoyo:true,repeat:9,ease:'sine.inOut'},1.8);
 const dr=drop(e,2.2,96,-SH*.5);say(e,'มะ…ไม่หนักเลยครับ 😅',3.0,1.8,'sm',40,-SH*.5);
 const topb=bags[4];tl.to(topb,{rotation:18,duration:.2,yoyo:true,repeat:5},4.4).call(()=>{follows=follows.filter(f=>f[0]!==topb);stop1(e,'stand-shock')},null,5.4);
 sfx('หวืด!',W*.47,FLOOR-SH-260,5.4,-8,100);
 tl.to(topb,{keyframes:[{x:W*.52,y:FLOOR-SH-240,rotation:200,duration:.4,ease:'power1.out'},{x:W*.62-110,y:FLOOR-SH*.62,rotation:360,duration:.4,ease:'power1.in'}]},5.4);
 tl.call(()=>{gsap.set(spark,{x:W*.62-150,y:FLOOR-SH*.8})},null,6.2).fromTo(spark,{opacity:0,scale:.4},{opacity:1,scale:1.5,duration:.2,yoyo:true,repeat:1},6.2);sfx('หมับ!',W*.62-60,FLOOR-SH-230,6.2,6,110);
 say(j,'รับได้ค่ะ ✌️',6.4,1.6,'sm',-90,-SH-100);say(e,'…เก่งกว่าผมอีกครับ 🥲',7.2,1.8,'sm',40,-SH*.5);hearts(j,7.4,5);
 tl.call(()=>{follow(topb,j,-110,-SH*.62);cyc1(j,'walkA','walkB',.26);cyc1(e,'walkA','walkB',.3)},null,9.0).to(j,{x:W+220,duration:2.6,ease:'none'},9.0).to(e,{x:W+40,duration:2.6,ease:'none'},9.0);
 tl.to([car,e,j,dr,...bags],{opacity:0,duration:.4},11.4);},
];

  tl = gsap.timeline({ onComplete: () => { finish(); onDone && onDone(); } });
  SC[i]();
  let gone = false;
  function finish() { if (gone) return; gone = true; tl && tl.kill(); stopCyc(); tos.forEach(clearTimeout); follows = []; gsap.ticker.remove(tick); tv.remove(); }
  return { kill: finish };
}
