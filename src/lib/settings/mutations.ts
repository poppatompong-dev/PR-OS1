"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { can, getSessionUser, type AppRole } from "@/lib/auth/roles";

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

async function requireAdmin() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/login");
  if (!can.managePeople(user.role)) {
    redirect(`/settings?error=${encodeURIComponent("เฉพาะผู้ดูแลระบบเท่านั้น")}`);
  }
  return { supabase, user };
}

function done(error?: string): never {
  redirect(error ? `/settings?error=${encodeURIComponent(error)}` : "/settings");
}

export async function addPerson(formData: FormData) {
  const { supabase } = await requireAdmin();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const position = emptyToNull(formData.get("position"));
  const email = emptyToNull(formData.get("email"));
  if (!displayName) done("กรุณากรอกชื่อ-สกุล");

  const { error } = await supabase
    .from("people")
    .insert({ display_name: displayName, position, email, is_active: true });
  if (error) done(error.message);

  revalidatePath("/settings");
  done();
}

export async function updatePerson(formData: FormData) {
  const { supabase } = await requireAdmin();
  const personId = String(formData.get("personId") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!personId || !displayName) done("ข้อมูลไม่ครบ");

  const { error } = await supabase
    .from("people")
    .update({
      display_name: displayName,
      position: emptyToNull(formData.get("position")),
      email: emptyToNull(formData.get("email")),
    })
    .eq("id", personId);
  if (error) done(error.message);

  revalidatePath("/settings");
  done();
}

export async function setPersonActive(formData: FormData) {
  const { supabase } = await requireAdmin();
  const personId = String(formData.get("personId") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!personId) done("ไม่พบบุคคล");

  const { error } = await supabase
    .from("people")
    .update({ is_active: active })
    .eq("id", personId);
  if (error) done(error.message);

  revalidatePath("/settings");
  done();
}

const MASTER_TABLES = ["departments", "locations", "event_types", "roles"] as const;
type MasterTable = (typeof MASTER_TABLES)[number];

export async function addMasterItem(formData: FormData) {
  const { supabase } = await requireAdmin();
  const table = String(formData.get("table") ?? "") as MasterTable;
  if (!MASTER_TABLES.includes(table)) done("ตารางไม่ถูกต้อง");
  const name = String(formData.get("name") ?? "").trim();
  const extra = emptyToNull(formData.get("extra"));
  if (!name) done("กรุณากรอกชื่อ");

  const row: Record<string, unknown> = { name, is_active: true };
  if (table === "departments") row.short_name = extra;
  else if (table === "locations") row.description = extra;
  else if (table === "event_types") row.color = extra ?? "blue";
  else if (table === "roles") {
    row.code = extra ?? name.toLowerCase().replace(/\s+/g, "_");
    row.color = "blue";
  }

  const { error } = await supabase.from(table).insert(row);
  if (error) done(error.message);

  revalidatePath("/settings");
  done();
}

export async function setMasterActive(formData: FormData) {
  const { supabase } = await requireAdmin();
  const table = String(formData.get("table") ?? "") as MasterTable;
  if (!MASTER_TABLES.includes(table)) done("ตารางไม่ถูกต้อง");
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) done("ไม่พบรายการ");

  const { error } = await supabase.from(table).update({ is_active: active }).eq("id", id);
  if (error) done(error.message);

  revalidatePath("/settings");
  done();
}

export async function processNotificationQueue() {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("process_notification_queue");
  if (error) done(error.message);
  revalidatePath("/settings");
  done();
}

export async function updateNotificationSettings(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const rows = [
    { key: "line_enabled", value: formData.get("lineEnabled") === "on", updated_by: user.id },
    { key: "email_enabled", value: formData.get("emailEnabled") === "on", updated_by: user.id },
    {
      key: "line_monthly_quota",
      value: Number(formData.get("lineMonthlyQuota") ?? 300) || 300,
      updated_by: user.id,
    },
    {
      key: "default_reminder_hours",
      value: Number(formData.get("defaultReminderHours") ?? 24) || 24,
      updated_by: user.id,
    },
  ];
  const { error } = await supabase.from("settings").upsert(rows, { onConflict: "key" });
  if (error) done(error.message);

  revalidatePath("/settings");
  done();
}

export async function updateAccount(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const accountId = String(formData.get("accountId") ?? "");
  const role = String(formData.get("role") ?? "") as AppRole;
  const personId = emptyToNull(formData.get("personId"));
  const usernameRaw = emptyToNull(formData.get("username"));
  const username = usernameRaw ? usernameRaw.toLowerCase().replace(/\s+/g, "") : null;
  const valid: AppRole[] = ["admin", "supervisor", "staff", "assignee", "display"];
  if (!accountId || !valid.includes(role)) done("ข้อมูลบทบาทไม่ถูกต้อง");

  // Safety: don't let an admin lock themselves out by self-demoting.
  if (accountId === user.id && role !== "admin") {
    done("ไม่สามารถถอนสิทธิ์ผู้ดูแลของบัญชีตัวเองได้");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role, person_id: personId, username })
    .eq("id", accountId);
  if (error) {
    done(
      error.code === "23505"
        ? "ชื่อผู้ใช้นี้ถูกใช้แล้ว กรุณาเลือกชื่ออื่น"
        : error.message,
    );
  }

  revalidatePath("/settings");
  done();
}
