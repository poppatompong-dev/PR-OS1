"use server";

import { blockWritesInDemoMode } from "@/lib/demo-guard";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { can, getSessionUser, type AppRole } from "@/lib/auth/roles";
import { processDueNotifications } from "@/lib/notifications/queue";
import { env, isLineMessagingConfigured } from "@/lib/env";
import {
  createRichMenu,
  deleteRichMenu,
  listRichMenuIds,
  setDefaultRichMenu,
  uploadRichMenuImage,
} from "@/lib/line/api";
import { RICH_MENU_IMAGE_PATH, richMenuDefinition } from "@/lib/line/rich-menu";

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
  doneAt("/settings", error, notice);
}

/** Only pages under /settings may be returned to (the forms post a returnTo). */
function settingsPath(value: FormDataEntryValue | null): string {
  const raw = String(value ?? "");
  return /^\/settings(\/[A-Za-z0-9/_-]*)?$/.test(raw) ? raw : "/settings";
}

function doneAt(path: string, error?: string, notice?: string): never {
  if (error) redirect(`${path}?error=${encodeURIComponent(error)}`);
  if (notice) redirect(`${path}?notice=${encodeURIComponent(notice)}`);
  redirect(path);
}

export async function addPerson(formData: FormData) {
  await blockWritesInDemoMode();
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
  await blockWritesInDemoMode();
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
  await blockWritesInDemoMode();
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
  await blockWritesInDemoMode();
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
  await blockWritesInDemoMode();
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
  await blockWritesInDemoMode();
  await requireAdmin();
  // Note: don't call done()/redirect() inside this try block — Next.js
  // implements redirect() by throwing, and a catch here would swallow it.
  let notice: string | undefined;
  let error: string | undefined;
  try {
    const summary = await processDueNotifications();
    notice =
      `ประมวลผล ${summary.processed} รายการ — ส่งแล้ว ${summary.sent}, ล้มเหลว ${summary.failed}, ข้าม ${summary.skipped}` +
      (summary.dailySummaries ? ` · สรุปเช้า ${summary.dailySummaries} คน` : "") +
      (summary.adminReports ? ` · รายงานแอดมิน ${summary.adminReports}` : "") +
      (summary.quotaRemaining !== null ? ` · โควต้าเหลือ ${summary.quotaRemaining}` : "");
  } catch (err) {
    error = err instanceof Error ? err.message : "ประมวลผลคิวไม่สำเร็จ";
  }
  revalidatePath("/settings");
  done(error, notice);
}

export async function updateNotificationSettings(formData: FormData) {
  await blockWritesInDemoMode();
  const { supabase, user } = await requireAdmin();
  const adminIds = formData.getAll("adminPersonIds").map(String).filter(Boolean);
  const rows = [
    { key: "line_enabled", value: formData.get("lineEnabled") === "on", updated_by: user.id },
    {
      key: "line_monthly_quota",
      value: Number(formData.get("lineMonthlyQuota") ?? 300) || 300,
      updated_by: user.id,
    },
    {
      key: "same_day_reminder_enabled",
      value: formData.get("sameDayReminderEnabled") === "on",
      updated_by: user.id,
    },
    { key: "line_admin_person_ids", value: adminIds, updated_by: user.id },
  ];
  const { error } = await supabase.from("settings").upsert(rows, { onConflict: "key" });
  if (error) done(error.message);

  revalidatePath("/settings");
  done(undefined, "บันทึกการตั้งค่าการแจ้งเตือนแล้ว");
}

/**
 * Create the bot's rich menu (the button panel under the chat) and make it
 * the default for everyone. Safe to press again: old menus are removed.
 */
export async function setupLineRichMenu() {
  await blockWritesInDemoMode();
  await requireAdmin();
  if (!isLineMessagingConfigured()) done("ยังไม่ได้ตั้งค่า LINE Messaging API บน Vercel");

  let error: string | undefined;
  try {
    const old = await listRichMenuIds();
    const created = await createRichMenu(richMenuDefinition());
    if (!created.ok || !created.id) throw new Error(created.error ?? "สร้างเมนูไม่สำเร็จ");
    const img = await fetch(new URL(RICH_MENU_IMAGE_PATH, env.appBaseUrl));
    if (!img.ok) throw new Error(`โหลดรูปเมนูไม่สำเร็จ (${img.status})`);
    const up = await uploadRichMenuImage(created.id, await img.arrayBuffer());
    if (!up.ok) throw new Error(up.error);
    const def = await setDefaultRichMenu(created.id);
    if (!def.ok) throw new Error(def.error);
    for (const id of old) await deleteRichMenu(id);
  } catch (err) {
    error = err instanceof Error ? err.message : "ตั้งค่าเมนู LINE ไม่สำเร็จ";
  }
  done(error, error ? undefined : "ตั้งค่าเมนูใต้แชท LINE แล้ว (อาจใช้เวลาสักครู่กว่าจะขึ้นในมือถือ)");
}

