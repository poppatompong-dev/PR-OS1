"use client";

// TV header: team output this month + how fast the team acknowledges
// (owner, 3 Nov 2026). Numbers count up, the ring fills; still TVs and
// reduced-motion get the final numbers with no movement.

import { useEffect, useRef, useState } from "react";
import type { TeamStats } from "@/lib/monitor/team-stats";

function useCountUp(target: number, animate: boolean): number {
  const [v, setV] = useState(animate ? 0 : target);
  const from = useRef(0);
  useEffect(() => {
    if (!animate) {
      setV(target);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / 1400);
      const e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(a + (target - a) * e));
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, animate]);
  return v;
}

export function TeamPulse({ still }: { still: boolean }) {
  const [s, setS] = useState<TeamStats | null>(null);
  const [motion, setMotion] = useState(!still);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setMotion(false);
  }, []);
  useEffect(() => {
    const load = () =>
      fetch("/api/monitor/stats")
        .then((r) => (r.ok ? r.json() : null))
        .then((j: TeamStats | null) => j && j.month && setS(j))
        .catch(() => undefined);
    load();
    const id = window.setInterval(load, 10 * 60_000);
    return () => window.clearInterval(id);
  }, []);

  const jobs = useCountUp(s?.month.jobs ?? 0, motion);
  const rate = useCountUp(s?.ack.rate ?? 0, motion);
  if (!s) return null;

  const R = 26;
  const C = 2 * Math.PI * R;
  const hasAck = s.ack.rate !== null;
  return (
    <div className={`bm-pulse${motion ? " is-live" : ""}`} aria-label="สถิติทีม">
      <div className="bm-pulse-item">
        <span className="bm-pulse-ic" aria-hidden="true">📸</span>
        <div>
          <b>{jobs}<small> งาน</small></b>
          <span>ออกงาน {s.month.label} · {s.month.slots} คน-ครั้ง</span>
        </div>
      </div>
      {hasAck ? (
        <div className="bm-pulse-item">
          <svg className="bm-ring" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r={R} className="bm-ring-bg" />
            <circle cx="32" cy="32" r={R} className="bm-ring-fg" strokeDasharray={C} strokeDashoffset={C * (1 - rate / 100)} />
          </svg>
          <div>
            <b>{rate}<small>%</small></b>
            <span>รับทราบ 7 วัน{s.ack.medianMin !== null ? ` · เฉลี่ย ~${s.ack.medianMin} นาที` : ""}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
