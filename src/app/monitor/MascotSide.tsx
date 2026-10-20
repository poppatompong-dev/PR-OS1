"use client";

import { useEffect, useRef, useState } from "react";
import type { MascotHandle } from "@/lib/monitor/mascot-scene";

export type SideNext =
  | { kind: "upcoming"; minutes: number; title: string; place: string; start: string }
  | { kind: "now"; title: string; place: string; end: string }
  | { kind: "done" }
  | { kind: "none" };

export type SideAck = { done: number; total: number; pending: number; unavailable: number };

function untilText(minutes: number): string {
  if (minutes <= 0) return "เริ่มแล้วตอนนี้";
  if (minutes < 60) return `อีก ${minutes} นาที`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `อีก ${h} ชม.` : `อีก ${h} ชม. ${m} นาที`;
}

/** WebGL can be missing or blocked on TV browsers; check before loading three.js. */
function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * The side column of /monitor?v=3d: the mascot announces the next job and
 * counts today's acknowledgements. It never takes room from the job list —
 * it lives in its own grid column.
 */
export function MascotSide({ next, ack, staticMode }: { next: SideNext; ack: SideAck; staticMode: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handleRef = useRef<MascotHandle | null>(null);
  const [mode, setMode] = useState<"loading" | "3d" | "still">("loading");
  const [frozen, setFrozen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!hasWebGL()) {
      setMode("still");
      return;
    }
    import("@/lib/monitor/mascot-scene")
      .then(({ mountMascot }) => {
        if (cancelled || !canvasRef.current) return;
        handleRef.current = mountMascot(canvasRef.current, {
          animate: !staticMode,
          onFreeze: () => setFrozen(true),
        });
        setMode("3d");
      })
      .catch(() => {
        if (!cancelled) setMode("still");
      });
    return () => {
      cancelled = true;
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, [staticMode]);

  // A wave whenever someone acknowledges while the screen is up (not on the
  // first load, which would wave at every count).
  const prevDone = useRef<number | null>(null);
  useEffect(() => {
    if (prevDone.current !== null && ack.done > prevDone.current) handleRef.current?.wave();
    prevDone.current = ack.done;
  }, [ack.done, mode]);

  const excited = next.kind === "upcoming" && next.minutes <= 30;
  useEffect(() => {
    handleRef.current?.setExcited(excited);
  }, [excited, mode]);

  const pct = ack.total > 0 ? Math.round((ack.done / ack.total) * 100) : 0;

  return (
    <aside className="tv-side" data-mascot={mode} data-frozen={frozen || staticMode ? "1" : "0"}>
      <div className={`tv-bubble${excited ? " is-soon" : ""}`}>
        {next.kind === "upcoming" ? (
          <>
            <div className="tv-bubble-when">{untilText(next.minutes)}</div>
            <div className="tv-bubble-what">{next.title}</div>
            <div className="tv-bubble-where">
              {next.place} · {next.start} น.
            </div>
          </>
        ) : next.kind === "now" ? (
          <>
            <div className="tv-bubble-when">กำลังดำเนินการ</div>
            <div className="tv-bubble-what">{next.title}</div>
            <div className="tv-bubble-where">
              {next.place} · ถึง {next.end} น.
            </div>
          </>
        ) : next.kind === "done" ? (
          <>
            <div className="tv-bubble-when">งานวันนี้ครบแล้ว</div>
            <div className="tv-bubble-what">ขอบคุณทุกคนครับ พักสายตาบ้างนะ</div>
          </>
        ) : (
          <>
            <div className="tv-bubble-when">วันนี้ไม่มีงานตามแผน</div>
            <div className="tv-bubble-what">มีงานใหม่เมื่อไหร่ ผมจะบอกตรงนี้ครับ</div>
          </>
        )}
      </div>

      <div className="tv-stage">
        <div className="tv-stage-glow" />
        {mode === "still" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="tv-stage-still" src="/monitor/mascot-2.png" alt="มาสคอตผู้ช่วยงาน ปชส." />
        ) : (
          <canvas ref={canvasRef} className="tv-stage-canvas" aria-label="มาสคอตผู้ช่วยงาน ปชส." />
        )}
      </div>

      {ack.total > 0 ? (
        <div className="tv-ackbox">
          <div className="tv-ackbox-row">
            <span>รับทราบงานวันนี้แล้ว</span>
            <b>
              {ack.done}/{ack.total}
            </b>
          </div>
          <div className="tv-ackbar">
            <i style={{ width: `${pct}%` }} />
          </div>
          {ack.pending > 0 || ack.unavailable > 0 ? (
            <small>
              {ack.pending > 0 ? `ยังไม่รับทราบ ${ack.pending}` : ""}
              {ack.pending > 0 && ack.unavailable > 0 ? " · " : ""}
              {ack.unavailable > 0 ? `ไม่สะดวก ${ack.unavailable} (ต้องหาคนแทน)` : ""}
            </small>
          ) : (
            <small>รับทราบครบทุกคนแล้ว</small>
          )}
        </div>
      ) : null}
    </aside>
  );
}
