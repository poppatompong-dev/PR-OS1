"use server";

// ประกาศบนจอ from the web (owner, 29 Oct 2026): anyone signed in may post;
// the author or an admin may take it down.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/roles";
import { blockWritesInDemoMode } from "@/lib/demo-guard";
import { createAnnouncement } from "@/lib/announcements";

function back(error?: string, notice?: string): never {
  const q = error ? `?error=${encodeURIComponent(error)}` : notice ? `?notice=${encodeURIComponent(notice)}` : "";
  redirect(`/announcements${q}`);
}

export async function postAnnouncement(formData: FormData) {
  await blockWritesInDemoMode();
  const user = await getSessionUser(await createClient());
  if (!user) redirect("/login");
  if (user.role === "display") back("บัญชีจอทีวีประกาศไม่ได้");
  const days = Number(formData.get("days") ?? 0);
  const res = await createAnnouncement(createAdminClient(), {
    text: String(formData.get("message") ?? ""),
    personId: user.personId,
    authorName: user.displayName ?? "เจ้าหน้าที่",
    source: "web",
    days: Number.isFinite(days) ? days : 0,
  });
  if (!res.ok) back(res.error);
  revalidatePath("/announcements");
  back(undefined, "ขึ้นจอแล้ว (ภายใน 1 นาที)");
}

export async function removeAnnouncement(formData: FormData) {
  await blockWritesInDemoMode();
  const user = await getSessionUser(await createClient());
  if (!user) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const admin = createAdminClient();
  const { data: row } = await admin.from("tv_announcements").select("id, author_person_id").eq("id", id).maybeSingle();
  if (!row) back("ไม่พบประกาศนี้");
  if (user.role !== "admin" && row.author_person_id !== user.personId) back("ลบได้เฉพาะประกาศของตัวเอง (หรือแอดมิน)");
  await admin.from("tv_announcements").update({ deleted_at: new Date().toISOString(), deleted_by: user.id }).eq("id", id);
  revalidatePath("/announcements");
  back(undefined, "เอาลงจากจอแล้ว");
}
