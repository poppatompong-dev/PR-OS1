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
const JIT = ["standE", "standAngry", "walkA", "walkB"];
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
const cyc=(d,a,b,s)=>{let k=0;show(d,a);const iv=setInterval(()=>{k^=1;show(d,k?b:a)},s*1000);ivs.push(iv)};
const stopCyc=()=>{ivs.forEach(clearInterval);ivs=[]};
const follow=(e,t,dx,dy)=>follows.push([e,t,dx,dy]);
const tick=()=>follows.forEach(([e,t,dx,dy])=>{const s=gsap.getProperty(t,'scaleY')||1;gsap.set(e,{x:gsap.getProperty(t,'x')+dx*Math.abs(s),y:gsap.getProperty(t,'y')+dy*Math.abs(s)})});
gsap.ticker.add(tick);
const bubble=(t,c='')=>el('bubble '+c,t);
const pop=(b,t)=>tl.fromTo(b,{opacity:0,scale:.4},{opacity:1,scale:1,duration:.3,ease:'back.out(2.5)'},t);
const hide=(a,t)=>tl.to(a,{opacity:0,duration:.3},t);
const shake=(t,n=10,amp=18)=>tl.to(st,{x:`random(-${amp},${amp})`,y:`random(-${amp},${amp})`,duration:.04,repeat:n,yoyo:true,repeatRefresh:true},t).set(st,{x:0,y:0},t+.04*(n+1));
// Board-covering effects: short and a little see-through so the queue stays readable.
function focusLines(t,dur){dur=Math.min(dur,2);const f=el('focus',FOCUS);tl.to(f,{opacity:.6,duration:.08},t).to(f,{rotation:2,duration:.08,yoyo:true,repeat:Math.round(dur/.08),transformOrigin:'50% 52%'},t).to(f,{opacity:0,duration:.2},t+dur);return f}
function flash(t,color='#fff'){const f=el('flash');f.style.background=color;tl.fromTo(f,{opacity:.7},{opacity:0,duration:.3},t)}
function impact(t){tl.set(st,{filter:'invert(1)'},t).set(st,{filter:'none'},t+.08).set(st,{filter:'invert(1)'},t+.14).set(st,{filter:'none'},t+.2)}
function sfx(txt,x,y,t,rot=-8,size=150){const s=el('sfx',txt);s.style.fontSize=size+'px';gsap.set(s,{x,y,rotation:rot});tl.fromTo(s,{opacity:0,scale:2.2},{opacity:1,scale:1,duration:.22,ease:'back.out(3)'},t).to(s,{opacity:0,duration:.4},t+1.1);return s}
function soul(who,t){const s=el('soul',SOUL);tl.call(()=>{const x=gsap.getProperty(who,'x'),y=gsap.getProperty(who,'y');gsap.set(s,{x:x-45,y:y-SH*.72})},null,t).to(s,{opacity:1,duration:.3},t).to(s,{y:'-=260',duration:2.4,ease:'sine.out'},t).to(s,{x:'+=40',duration:.4,yoyo:true,repeat:5,ease:'sine.inOut'},t).to(s,{opacity:0,duration:.5},t+2.2)}
function drop(who,t,dx=58,dy=-SH+60){const d=el('drop',DROP);follow(d,who,dx,dy);tl.fromTo(d,{opacity:0,scale:.3},{opacity:1,scale:1.2,duration:.3,ease:'back.out(3)'},t);return d}
function gloom(who,t,dur){const g=el('gloom'),c=el('cloud',CLOUD);follow(g,who,-100,-SH-40);follow(c,who,-120,-SH-140);tl.to([g,c],{opacity:1,duration:.4},t).to([g,c],{opacity:0,duration:.4},t+dur);return[g,c]}
function tears(who,t,dur){const a=el('tear'),b=el('tear');follow(a,who,-36,-SH*.66);follow(b,who,14,-SH*.66);tl.to([a,b],{opacity:1,height:130,duration:.5},t).to([a,b],{height:150,duration:.25,yoyo:true,repeat:Math.round(dur/.25)},t+.5).to([a,b],{opacity:0,duration:.3},t+dur)}
function hearts(who,t,n=8,emo='❤️'){tl.call(()=>{for(let i=0;i<n;i++){const h=el('emo',emo);const x=gsap.getProperty(who,'x'),y=gsap.getProperty(who,'y');gsap.fromTo(h,{x:x-20+Math.random()*60,y:y-SH+30,opacity:1,scale:.6},{y:y-SH-170-Math.random()*80,x:`+=${(Math.random()-.5)*160}`,opacity:0,scale:1.2,duration:1.6,delay:i*.14,onComplete:()=>h.remove()})}},null,t)}
function dustPuff(who,t,dur){tl.call(()=>{const iv=setInterval(()=>{const x=gsap.getProperty(who,'x'),y=gsap.getProperty(who,'y');const p=el('emo','💨');gsap.fromTo(p,{x:x-80,y:y-50,opacity:.9},{x:x-180,opacity:0,duration:.5,onComplete:()=>p.remove()})},180);ivs.push(iv);tos.push(setTimeout(()=>clearInterval(iv),dur*1000))},null,t)}

