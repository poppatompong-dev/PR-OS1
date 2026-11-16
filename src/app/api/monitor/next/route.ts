import { NextResponse } from "next/server";
import { addDays, todayInBangkok } from "@/lib/date";
import { createAdminClient } from "@/lib/supabase/server";
import { showcase } from "@/lib/monitor/showcase";
import { nickname } from "@/lib/monitor/nicknames";

// หน้า Home กล่องทีวี (owner chose แบบ C, 16 Nov 2026): the next job still to come
// and the municipality's news photos, in one small call the box can afford.
// Public like the rest of /api/monitor: title, time, place and nicknames only.
export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */
function bangkokHm(now = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
}

export async function GET() {
  try {
    const admin = createAdminClient();
    const today = todayInBangkok();
    const hm = bangkokHm();
    const [{ data: evs }, news] = await Promise.all([
      admin
        .from("events")
        .select("id, title, screen_title, event_date, start_time, end_time, location:locations(name)")
        .eq("status", "published")
        .is("deleted_at", null)
        .gte("event_date", today)
        .lte("event_date", addDays(today, 60))
        .order("event_date")
        .order("start_time")
        .limit(20),
      showcase().catch(() => []),
    ]);
    const rows = (evs ?? []) as any[];
    // Still to come: later days, or today's jobs that have not ended yet.
    const next = rows.find((e) => e.event_date > today || String(e.end_time || e.start_time || "").slice(0, 5) >= hm) ?? null;
    let people: string[] = [];
    if (next) {
      const { data: asg } = await admin.from("assignments").select("person_id, person:people(display_name)").eq("event_id", next.id).eq("assignment_status", "assigned");
      people = ((asg ?? []) as any[]).map((a) => nickname(a.person_id, String(a.person?.display_name ?? ""))).filter(Boolean);
    }
    return NextResponse.json(
      {
        today,
        next: next
          ? {
              title: String(next.screen_title || next.title),
              date: next.event_date,
              start: String(next.start_time ?? "").slice(0, 5),
              place: String(next.location?.name ?? ""),
              people,
            }
          : null,
        news: (news as Array<{ title: string; image?: string | null }>).filter((n) => n.image).slice(0, 12).map((n) => ({ title: n.title, image: n.image })),
      },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } },
    );
  } catch {
    return NextResponse.json({ next: null, news: [] }, { status: 503 });
  }
}
