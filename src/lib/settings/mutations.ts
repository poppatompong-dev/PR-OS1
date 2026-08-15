"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { can, getSessionUser, type AppRole } from "@/lib/auth/roles";
import { processDueNotifications } from "@/lib/notifications/queue";

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

function done(error?: string, notice?: string): never {
  if (error) redirect(`/settings?error=${encodeURIComponent(error)}`);
  if (notice) redirect(`/settings?notice=${encodeURIComponent(notice)}`);
  redirect("/settings");
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
  await requireAdmin();
  // Note: don't call done()/redirect() inside this try block — Next.js
  // implements redirect() by throwing, and a catch here would swallow it.
  let notice: string | undefined;
  let error: string | undefined;
  try {
    const summary = await processDueNotifications();
    notice = `ประมวลผล ${summary.processed} รายการ — ส่งแล้ว ${summary.sent}, ล้มเหลว ${summary.failed}, ข้าม ${summary.skipped}`;
  } catch (err) {
    error = err instanceof Error ? err.message : "ประมวลผลคิวไม่สำเร็จ";
  }
  revalidatePath("/settings");
  done(error, notice);
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
    {
      key: "same_day_reminder_enabled",
      value: formData.get("sameDayReminderEnabled") === "on",
      updated_by: user.id,
    },
    {
      key: "fallback_to_email_when_line_fails",
      value: formData.get("fallbackWhenLineFails") === "on",
      updated_by: user.id,
    },
    {
      key: "fallback_to_email_when_quota_exceeded",
      value: formData.get("fallbackWhenQuotaExceeded") === "on",
      updated_by: user.id,
    },
  ];
  const { error } = await supabase.from("settings").upsert(rows, { onConflict: "key" });
  if (error) done(error.message);

  revalidatePath("/settings");
  done();
}

export async function createAccount(formData: FormData) {
  await requireAdmin();
  const usernameRaw = emptyToNull(formData.get("username"));
  const password = String(formData.get("password") ?? "").trim();
  const role = String(formData.get("role") ?? "assignee") as AppRole;
  const personId = emptyToNull(formData.get("personId"));
  const valid: AppRole[] = ["admin", "supervisor", "staff", "assignee", "display"];

  if (!usernameRaw) done("กรุณากรอกชื่อผู้ใช้ (Username)");
  if (!password || password.length < 6) done("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
  if (!valid.includes(role)) done("บทบาทไม่ถูกต้อง");

  const username = usernameRaw.toLowerCase().replace(/\s+/g, "");
  const dummyEmail = `${username}@internal.pr-os.local`;

  try {
    const { createAdminClient } = await import("@/lib/supabase/server");
    const adminSupabase = createAdminClient();

    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: dummyEmail,
      password,
      email_confirm: true,
      user_metadata: { username },
    });

    if (authError) {
      done(`สร้างบัญชีไม่สำเร็จ: ${authError.message}`);
    }

    if (authData?.user?.id) {
      const { error: profileError } = await adminSupabase
        .from("profiles")
        .upsert(
          { id: authData.user.id, username, role, person_id: personId },
          { onConflict: "id" },
        );

      if (profileError) {
        done(`บันทึกโปรไฟล์ไม่สำเร็จ: ${profileError.message}`);
      }
    }
  } catch (err) {
    done(err instanceof Error ? err.message : "สร้างบัญชีไม่สำเร็จ");
  }

  revalidatePath("/settings");
  done(undefined, `สร้างบัญชี @${username} (${role}) เรียบร้อยแล้ว`);
}

export async function updateAccount(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const accountId = String(formData.get("accountId") ?? "");
  const role = String(formData.get("role") ?? "") as AppRole;
  const personId = emptyToNull(formData.get("personId"));
  const usernameRaw = emptyToNull(formData.get("username"));
  const newPassword = String(formData.get("newPassword") ?? "").trim();
  const username = usernameRaw ? usernameRaw.toLowerCase().replace(/\s+/g, "") : null;
  const valid: AppRole[] = ["admin", "supervisor", "staff", "assignee", "display"];
  if (!accountId || !valid.includes(role)) done("ข้อมูลบทบาทไม่ถูกต้อง");

  // Safety: don't let an admin lock themselves out by self-demoting.
  if (accountId === user.id && role !== "admin") {
    done("ไม่สามารถถอนสิทธิ์ผู้ดูแลของบัญชีตัวเองได้");
  }

  // If new password provided, update it in Supabase Auth via Admin Client
  if (newPassword) {
    if (newPassword.length < 6) {
      done("รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
    }
    try {
      const { createAdminClient } = await import("@/lib/supabase/server");
      const adminSupabase = createAdminClient();
      const { error: pwdError } = await adminSupabase.auth.admin.updateUserById(accountId, {
        password: newPassword,
      });
      if (pwdError) {
        done(`เปลี่ยนรหัสผ่านไม่สำเร็จ: ${pwdError.message}`);
      }
    } catch (err) {
      done(err instanceof Error ? err.message : "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    }
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
  done(undefined, `อัปเดตบัญชี ${username ? `@${username}` : ""} เรียบร้อยแล้ว${newPassword ? " (เปลี่ยนรหัสผ่านสำเร็จ)" : ""}`);
}