const SC=[
// A1 ตัวใหญ่ตะโกน + ตัวหดจิบิ
()=>{const ew=R[0];const e=sprite(ew,'walkA',-150),j=sprite('jit','standAngry',W*.66),say=bubble('คืนนี้ผมกลับดึกนะ~ 😎'),red=el('reddim'),bm=el('boom',BOOM+'<b>ว่ายังไงนะ!?</b>'),a1=el('emo','💢'),a2=el('emo','💢'),a3=el('emo','💢'),ok=bubble('…ห้าโมงตรงครับ 🙇','sm');
 gsap.set(j,{opacity:0});follow(say,e,-60,-SH-110);follow(ok,e,-60,-SH*.5-90);
 tl.call(()=>cyc(e,'walkA','walkB',.26),null,0).to(e,{x:W*.36,duration:1.8,ease:'power1.out'},0).call(()=>{stopCyc();show(e,'wave')},null,1.8);pop(say,1.9);
 tl.to(j,{opacity:1,duration:.2},3.0).to(red,{opacity:.8,duration:.15},3.3);focusLines(3.3,1.8);impact(3.3);
 tl.fromTo(j,{scale:1},{scale:2.7,duration:.35,ease:'back.out(2)'},3.3);shake(3.3,14,22);
 tl.set(bm,{x:W*.66-560,y:Math.max(60,FLOOR-SH*2.7-120)},3.4);pop(bm,3.45);tl.to(bm,{rotation:2,duration:.06,yoyo:true,repeat:16},3.6);
 [a1,a2,a3].forEach((a,i)=>{gsap.set(a,{x:W*.66+40+i*55,y:FLOOR-SH*2.6+20+i*30,fontSize:'90px'});tl.to(a,{opacity:1,scale:1.3,duration:.15,yoyo:true,repeat:5},3.5+i*.1)});
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
()=>{const k=sprite(R[0],'walkA',-150),card=el('ucard','‼ งานด่วน! 30 นาที'),up=bubble('ครับผม!! 🫡','sm');
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
 st.prepend(bg);follow(hb,p,-200,-SH-130);follow(medal,p,-25,-SH*.42);follow(bl1,p,-78,-SH*.55);follow(bl2,p,10,-SH*.55);follow(s1,p,-50,-SH*.74);follow(s2,p,6,-SH*.74);
 tl.call(()=>cyc(p,'walkA','walkB',.26),null,0).to(p,{x:W*.5,duration:2.0,ease:'power1.out'},0).call(()=>{stopCyc();show(p,'wave')},null,2.0);
 tl.to(bg,{opacity:.7,duration:.5},2.1);pop(hb,2.2);tl.fromTo(medal,{opacity:0,scale:3},{opacity:1,scale:1,duration:.35,ease:'back.out(2)'},2.3);
 tl.to([bl1,bl2],{opacity:.9,duration:.3},2.6).fromTo([s1,s2],{opacity:0,scale:.2},{opacity:1,scale:1,duration:.3,ease:'back.out(3)'},2.6).to([s1,s2],{rotation:20,duration:.3,yoyo:true,repeat:9},2.9);
 tl.call(()=>{for(let i=0;i<20;i++){const b=el('bub');const r=20+Math.random()*60;b.style.width=b.style.height=r+'px';gsap.fromTo(b,{x:W*.2+Math.random()*W*.6,y:FLOOR-Math.random()*200,opacity:0},{y:`-=${300+Math.random()*300}`,opacity:.9,duration:2+Math.random()*1.5,delay:Math.random()*1.2,yoyo:true,repeat:1,onComplete:()=>b.remove()})}},null,2.4);
 hearts(p,2.8,10,'✨');tl.to(p,{scaleY:.86,scaleX:1.12,duration:.12,yoyo:true,repeat:1},3.0).to(p,{y:FLOOR-90,duration:.25,yoyo:true,repeat:3,ease:'power2.out'},3.3);
 hide([hb,medal,bl1,bl2,s1,s2],6.4);tl.to(bg,{opacity:0,duration:.6},6.4).to(p,{opacity:0,duration:.5},6.8);},
// C2 วิ่งมารับเหรียญ เส้นความเร็ว
()=>{const s=sprite(R[0],'runA',-200),sp=el('focus',SPEED),badge=bubble(data.label);
 tl.to(sp,{opacity:1,duration:.1},.2).to(sp,{x:-300,duration:.25,repeat:9,ease:'none'},.2);
 tl.call(()=>cyc(s,'runA','runB',.06),null,.2).to(s,{x:W*.5,duration:.5,ease:'power3.out'},.2).to(s,{rotation:8,duration:.1},.2);sfx('ฟิ้ว~',W*.5-420,FLOOR-SH-120,.4,-12,120);
 tl.call(()=>{stopCyc();show(s,'wave')},null,.8).to(s,{rotation:0,duration:.2},.8);tl.set(badge,{x:W*.5-330,y:FLOOR-SH-130},.9);pop(badge,.9);hearts(s,1.0,8,data.icon||'⚡');
 tl.to(sp,{opacity:0,duration:.3},2.6);tl.call(()=>cyc(s,'runA','runB',.06),null,4.6).to(s,{x:W+260,duration:.45,ease:'power3.in'},4.6);tl.to(sp,{opacity:1,duration:.1},4.6).to(sp,{opacity:0,duration:.3},5.1);hide(badge,4.5);},
];

  tl = gsap.timeline({ onComplete: () => { finish(); onDone && onDone(); } });
  SC[i]();
  let gone = false;
  function finish() { if (gone) return; gone = true; tl && tl.kill(); stopCyc(); tos.forEach(clearTimeout); follows = []; gsap.ticker.remove(tick); tv.remove(); }
  return { kill: finish };
}
