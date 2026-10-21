// Lists for the LINE "add job" form: who can be assigned, roles, places.
// Auth: the caller's LINE ID token (see src/lib/liff/auth.ts).

import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { DEMO_WRITE_MESSAGE } from "@/lib/demo-guard";
import { createAdminClient } from "@/lib/supabase/server";
import { authenticateLiff } from "@/lib/liff/auth";
import { avatarUrl } from "@/lib/avatars";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: DEMO_WRITE_MESSAGE }, { status: 503 });
  const admin = createAdminClient();
  const auth = await authenticateLiff(request, admin);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const [people, roles, locations, displayProfiles] = await Promise.all([
    admin.from("people").select("id, display_name, position").eq("is_active", true).order("display_name"),
    admin.from("roles").select("id, name").eq("is_active", true).order("name"),
    admin.from("locations").select("id, name").eq("is_active", true).order("name"),
    // A TV-screen account is not someone who goes out on a job (found in the 21 Oct test).
    admin.from("profiles").select("person_id").eq("role", "display").not("person_id", "is", null),
  ]);
  const notAssignable = new Set((displayProfiles.data ?? []).map((p) => p.person_id as string));

  return NextResponse.json({
    me: { id: auth.caller.personId, name: auth.caller.displayName },
    people: (people.data ?? []).filter((p) => !notAssignable.has(p.id)).map((p) => ({ id: p.id, name: p.display_name, position: p.position, avatar: avatarUrl(p.id) })),
    roles: (roles.data ?? []).map((r) => ({ id: r.id, name: r.name })),
    locations: (locations.data ?? []).map((l) => ({ id: l.id, name: l.name })),
  });
}
