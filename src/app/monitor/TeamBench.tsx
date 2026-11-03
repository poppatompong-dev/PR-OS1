"use client";

// ม้านั่งทีม (owner chose layout B, 3 Nov 2026): the team standing in a row
// in the right column's empty slots, badges above their heads, a 📸 when they
// are out on a job today. One face hops every ~20 s. Shown only when there is
// room — real jobs always win the space.

import { useEffect, useRef, useState } from "react";
import type { BadgeKey, Bench } from "@/lib/monitor/badges";
import { avatarUrl, hasAvatar } from "@/lib/avatars";

const ICON: Record<BadgeKey, string> = { job5: "🏅", job10: "🏅", job15: "🏅", fast: "⚡", help: "🤝", self: "✍️" };

export function TeamBench({ span, still }: { span: number; still: boolean }) {
  const [bench, setBench] = useState<Bench | null>(null);
  const [hop, setHop] = useState<number>(-1);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/monitor/team")
        .then((r) => (r.ok ? r.json() : null))
        .then((j: Bench | null) => j && Array.isArray(j.people) && setBench(j))
        .catch(() => undefined);
    load();
    const id = window.setInterval(load, 10 * 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (still || !bench?.people.length) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setHop(Math.floor(Math.random() * bench.people.length)), 20_000);
    return () => window.clearInterval(id);
  }, [still, bench]);

  if (!bench?.people.length) return <div className="bm-day is-blank" style={{ gridRow: `span ${span}` }} />;
  return (
    <div className={`bm-bench span-${Math.min(span, 4)}${span === 1 ? " is-short" : ""}`} style={{ gridRow: `span ${span}` }} ref={box} aria-label="ทีม ปชส.">
      <div className="bm-bench-head">
        <span>🧑‍🤝‍🧑 ทีม ปชส.</span>
        <small>เหรียญเดือน {bench.monthLabel}</small>
      </div>
      <div className="bm-bench-row">
        {bench.people.map((p, i) => (
          <div className={`bm-bench-p${i === hop ? " is-hop" : ""}`} key={`${p.personId}-${i === hop ? hop : "x"}`}>
            {p.badges.length ? (
              <div className="bm-medals">
                {p.badges.map((b) => (
                  <span className={`bm-medal m-${b}`} key={b}>
                    {ICON[b]}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="bm-bench-face">
              {!p.avatarOff && hasAvatar(p.personId) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl(p.personId)} alt="" />
              ) : (
                <span className="bm-bench-initial">{p.name.replace(/^พี่/, "").charAt(0)}</span>
              )}
              {p.out ? <span className="bm-bench-out">📸</span> : null}
            </div>
            <b className="bm-bench-name">{p.name}</b>
          </div>
        ))}
      </div>
      <div className="bm-bench-bar" />
    </div>
  );
}
