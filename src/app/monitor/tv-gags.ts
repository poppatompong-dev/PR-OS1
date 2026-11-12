/* eslint-disable */
// @ts-nocheck — ported as-is from the approved prototype (scratchpad gags2.html,
// owner 4 Nov 2026); plain DOM + GSAP, nothing typed flows in or out.
//
// พี่เอิร์ธ × ป้าจิตร (ภรรยาการ์ตูน, ปั้นใน Blender) — 12 แก็กพ่อบ้านใจกล้า แต่กลัวเมีย.
// 12 Nov 2026 (owner): ป้าจิตร's new look from a photo (scripts/looks/jit_update.py) and
// gag 12 — she chases him in her red hatchback ("ขับรถตามได้บ้างนะ แกขับ swift แดง").
// TvCast slots one in after every 4 ordinary antics; shuffled, no repeat until all 11
// have played; gag 4 (จูงกลับบ้าน) only after 16:00. Works on a 1920×1080 stage
// scaled to the screen.

import gsap from "gsap";

export const GAG_COUNT = 12;
export const GAG_HOME_TIME = 3; // จูงกลับบ้าน
export const EARTH_ID = "00000000-0000-0000-0000-000000000502";
const TEAM_IDS = { cook: "00000000-0000-0000-0000-000000000503", pang: "00000000-0000-0000-0000-000000000505", nat: "00000000-0000-0000-0000-000000000504" };
const POSES = ["stand", "walkA", "walkB", "runA", "runB", "wave", "up"];
const JPOSES = ["standE", "standAngry", "walkA", "walkB", "chaseA", "chaseB", "pullA", "pullB", "trayA", "trayB"];
const set = (base, ps) => Object.fromEntries(ps.map((p) => [p, `${base}/${p}.webp`]));
const EAR = set(`/cast/${EARTH_ID}`, [...POSES, "runA-shock", "runB-shock", "stand-shock", "stand-sad", "stand-cry", "stand-shout"]);
// Faces that fit the moment (owner 4 Nov: "หน้ายิ้มตลอด") — fleeing = shock, caught = sad, etc.
const RUN_A = EAR["runA-shock"], RUN_B = EAR["runB-shock"];
const JIT = set("/cast/jit", JPOSES);
const TEAM = Object.fromEntries(Object.entries(TEAM_IDS).map(([k, id]) => [k, set(`/cast/${id}`, POSES)]));
const TIF = "/cast/jit/tiffin.webp";
const JFACE = "/cast/jit/face.webp";

export function preloadGags() {
  for (const u of [...Object.values(EAR), ...Object.values(JIT), TIF, JFACE, ...Object.values(TEAM).flatMap((t) => Object.values(t))]) { const im = new Image(); im.src = u; }
}

