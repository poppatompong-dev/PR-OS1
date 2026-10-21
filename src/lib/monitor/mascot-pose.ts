// Which of the five mascot loops the office TV plays (owner, 21 Oct 2026:
// layout A + navy "C" background + glossy vinyl mascot, all five poses).
//
// Each pose is a 2-second loop rendered ahead of time in Blender and played
// as a small MP4 (public/monitor/mascot/<pose>.mp4, poster <pose>.jpg): the TV
// only plays a video, it never draws 3D itself, so it stays smooth on a
// Smart TV browser. Pure function, covered by tests/monitor-pose.unit.test.ts.

export const MASCOT_POSES = ["idle", "wave", "announce", "point", "celebrate"] as const;
export type MascotPose = (typeof MASCOT_POSES)[number];

export const POSE_LABEL: Record<MascotPose, string> = {
  idle: "ยืนรอ",
  wave: "โบกมือทักทาย",
  announce: "ยกโทรโข่งประกาศ",
  point: "ชี้ไปที่รายการ",
  celebrate: "ดีใจ",
};

export type PoseInput = {
  /** What the side column shows: the next job, one running now, all done, or nothing today. */
  next:
    | { kind: "upcoming"; minutes: number }
    | { kind: "now" }
    | { kind: "done" }
    | { kind: "none" };
  ack: { total: number; done: number; pending: number; unavailable: number };
  /** Minutes since midnight, Bangkok. */
  minutes: number;
  /** Someone acknowledged in the last few seconds (the screen saw the count go up). */
  justAcknowledged?: boolean;
  /** A new job appeared on today's list in the last few seconds. */
  justAdded?: boolean;
};

/** The job is close enough that the mascot announces it (same 1.5 h as the LINE reminder). */
export const ANNOUNCE_WITHIN_MIN = 90;
const MORNING = { from: 7 * 60, to: 9 * 60 };

export function pickPose(p: PoseInput): MascotPose {
  const allIn = p.ack.total > 0 && p.ack.pending === 0 && p.ack.unavailable === 0;
  const outstanding = p.ack.pending > 0 || p.ack.unavailable > 0;
  // Short reactions to something that just happened on screen.
  if (p.justAcknowledged) return allIn ? "celebrate" : "wave";
  if (p.justAdded) return "wave";
  // The approved order: a job about to start > good morning > someone still to acknowledge > all done.
  if (p.next.kind === "upcoming" && p.next.minutes <= ANNOUNCE_WITHIN_MIN) return "announce";
  if (p.minutes >= MORNING.from && p.minutes < MORNING.to) return "wave";
  if (outstanding) return "point";
  if (allIn || p.next.kind === "done") return "celebrate";
  return "idle";
}

/** H.264 first (every TV decodes it in hardware), VP9 WebM for browsers without H.264. */
export function poseVideo(pose: MascotPose) {
  return {
    mp4: `/monitor/mascot/${pose}.mp4`,
    webm: `/monitor/mascot/${pose}.webm`,
    poster: `/monitor/mascot/${pose}.jpg`,
  };
}
