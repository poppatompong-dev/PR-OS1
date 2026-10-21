"use client";

import { useEffect, useRef, useState } from "react";
import { pickPose, poseVideo, POSE_LABEL, type MascotPose } from "@/lib/monitor/mascot-pose";

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

/** How long a reaction (wave / celebrate after a new acknowledgement or job) stays on. */
const REACTION_MS = 12_000;

/**
 * The side column of /monitor?v=3d: the mascot announces the next job and
 * counts today's acknowledgements. It never takes room from the job list —
 * it lives in its own grid column.
 *
 * The mascot is a pre-rendered video loop per pose (lib/monitor/mascot-pose.ts),
 * not live 3D: a Smart TV browser plays a small MP4 smoothly where WebGL
 * stutters. ?static=1, or a video that will not play, shows the poster still.
 */
export function MascotSide({
  next,
  ack,
  staticMode,
  minutes,
  todayCount,
  ready,
}: {
  next: SideNext;
  ack: SideAck;
  staticMode: boolean;
  /** Minutes since midnight, Bangkok (drives the morning greeting). */
  minutes: number;
  /** Number of jobs on today's list (a rise = a new job → wave). */
  todayCount: number;
  /** The job list has loaded at least once — before that, counts are 0 and a rise means nothing. */
  ready: boolean;
}) {
  const [reaction, setReaction] = useState<"ack" | "added" | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // React to what happens while the screen is up — not on the first load,
  // which would wave at every count.
  const prevDone = useRef<number | null>(null);
  const prevCount = useRef<number | null>(null);
  useEffect(() => {
    if (!ready) return;
    let kind: "ack" | "added" | null = null;
    if (prevDone.current !== null && ack.done > prevDone.current) kind = "ack";
    else if (prevCount.current !== null && todayCount > prevCount.current) kind = "added";
    prevDone.current = ack.done;
    prevCount.current = todayCount;
    if (!kind) return;
    setReaction(kind);
    const id = window.setTimeout(() => setReaction(null), REACTION_MS);
    return () => window.clearTimeout(id);
  }, [ack.done, todayCount, ready]);

  const pose: MascotPose = pickPose({
    next: next.kind === "upcoming" ? { kind: "upcoming", minutes: next.minutes } : { kind: next.kind },
    ack,
    minutes,
    justAcknowledged: reaction === "ack",
    justAdded: reaction === "added",
  });
  const media = poseVideo(pose);

  // A new pose = new sources; some TV browsers need an explicit play().
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.load();
    v.play().catch(() => {
      /* autoplay refused: the poster stays, which is fine */
    });
  }, [media.mp4]);

  const excited = next.kind === "upcoming" && next.minutes <= 30;
  const pct = ack.total > 0 ? Math.round((ack.done / ack.total) * 100) : 0;

  return (
    <aside className="tv-side" data-pose={pose}>
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
        {staticMode || videoFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="tv-stage-media" src={media.poster} alt={`มาสคอตผู้ช่วยงาน ปชส. — ${POSE_LABEL[pose]}`} />
        ) : (
          <video
            ref={videoRef}
            className="tv-stage-media"
            poster={media.poster}
            muted
            autoPlay
            loop
            playsInline
            preload="auto"
            disablePictureInPicture
            aria-label={`มาสคอตผู้ช่วยงาน ปชส. — ${POSE_LABEL[pose]}`}
          >
            <source src={media.mp4} type="video/mp4" />
            {/* the last source failing = nothing playable here: show the still */}
            <source src={media.webm} type="video/webm" onError={() => setVideoFailed(true)} />
          </video>
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