export async function createAccount(formData: FormData) {
  await blockWritesInDemoMode();
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
  await blockWritesInDemoMode();
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

/**
 * Suspend or re-enable a sign-in account (Supabase Auth ban). A suspended user
 * cannot sign in or refresh their session; a session already open lasts until
 * its access token expires (about an hour at most). LINE messages keep going
 * to the linked person until LINE is unlinked.
 */
export async function setAccountSuspended(formData: FormData) {
  await blockWritesInDemoMode();
  const { supabase, user } = await requireAdmin();
  const back = settingsPath(formData.get("returnTo"));
  const accountId = String(formData.get("accountId") ?? "");
  const suspend = String(formData.get("suspend") ?? "") === "true";
  if (!accountId) doneAt(back, "ไม่พบบัญชี");
  if (suspend && accountId === user.id) doneAt(back, "ระงับบัญชีของตัวเองไม่ได้");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, person_id")
    .eq("id", accountId)
    .maybeSingle();

  try {
    const { createAdminClient } = await import("@/lib/supabase/server");
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(accountId, {
      ban_duration: suspend ? "876000h" : "none",
    });
    if (error) doneAt(back, `${suspend ? "ระงับ" : "เปิด"}บัญชีไม่สำเร็จ: ${error.message}`);

    if (profile?.person_id) {
      await admin.from("audit_logs").insert({
        entity_type: "person",
        entity_id: profile.person_id,
        action: suspend ? "account_suspend" : "account_unsuspend",
        changed_by: user.id,
        summary: `${suspend ? "ระงับ" : "เปิดใช้"}บัญชี ${profile.username ? `@${profile.username}` : ""}`.trim(),
        new_values: { account_id: accountId },
      });
    }
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err) throw err; // redirect()
    doneAt(back, err instanceof Error ? err.message : "ทำรายการไม่สำเร็จ");
  }

  revalidatePath("/settings");
  doneAt(
    back,
    undefined,
    suspend
      ? `ระงับบัญชี ${profile?.username ? `@${profile.username}` : ""} แล้ว — เข้าระบบใหม่ไม่ได้ และจะหลุดจากระบบภายในไม่เกิน 1 ชั่วโมง (ยังได้รับแจ้งเตือน LINE จนกว่าจะยกเลิกผูก LINE)`
      : `เปิดใช้บัญชี ${profile?.username ? `@${profile.username}` : ""} แล้ว`,
  );
}

/** Detach a person's LINE account (wrong person, new phone, or leaving the team). */
export async function unlinkPersonLine(formData: FormData) {
  await blockWritesInDemoMode();
  const { user } = await requireAdmin();
  const back = settingsPath(formData.get("returnTo"));
  const personId = String(formData.get("personId") ?? "");
  if (!personId) doneAt(back, "ไม่พบบุคคล");

  const { createAdminClient } = await import("@/lib/supabase/server");
  const admin = createAdminClient();
  const { data: person, error: readError } = await admin
    .from("people")
    .select("display_name, line_user_id")
    .eq("id", personId)
    .maybeSingle();
  if (readError) doneAt(back, readError.message);
  if (!person) doneAt(back, "ไม่พบบุคคล");
  if (!person.line_user_id) doneAt(back, `${person.display_name} ยังไม่ได้ผูก LINE`);

  const { error } = await admin.from("people").update({ line_user_id: null }).eq("id", personId);
  if (error) doneAt(back, error.message);
  await admin.from("line_chat_state").delete().eq("line_user_id", person.line_user_id);
  await admin.from("audit_logs").insert({
    entity_type: "person",
    entity_id: personId,
    action: "line_unlink",
    changed_by: user.id,
    summary: "ยกเลิกการผูกบัญชี LINE (โดยผู้ดูแลระบบ)",
  });

  revalidatePath("/settings");
  doneAt(back, undefined, `ยกเลิกผูก LINE ของ ${person.display_name} แล้ว — เจ้าตัวกด "ผูกบัญชี" ในแชทบอทใหม่ได้`);
}