/** Plays gag i on a fresh 1920×1080 stage inside host. floor = the ticker's top in stage pixels. */
export function playGag(i, host, floor, scale, onDone) {
  const tv = document.createElement("div");
  tv.className = "tv-gag";
  tv.style.transform = `scale(${scale})`;
  host.appendChild(tv);
const W=1920, FLOOR=floor, SW=190, SH=340;
let tl=null, ivs=[], follows=[];
const el=(cls,html)=>{const d=document.createElement('div');d.className=cls;if(html!==undefined)d.innerHTML=html;tv.appendChild(d);return d};
const sprite=(img,x)=>{const d=el('sp');d.style.width=SW+'px';d.style.height=SH+'px';d.style.backgroundImage=`url(${img})`;gsap.set(d,{xPercent:-50,yPercent:-100,x,y:FLOOR});return d};
const show=(d,img)=>{d.style.backgroundImage=`url(${img})`};
const cyc=(d,a,b,s)=>{let k=0;show(d,a);const iv=setInterval(()=>{k^=1;show(d,k?b:a)},s*1000);ivs.push(iv);return iv};
const stopCyc=()=>{ivs.forEach(clearInterval);ivs=[]};
const follow=(e,t,dx,dy)=>follows.push([e,t,dx,dy]);
const tick=()=>follows.forEach(([e,t,dx,dy])=>gsap.set(e,{x:gsap.getProperty(t,'x')+dx,y:gsap.getProperty(t,'y')+dy}));
gsap.ticker.add(tick);
const BANG=`<svg viewBox="0 0 100 100" width="110" height="110"><polygon points="50,2 61,32 95,22 72,48 98,70 64,68 66,98 48,74 26,96 30,66 2,62 30,46 10,16 40,30" fill="#ffd36b" stroke="#1b1024" stroke-width="5" stroke-linejoin="round"/><text x="50" y="62" text-anchor="middle" font-size="38" font-weight="900" fill="#1b1024">!!</text></svg>`;
// The red 5-door hatchback (drawn here, no badge; owner 12 Nov: "รถสีแดงเป็นแบบ Hatchback"): ป้าจิตร at the wheel behind the front window.
const CAR=`<img class="pax" src="${EAR['stand-sad']}" alt=""><img class="drv" src="${JIT.standE}" alt=""><svg viewBox="0 0 600 260" width="600" height="260"><ellipse cx="352" cy="250" rx="226" ry="10" fill="rgba(0,0,0,.25)"/><path d="M180,40 L150,30 L172,52 Z" fill="#b81a26" stroke="#1b1024" stroke-width="5" stroke-linejoin="round"/><path fill-rule="evenodd" fill="#d8232f" stroke="#1b1024" stroke-width="6" stroke-linejoin="round" d="M120,200 L120,146 Q122,126 134,108 L178,44 Q188,28 212,28 L400,28 Q430,28 452,48 L506,108 Q570,118 584,148 L586,196 Q586,208 574,208 L132,208 Q120,208 120,200 Z M198,108 L230,42 L300,42 L300,108 Z M314,42 L398,42 Q420,42 436,58 L480,108 L314,108 Z"/><path d="M198,108 L230,42 L300,42 L300,108 Z M314,42 L398,42 Q420,42 436,58 L480,108 L314,108 Z" fill="rgba(170,215,255,.28)" stroke="#1b1024" stroke-width="5" stroke-linejoin="round"/><path d="M150,122 Q350,106 560,124" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="6" stroke-linecap="round"/><path d="M306,110 L306,196 M182,58 L144,112" stroke="#1b1024" stroke-width="4" fill="none"/><rect x="330" y="128" width="34" height="9" rx="4" fill="#1b1024"/><rect x="246" y="128" width="32" height="9" rx="4" fill="#1b1024"/><path d="M478,104 L506,96 L512,112 Z" fill="#d8232f" stroke="#1b1024" stroke-width="4"/><ellipse cx="564" cy="140" rx="16" ry="12" fill="#fff6c8" stroke="#1b1024" stroke-width="4"/><path d="M122,150 L124,128 Q128,114 138,106 L148,120 L142,150 Z" fill="#8a0f18" stroke="#1b1024" stroke-width="4" stroke-linejoin="round"/><rect x="126" y="186" width="452" height="12" rx="6" fill="#2a2030"/><g><circle cx="200" cy="208" r="44" fill="#1b1024"/><g class="spin"><circle cx="200" cy="208" r="22" fill="#cfd3dc" stroke="#1b1024" stroke-width="4"/><path d="M200,188 L200,228 M180,208 L220,208" stroke="#1b1024" stroke-width="5"/></g></g><g><circle cx="470" cy="208" r="44" fill="#1b1024"/><g class="spin"><circle cx="470" cy="208" r="22" fill="#cfd3dc" stroke="#1b1024" stroke-width="4"/><path d="M470,188 L470,228 M450,208 L490,208" stroke="#1b1024" stroke-width="5"/></g></g></svg>`;
const bubble=(txt,cls='')=>{const b=el('bubble '+cls);b.innerHTML=txt;return b};
const pop=(b,t)=>tl.fromTo(b,{opacity:0,scale:0.4},{opacity:1,scale:1,duration:0.3,ease:'back.out(2.5)'},t);
const hide=(arr,t)=>tl.to(arr,{opacity:0,duration:0.3},t);
function sweat(who,t,dur){tl.call(()=>{const iv=setInterval(()=>{const x=gsap.getProperty(who,'x'),y=gsap.getProperty(who,'y');for(let i=0;i<3;i++){const s=el('sweat');gsap.fromTo(s,{x:x+(i-1)*95-11,y:y-SH-6,opacity:1},{x:x+(i-1)*150-11,y:y-SH-60+i*14,opacity:0,duration:0.5,onComplete:()=>s.remove()})}},280);ivs.push(iv);setTimeout(()=>clearInterval(iv),dur*1000)},null,t)}
function dust(who,t,dur,dx=-40){tl.call(()=>{const iv=setInterval(()=>{const x=gsap.getProperty(who,'x'),y=gsap.getProperty(who,'y');const p=el('puff');gsap.fromTo(p,{x:x+dx,y:y-30,opacity:0.9,scale:0.6},{x:x+dx*2.2,y:y-60,opacity:0,scale:1.4,duration:0.6,onComplete:()=>p.remove()})},220);ivs.push(iv);setTimeout(()=>clearInterval(iv),dur*1000)},null,t)}
function hearts(who,t,n=8){tl.call(()=>{for(let i=0;i<n;i++){const h=el('emo','❤️');const x=gsap.getProperty(who,'x'),y=gsap.getProperty(who,'y');gsap.fromTo(h,{x:x-28+(Math.random()-.5)*150,y:y-SH-40,opacity:1,scale:0.6},{y:y-SH-170-Math.random()*80,x:`+=${(Math.random()-.5)*140}`,opacity:0,scale:1.2,duration:1.6,delay:i*0.16,onComplete:()=>h.remove()})}},null,t)}
function reset(){tl&&tl.kill();stopCyc();follows=[];tv.querySelectorAll(':scope>div').forEach(e=>e.remove())}

const GAGS=[
// 1 ลืมปิ่นโต
()=>{const e=sprite(EAR.runA,-150), j=sprite(JIT.chaseA,-150), bang=el('bang',BANG), b=bubble('พี่เอิร์ธ!! ลืมปิ่นโต!!'), ang=el('emo','💢');
 follow(bang,e,-10,-SH-70); follow(b,j,-40,-SH-120); follow(ang,j,40,-SH-10);
 tl.call(()=>cyc(e,RUN_A,RUN_B,0.08),null,0).to(e,{x:W*0.42,duration:1.5,ease:'power1.in'},0).to(e,{y:FLOOR-14,duration:0.08,yoyo:true,repeat:40},0);
 pop(bang,0.25); sweat(e,0.2,3.5); dust(e,0.1,3.8);
 tl.to(e,{scaleX:-1,duration:0.01},1.55).to(e,{scaleX:1,duration:0.01},1.95).to(e,{x:W+200,duration:1.9,ease:'power2.in'},1.95);
 tl.call(()=>cyc(j,JIT.chaseA,JIT.chaseB,0.13),null,0.9).to(j,{x:W*0.30,duration:1.6,ease:'none'},0.9).to(j,{y:FLOOR-12,duration:0.13,yoyo:true,repeat:46},0.9).to(j,{x:W+220,duration:3.4,ease:'power1.in'},2.5);
 pop(b,1.3); tl.to(ang,{opacity:1,duration:0.2},1.2).to(ang,{scale:1.3,duration:0.18,yoyo:true,repeat:11},1.3); hide([b,ang,bang],4.6);
 const tif=el('tif'); tif.style.backgroundImage=`url(${TIF})`; const th=bubble('รับแล้วครับ 🙏','sm');
 tl.call(()=>{stopCyc();follows=follows.filter(f=>f[0]!==b&&f[0]!==ang&&f[0]!==bang);gsap.set(e,{x:W+150,y:FLOOR,scaleX:-1});gsap.set(j,{x:W+330,y:FLOOR,scaleX:-1});cyc(e,EAR.walkA,EAR.walkB,0.24);cyc(j,JIT.walkA,JIT.walkB,0.24);follow(tif,e,-SW*0.42,-SH*0.36);follow(th,e,-60,-SH-90)},null,6.3)
  .to([e,j],{x:'-=1150',duration:3.4,ease:'none'},6.4).to(tif,{opacity:1,duration:0.2},6.4); pop(th,7.0); hearts(j,7.3);
 tl.to([e,j,tif,th],{opacity:0,duration:0.6},10.0);},
// 2 แอบหนี เจอดักหน้า
()=>{const e=sprite(EAR.walkA,-150), j=sprite(JIT.standAngry,W*0.70), bang=el('bang',BANG), b=bubble('จะไปไหนคะ??'), ang=el('emo','💢'), sh=bubble('ชู่ว…','sm'), hm=bubble('หึ!','sm');
 gsap.set(j,{y:FLOOR+SH+20}); follow(bang,e,-10,-SH-70); follow(b,j,-60,-SH-120); follow(ang,j,40,-SH-10); follow(sh,e,-20,-SH-90); follow(hm,j,-30,-SH-90);
 tl.call(()=>cyc(e,EAR.walkA,EAR.walkB,0.32),null,0).to(e,{x:W*0.38,duration:2.2,ease:'none'},0).to(e,{y:FLOOR-6,duration:0.32,yoyo:true,repeat:6},0); pop(sh,0.4);
 tl.call(()=>{stopCyc();show(e,EAR.stand)},null,2.2).to(e,{scaleX:-1,duration:0.01},2.4).to(e,{scaleX:1,duration:0.01},2.8).to(e,{scaleX:-1,duration:0.01},3.1).to(e,{scaleX:1,duration:0.01},3.4); hide(sh,3.4);
 tl.call(()=>cyc(e,EAR.walkA,EAR.walkB,0.32),null,3.5).to(e,{x:W*0.52,duration:1.2,ease:'none'},3.5);
 tl.to(j,{y:FLOOR,duration:0.45,ease:'back.out(2)'},4.7); pop(b,4.9); tl.to(ang,{opacity:1,duration:0.2},4.9).to(ang,{scale:1.3,duration:0.2,yoyo:true,repeat:7},5.0);
 tl.call(()=>{stopCyc();show(e,EAR['stand-shock'])},null,4.7); pop(bang,4.9); tl.to(e,{y:FLOOR-90,duration:0.25,yoyo:true,repeat:1,ease:'power2.out'},4.95); sweat(e,5.0,2.4);
 tl.to(e,{scaleX:-1,duration:0.01},5.6).call(()=>cyc(e,RUN_A,RUN_B,0.08),null,5.6).to(e,{x:-200,duration:1.6,ease:'power2.in'},5.7); dust(e,5.7,1.6,40); hide([bang],7.0);
 hide([b,ang],7.2); pop(hm,7.4); tl.to(j,{rotation:-6,duration:0.2,yoyo:true,repeat:3,transformOrigin:'50% 100%'},7.4); hide(hm,8.8);
 tl.to(j,{y:FLOOR+SH+20,duration:0.5,ease:'power2.in'},9.0);},
// 3 โทรตาม
()=>{const e=sprite(EAR.walkA,-150), bang=el('bang',BANG), call=bubble(`<span class="face" style="background-image:url(${JFACE})"></span><span>📞 ป้าจิตร โทรเข้า…</span>`), yes=bubble('ครับ ๆ … ครับผม 🙇','sm'), go=bubble('กลับเดี๋ยวนี้ครับ!!','sm');
 follow(bang,e,60,-SH-60); follow(call,e,-150,-SH-150); follow(yes,e,-60,-SH-100); follow(go,e,-60,-SH-100);
 tl.call(()=>cyc(e,EAR.walkA,EAR.walkB,0.26),null,0).to(e,{x:W*0.45,duration:2.2,ease:'power1.out'},0);
 tl.call(()=>{stopCyc();show(e,EAR['stand-shock'])},null,2.2); pop(call,2.3); tl.to(call,{rotation:3,duration:0.06,yoyo:true,repeat:24},2.6); pop(bang,2.5); sweat(e,2.6,4.2);
 hide(call,4.4); pop(yes,4.5); tl.call(()=>show(e,EAR.wave),null,4.5).to(e,{rotation:12,duration:0.25,yoyo:true,repeat:7,transformOrigin:'50% 100%'},4.6);
 hide([yes,bang],6.8); pop(go,6.9); tl.call(()=>cyc(e,RUN_A,RUN_B,0.08),null,7.3).to(e,{x:W+220,duration:1.8,ease:'power2.in'},7.4); dust(e,7.4,1.8); hide(go,8.6);},
// 4 จูงกลับบ้าน
()=>{const e=sprite(EAR.stand,W*0.42), j=sprite(JIT.walkA,W+150), b=bubble('เลิกงานแล้ว! กลับบ้าน!'), m=bubble('อีกนิดเดียวครับ~','sm');
 gsap.set(e,{opacity:0}); gsap.set(j,{scaleX:-1}); follow(b,j,-260,-SH-120); follow(m,e,0,-SH-100);
 tl.to(e,{opacity:1,duration:0.4},0).call(()=>show(e,EAR.wave),null,0.4).to(e,{rotation:5,duration:0.3,yoyo:true,repeat:5,transformOrigin:'50% 100%'},0.4);
 tl.call(()=>cyc(j,JIT.walkA,JIT.walkB,0.24),null,0.6).to(j,{x:W*0.42-150,duration:2.4,ease:'power1.out'},0.6);
 tl.call(()=>{stopCyc();gsap.set(j,{scaleX:-1});show(j,JIT.standAngry)},null,3.1); pop(b,3.1); tl.call(()=>show(e,EAR['stand-sad']),null,3.3); pop(m,3.9);
 // she turns round (faces left), grabs his hand, and drags him off
 tl.call(()=>{cyc(j,JIT.pullA,JIT.pullB,0.26)},null,5.0).to(j,{x:-300,duration:4.2,ease:'power1.in'},5.0)
  .to(e,{rotation:14,duration:0.3,transformOrigin:'50% 100%'},5.0).to(e,{x:-140,duration:4.2,ease:'power1.in'},5.05); dust(e,5.1,4.0,30); hide(b,6.0);
 tl.to(m,{x:'+=0',duration:0.01},6.0); hide(m,8.6);},
// 5 ฝากขนมให้น้อง ๆ
()=>{const j=sprite(JIT.trayA,-200), e=sprite(EAR.walkA,-420), b=bubble('ฝากขนมให้น้อง ๆ ทีมประชาสัมพันธ์นะคะ 🍰'), s=bubble('ขอบคุณครับ 😁','sm');
 follow(b,j,-60,-SH-130); follow(s,e,-40,-SH-100);
 tl.call(()=>{cyc(j,JIT.trayA,JIT.trayB,0.28);cyc(e,EAR.walkA,EAR.walkB,0.28)},null,0)
  .to(j,{x:W*0.55,duration:3.6,ease:'power1.out'},0).to(e,{x:W*0.55-230,duration:3.6,ease:'power1.out'},0);
 pop(b,1.2); tl.call(()=>{stopCyc();show(j,JIT.trayA);show(e,EAR.wave)},null,3.6); hearts(j,3.8,10); pop(s,4.4);
 tl.to(j,{rotation:-5,duration:0.25,yoyo:true,repeat:5,transformOrigin:'50% 100%'},3.8); hide([b,s],7.2);
 tl.call(()=>{cyc(j,JIT.trayA,JIT.trayB,0.28);cyc(e,EAR.walkA,EAR.walkB,0.28)},null,7.3).to([j,e],{x:'+=1200',duration:3.4,ease:'power1.in'},7.3);},
// 6 พ่อบ้านใจกล้า
// 6 ประกาศกร้าว
()=>{const e=sprite(EAR.walkA,-150), bang=el('bang',BANG), say=bubble('คืนนี้ผมกลับดึก!! 😤'), call=bubble(`<span class="face" style="background-image:url(${JFACE})"></span><span>📞 ป้าจิตร</span>`), ok=bubble('…ห้าโมงตรงครับ 🙇','sm');
 follow(say,e,-120,-SH-120); follow(bang,e,70,-SH-70); follow(call,e,-180,-SH-150); follow(ok,e,-80,-SH-100);
 tl.call(()=>cyc(e,EAR.walkA,EAR.walkB,0.26),null,0).to(e,{x:W*0.46,duration:2.0,ease:'power1.out'},0);
 tl.call(()=>{stopCyc();show(e,EAR.wave)},null,2.0).to(e,{scale:1.12,duration:0.3,ease:'back.out(3)',transformOrigin:'50% 100%'},2.1); pop(say,2.2); pop(bang,2.3);
 hide([say,bang],4.2); pop(call,4.4); tl.to(call,{rotation:3,duration:0.06,yoyo:true,repeat:22},4.6);
 tl.call(()=>show(e,EAR['stand-shock']),null,4.6).to(e,{scale:0.86,duration:0.5,ease:'power2.in'},4.7); sweat(e,4.8,3.2);
 hide(call,6.5); pop(ok,6.6); tl.to(e,{rotation:12,duration:0.25,yoyo:true,repeat:5,transformOrigin:'50% 100%'},6.7);
 hide(ok,8.6); tl.call(()=>cyc(e,RUN_A,RUN_B,0.08),null,8.6).to(e,{scale:1,duration:0.2},8.6).to(e,{x:W+220,duration:1.6,ease:'power2.in'},8.7); dust(e,8.7,1.6);},
// 7 พี่ใหญ่ในบ้าน
()=>{const e=sprite(EAR.walkA,-150), j=sprite(JIT.standAngry,W*0.5+150), say=bubble('ในบ้านนี้ ผมใหญ่สุด!!'), crown=el('emo','👑'), ang=el('emo','💢'), ok=bubble('…รองจากป้าจิตรครับ 😅','sm'), hm=bubble('ดีมากค่ะ 😊','sm');
 gsap.set(j,{y:FLOOR+SH+20}); follow(say,e,-160,-SH-130); follow(ang,j,40,-SH-10); follow(ok,e,-140,-SH-110); follow(hm,j,-20,-SH-110);
 tl.call(()=>cyc(e,EAR.walkA,EAR.walkB,0.26),null,0).to(e,{x:W*0.5,duration:2.0,ease:'power1.out'},0);
 tl.call(()=>{stopCyc();show(e,EAR.wave)},null,2.0); pop(say,2.1);
 tl.call(()=>{const x=gsap.getProperty(e,'x'),y=gsap.getProperty(e,'y');gsap.set(crown,{x:x-34,y:y-SH-40})},null,2.1).fromTo(crown,{opacity:0,y:'-=60'},{opacity:1,y:'+=60',duration:0.4,ease:'bounce.out'},2.1);
 tl.to(e,{scale:1.1,duration:0.3,transformOrigin:'50% 100%',yoyo:true,repeat:3},2.3);
 tl.to(j,{y:FLOOR,duration:0.45,ease:'back.out(2)'},4.2).to(ang,{opacity:1,duration:0.2},4.5).to(ang,{scale:1.3,duration:0.2,yoyo:true,repeat:5},4.6);
 hide(say,4.4); tl.call(()=>show(e,EAR['stand-shock']),null,4.6); sweat(e,4.7,3.0);
 tl.to(crown,{y:'+=320',rotation:200,opacity:0,duration:0.9,ease:'power2.in'},5.0);
 pop(ok,5.4); tl.to(e,{rotation:10,duration:0.25,yoyo:true,repeat:5,transformOrigin:'50% 100%'},5.5); hide([ok,ang],7.6); pop(hm,7.7); hearts(j,7.8,6); hide(hm,9.2);
 tl.call(()=>{gsap.set(j,{scaleX:-1});show(j,JIT.walkA);cyc(j,JIT.walkA,JIT.walkB,0.26);cyc(e,EAR.walkA,EAR.walkB,0.26);gsap.set(e,{scaleX:-1})},null,9.3).to([j,e],{x:'-=1300',duration:3.0,ease:'power1.in'},9.4);},
// 8 น้องชวนไปต่อ
()=>{const e=sprite(EAR.stand,W*0.34), ks=['cook','pang','nat'], n=ks.map((k,i)=>sprite(TEAM[k].walkA,W+150+i*170));
 const ask=bubble('ไปกินหมูกระทะต่อไหมพี่? 🔥'), go=bubble('ไป!!! 🙌','sm'), sh=(()=>{const d=el('shadow');tv.prepend(d);return d})(), bye=bubble('พี่…ขอกลับก่อนนะ 🏃','sm'), lol=bubble('555+ 😂','sm');
 gsap.set(e,{opacity:0}); n.forEach(d=>gsap.set(d,{scaleX:-1})); follow(ask,n[0],-260,-SH-120); follow(go,e,-40,-SH-100); follow(bye,e,-100,-SH-100); follow(lol,n[1],-40,-SH-100);
 tl.to(e,{opacity:1,duration:0.4},0);
 tl.call(()=>n.forEach((d,i)=>cyc(d,TEAM[ks[i]].walkA,TEAM[ks[i]].walkB,0.26)),null,0.2); n.forEach((d,i)=>tl.to(d,{x:W*0.52+i*170,duration:2.4,ease:'power1.out'},0.2));
 tl.call(()=>{stopCyc();n.forEach((d,i)=>show(d,TEAM[ks[i]].wave))},null,2.6); pop(ask,2.7);
 hide(ask,4.3); tl.call(()=>show(e,EAR.wave),null,4.4); pop(go,4.4); tl.to(e,{y:FLOOR-70,duration:0.22,yoyo:true,repeat:3,ease:'power2.out'},4.4);
 // ป้าจิตรมาทาบเงา
 tl.call(()=>{sh.style.backgroundImage=`url(${JIT.standAngry})`},null,5.4).fromTo(sh,{x:-700,opacity:0},{x:W*0.34-560,opacity:0.6,duration:1.2,ease:'power2.out'},5.4);
 hide(go,5.6); tl.call(()=>show(e,EAR['stand-shock']),null,6.0); sweat(e,6.0,2.4); tl.to(e,{x:'+=6',duration:0.05,yoyo:true,repeat:14},6.1);
 pop(bye,6.9); tl.to(e,{scaleX:-1,duration:0.01},8.0).call(()=>cyc(e,RUN_A,RUN_B,0.08),null,8.0).to(e,{x:-260,duration:1.4,ease:'power2.in'},8.1); dust(e,8.1,1.4,40); hide(bye,8.6);
 tl.to(sh,{x:-900,opacity:0,duration:1.0,ease:'power2.in'},8.3); pop(lol,8.9); tl.to(n,{rotation:8,duration:0.2,yoyo:true,repeat:5,stagger:0.05,transformOrigin:'50% 100%'},8.9); hide(lol,10.4);
 tl.to(n,{opacity:0,duration:0.5},10.6);},
// 9 เงินเดือนออก
()=>{const e=sprite(EAR.walkA,-150), j=sprite(JIT.walkA,W+150), wal=el('emo','👛'), coin=el('emo','🪙'), say=bubble('เงินเดือนออกแล้ว!! 💰'), thx=bubble('…ขอบคุณครับ 🥲','sm'), her=bubble('ขอบคุณค่า~ 😊','sm');
 gsap.set(j,{scaleX:-1}); follow(say,e,-140,-SH-120); follow(thx,e,-100,-SH-100); follow(her,j,-60,-SH-100);
 tl.call(()=>cyc(e,EAR.walkA,EAR.walkB,0.26),null,0).to(e,{x:W*0.40,duration:2.0,ease:'power1.out'},0);
 tl.call(()=>{stopCyc();show(e,EAR.wave);const x=gsap.getProperty(e,'x');gsap.set(wal,{x:x+40,y:FLOOR-SH*0.62,opacity:1})},null,2.0); pop(say,2.1); tl.to(wal,{rotation:12,duration:0.15,yoyo:true,repeat:7},2.2);
 tl.call(()=>cyc(j,JIT.walkA,JIT.walkB,0.26),null,2.6).to(j,{x:W*0.66,duration:1.8,ease:'power1.out'},2.6).call(()=>{ivs.forEach(clearInterval);ivs=[];show(j,JIT.standE)},null,4.4);
 hide(say,4.4);
 tl.to(wal,{keyframes:[{x:W*0.53,y:FLOOR-SH-140,duration:0.45,ease:'power1.out'},{x:W*0.66-10,y:FLOOR-SH*0.36,duration:0.45,ease:'power1.in'}]},4.6); hearts(j,5.6,6); pop(her,5.7);
 tl.call(()=>{gsap.set(coin,{x:W*0.66-20,y:FLOOR-SH*0.6,opacity:1})},null,6.6).to(coin,{keyframes:[{x:W*0.53,y:FLOOR-SH-120,duration:0.4,ease:'power1.out'},{x:W*0.40-20,y:FLOOR-SH-80,duration:0.4,ease:'power1.in'},{y:FLOOR-SH-150,duration:0.25,ease:'power1.out'},{y:FLOOR-SH-80,duration:0.25,ease:'bounce.out'}]},6.6);
 tl.call(()=>show(e,EAR['stand-cry']),null,7.4); hide(her,7.5); pop(thx,7.8); sweat(e,7.8,1.8); hide([thx,wal,coin],9.6);
 tl.call(()=>{cyc(e,EAR.walkA,EAR.walkB,0.3);gsap.set(e,{scaleX:-1})},null,9.8).to(e,{x:-200,duration:2.2,ease:'none'},9.8).to(j,{opacity:0,duration:0.5},10.4);},
// 10 ขอซื้อกล้องใหม่
()=>{const e=sprite(EAR.walkA,-150), j=sprite(JIT.standE,W*0.62), card=el('card','<div style="font-size:70px;line-height:1">📸</div><b>กล้องรุ่นใหม่</b><span>89,900.-</span>'), note=el('note20','20'), ask=bubble('ขอตัวนี้นะครับ 🙏'), her=bubble('ซื้อถ่านพอนะคะ 🔋','sm'), sad=bubble('…ครับ 🥹','sm');
 gsap.set(j,{opacity:0,scaleX:-1}); follow(card,e,105,-SH*0.62); follow(ask,e,-140,-SH-130); follow(her,j,-80,-SH-110); follow(sad,e,-60,-SH-100);
 tl.to(j,{opacity:1,duration:0.4},0.3);
 tl.call(()=>cyc(e,EAR.walkA,EAR.walkB,0.26),null,0).to(e,{x:W*0.40,duration:2.0,ease:'power1.out'},0);
 tl.call(()=>{stopCyc();show(e,EAR.wave)},null,2.0).fromTo(card,{opacity:0,scale:0.3},{opacity:1,scale:1,duration:0.35,ease:'back.out(2)'},2.0); pop(ask,2.2);
 tl.to(card,{rotation:-4,duration:0.2,yoyo:true,repeat:7},2.4); hide(ask,4.3);
 tl.call(()=>gsap.set(note,{x:W*0.62-60,y:FLOOR-SH*0.6,opacity:1}),null,4.5).to(note,{keyframes:[{x:W*0.51,y:FLOOR-SH-120,rotation:180,duration:0.5,ease:'power1.out'},{x:W*0.40+70,y:FLOOR-SH*0.36,rotation:360,duration:0.5,ease:'power1.in'}]},4.5); pop(her,4.6);
 tl.call(()=>show(e,EAR['stand-sad']),null,5.6).to(card,{y:'+=260',rotation:40,opacity:0,duration:0.9,ease:'power2.in'},5.7); sweat(e,5.7,2.4); hide(her,7.0); pop(sad,7.1);
 tl.to(e,{rotation:-6,duration:0.4,transformOrigin:'50% 100%'},7.2); hide([sad,note],9.0); hearts(j,8.0,4);
 tl.call(()=>{cyc(e,EAR.walkA,EAR.walkB,0.34);gsap.set(e,{scaleX:-1,rotation:0})},null,9.2).to(e,{x:-220,duration:2.4,ease:'none'},9.2).to(j,{opacity:0,duration:0.5},10.2);},
// 11 กล้ามโต
()=>{const e=sprite(EAR.up,W*0.42), j=sprite(JIT.walkA,W+150), sign=el('sign','💪 พ่อบ้านใจกล้า'), jar=el('emo','🍯'), ask=bubble('ที่รัก~ เปิดฝาให้หน่อย'), ugh=bubble('อึ้บบบ…!! 😣','sm'), pop1=el('emo','✨'), easy=bubble('ง่ายนิดเดียว~ 😊','sm'), lose=bubble('…ฝามันแน่นครับ','sm');
 gsap.set(e,{opacity:0}); gsap.set(j,{scaleX:-1}); follow(sign,e,-150,-SH-110); follow(ask,j,-300,-SH-120); follow(ugh,e,10,-SH-200); follow(easy,j,-80,-SH-110); follow(lose,e,-120,-SH-110);
 tl.to(e,{opacity:1,duration:0.3},0).fromTo(sign,{opacity:0,scale:0.4},{opacity:1,scale:1,duration:0.35,ease:'back.out(2.5)'},0.3).to(e,{scale:1.1,duration:0.25,yoyo:true,repeat:7,transformOrigin:'50% 100%'},0.4);
 tl.call(()=>cyc(j,JIT.walkA,JIT.walkB,0.26),null,1.6).to(j,{x:W*0.66,duration:2.0,ease:'power1.out'},1.6).call(()=>{ivs.forEach(clearInterval);ivs=[];show(j,JIT.standE);gsap.set(jar,{x:W*0.66-80,y:FLOOR-SH*0.4,opacity:1})},null,3.6);
 pop(ask,3.7); tl.to(jar,{keyframes:[{x:W*0.54,y:FLOOR-SH-90,duration:0.4},{x:W*0.42+30,y:FLOOR-SH*0.42,duration:0.4,ease:'power1.in'}]},4.9);
 hide(ask,5.0); tl.call(()=>show(e,EAR['stand-shout']),null,5.7); pop(ugh,5.8); tl.to([e,jar],{x:'+=8',duration:0.05,yoyo:true,repeat:22},5.8); sweat(e,5.8,2.6); tl.to(sign,{rotation:-25,y:'+=40',duration:0.4},6.6);
 hide(ugh,7.3); tl.to(jar,{keyframes:[{x:W*0.54,y:FLOOR-SH-90,duration:0.4},{x:W*0.66-80,y:FLOOR-SH*0.4,duration:0.4,ease:'power1.in'}]},7.4);
 tl.call(()=>{gsap.set(pop1,{x:W*0.66-90,y:FLOOR-SH*0.55})},null,8.3).fromTo(pop1,{opacity:0,scale:0.4},{opacity:1,scale:1.6,duration:0.3,yoyo:true,repeat:1},8.3); pop(easy,8.4); hide([sign],8.4);
 pop(lose,9.3); hearts(j,9.0,5); hide([easy,lose,jar],10.8); tl.to([e,j],{opacity:0,duration:0.5},11.0);},
// 12 ป้าจิตรขับรถตาม (red hatchback)
()=>{const e=sprite(EAR.runA,-150), car=el('car',CAR), bang=el('bang',BANG), honk=bubble('ปี๊น ปี๊นนน!! 🚗💨'), call=bubble('พี่เอิร์ธ!! ขึ้นรถเดี๋ยวนี้!!'), ok=bubble('ครับ ๆ … ขึ้นแล้วครับ 🙇','sm'), ang=el('emo','💢'), at=el('emo','');
 gsap.set(car,{x:-720,y:FLOOR-256}); follow(at,car,400,256); follow(bang,e,-10,-SH-70); follow(honk,car,330,-90); follow(call,car,300,-90); follow(ang,car,470,-20); follow(ok,e,-80,-SH-100);
 const go=(on)=>car.classList.toggle('is-stop',!on);
 tl.call(()=>cyc(e,RUN_A,RUN_B,0.08),null,0).to(e,{x:W*0.50,duration:1.7,ease:'power1.in'},0).to(e,{y:FLOOR-14,duration:0.08,yoyo:true,repeat:30},0); sweat(e,0.2,2.6); dust(e,0.1,2.6);
 tl.call(()=>go(true),null,1.0).to(car,{x:-40,duration:1.3,ease:'power2.out'},1.0).to(car,{y:FLOOR-262,duration:0.12,yoyo:true,repeat:9},1.0); dust(at,1.0,1.6,-290);
 pop(honk,1.5); pop(bang,1.9); tl.to(e,{x:W*0.80,duration:1.6,ease:'none'},1.8).to(e,{y:FLOOR-14,duration:0.08,yoyo:true,repeat:20},1.8);
 hide(honk,2.9); tl.to(car,{x:W*0.80-660,duration:1.5,ease:'power2.inOut'},2.8); pop(call,3.2); tl.to(ang,{opacity:1,duration:0.2},3.2).to(ang,{scale:1.3,duration:0.18,yoyo:true,repeat:7},3.3);
 tl.call(()=>{stopCyc();show(e,EAR['stand-cry']);go(false)},null,4.4); sweat(e,4.4,2.0); tl.to(e,{x:'+=6',duration:0.05,yoyo:true,repeat:12},4.5); hide([call,ang,bang],5.6); pop(ok,5.4);
 tl.call(()=>cyc(e,EAR.walkA,EAR.walkB,0.24),null,6.4).to(e,{x:W*0.80-330,duration:0.9,ease:'none'},6.4).to(e,{opacity:0,duration:0.3},7.0); hide(ok,6.8);
 // he is in: both of them show through the windows (owner, 12 Nov: "ต้องเห็นพี่เอิร์ธคู่กันบนรถด้วย")
 const pax=car.querySelector('.pax'), home=bubble('กลับบ้านกันค่ะ 😊','sm'); follow(home,car,330,-80);
 tl.to(pax,{opacity:1,duration:0.25},7.2).to(car,{y:FLOOR-250,duration:0.12,yoyo:true,repeat:1},7.2); pop(home,7.6); hearts(at,7.7,6);
 hide(home,9.0); tl.call(()=>{stopCyc();go(true)},null,9.0).to(car,{x:W+200,duration:2.2,ease:'power2.in'},9.2); dust(at,9.2,2.2,-290);
 tl.to(car,{opacity:0,duration:0.3},11.4);},
];

  tl = gsap.timeline({ onComplete: () => { finish(); onDone && onDone(); } });
  GAGS[i]();
  function finish() { tl && tl.kill(); stopCyc(); follows = []; gsap.ticker.remove(tick); tv.remove(); }
  return { kill: finish };
}
