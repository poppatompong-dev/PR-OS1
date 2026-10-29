// The drawn job icon (owner, 29 Oct 2026: แบบ 2 ไอคอนวาด): a glossy tile in the
// job type's colours with a white line glyph. Used on the TV and the web;
// Telegram shows the same type as an emoji (lib/events/job-icon.ts).

import type { CSSProperties } from "react";
import {
  Baby, Bike, BrushCleaning, Camera, Droplet, Flame, Flower2, Footprints, GraduationCap, HandHeart, HeartPulse,
  Landmark, Mic, Music, PartyPopper, Presentation, Sailboat, Scissors, Trees, Trophy, Utensils, type LucideIcon,
} from "lucide-react";
import { jobIcon, type JobIconKey } from "@/lib/events/job-icon";

const GLYPHS: Record<JobIconKey, LucideIcon> = {
  boat: Sailboat, bike: Bike, run: Footprints, lotus: Flower2, merit: HandHeart, royal: Landmark, blood: Droplet,
  health: HeartPulse, kids: Baby, sport: Trophy, tree: Trees, clean: BrushCleaning, fire: Flame, training: GraduationCap,
  meeting: Mic, exhibit: Presentation, music: Music, festival: PartyPopper, food: Utensils, open: Scissors, photo: Camera,
};

/** `size` is any CSS length, so the TV can pass calc(… * var(--u)). */
export function JobIconTile({ title, icon, size = "40px", className = "" }: { title: string; icon?: string | null; size?: string; className?: string }) {
  const i = jobIcon(title, icon);
  const Glyph = GLYPHS[i.key];
  const style = { "--jit-size": size, "--jit-a": i.colors[0], "--jit-b": i.colors[1] } as CSSProperties;
  return (
    <span className={`jit ${className}`} style={style} role="img" aria-label={i.label} title={i.label}>
      <Glyph aria-hidden="true" strokeWidth={2.1} />
    </span>
  );
}
