"use server";

import { blockWritesInDemoMode } from "@/lib/demo-guard";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { can, getSessionUser, UI_ROLES, type AppRole } from "@/lib/auth/roles";
import { initialPassword, normalizeUsername } from "@/lib/settings/team";
import { processDueNotifications } from "@/lib/notifications/queue";
import { env, isLineMessagingConfigured } from "@/lib/env";
import {
  createRichMenu,
  deleteRichMenu,
  getFriendStatus,
  listRichMenuIds,
  setDefaultRichMenu,
  uploadRichMenuImage,
} from "@/lib/line/api";
import { getPendingRegistrations, savePendingRegistrations } from "@/lib/line/data";
import { removePendingRegistration } from "@/lib/line/registrations";
import { sendTelegramInvite } from "@/lib/telegram/invite";
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

/** redirect() works by throwing; a catch around it must let it through. */
function rethrowRedirect(err: unknown) {
  if (err && typeof err === "object" && "digest" in err) throw err;
}

/**
 * Back to /settings showing the new account. Only the username travels in the
 * URL; the page works out the initial password from it, so no password ends
 * up in browser history or request logs.
 */
function doneAdded(username: string): never {
  redirect(`/settings?added=${encodeURIComponent(username)}`);
}

const ALL_ROLES: AppRole[] = ["admin", "supervisor", "staff", "assignee", "display"];

function isDuplicateUser(message: string | undefined) {
  return /already|registered|exists|duplicate/i.test(message ?? "");
}

async function usernameTaken(username: string): Promise<boolean> {
  const { createAdminClient } = await import("@/lib/supabase/server");
  const { data } = await createAdminClient().from("profiles").select("id").eq("username", username).maybeSingle();
  return Boolean(data);
}

/**
 * Create the sign-in user and its profile. Returns the new user id, or an
 * error message in Thai. Never redirects, so callers can roll back first.
 */
async function createSignIn(
  username: string,
  password: string,
  role: AppRole,
  personId: string | null,
): Promise<{ id: string } | { error: string }> {
  const { createAdminClient } = await import("@/lib/supabase/server");
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: `${username}@internal.pr-os.local`,
    password,
    email_confirm: true,
    user_metadata: { username },
  });
  if (error || !data?.user?.id) {
    return {
      error: isDuplicateUser(error?.message)
        ? `ชื่อผู้ใช้ @${username} มีคนใช้แล้ว กรุณาเลือกชื่ออื่น`
        : `สร้างบัญชีไม่สำเร็จ: ${error?.message ?? "ไม่ทราบสาเหตุ"}`,
    };
  }
  const { error: profileError } = await admin
    .from("profiles")
    .upsert({ id: data.user.id, username, role, person_id: personId }, { onConflict: "id" });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return {
      error:
        profileError.code === "23505"
          ? `ชื่อผู้ใช้ @${username} มีคนใช้แล้ว กรุณาเลือกชื่ออื่น`
          : `บันทึกโปรไฟล์ไม่สำเร็จ: ${profileError.message}`,
    };
  }
  return { id: data.user.id };
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
  // Admin recipients are set per person in the team table (setAdminWatcher).
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

/**
 * Create a sign-in account. With no password given (the "สร้างบัญชี" action on
 * a person in the team table) the owner's rule applies: the initial password
 * is the username, or the username + "123" when that is under 6 characters.
 */
export async function createAccount(formData: FormData) {
  await blockWritesInDemoMode();
  await requireAdmin();
  const username = normalizeUsername(formData.get("username"));
  const typed = String(formData.get("password") ?? "").trim();
  const role = String(formData.get("role") ?? "supervisor") as AppRole;
  const personId = emptyToNull(formData.get("personId"));

  if (!username) done("ชื่อผู้ใช้ใช้ได้เฉพาะ a-z, 0-9, . _ - ยาว 3–30 ตัว (เช่น ชื่อเล่นภาษาอังกฤษ)");
  if (typed && typed.length < 6) done("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
  if (!ALL_ROLES.includes(role)) done("บทบาทไม่ถูกต้อง");
  if (await usernameTaken(username)) done(`ชื่อผู้ใช้ @${username} มีคนใช้แล้ว กรุณาเลือกชื่ออื่น`);

  const result = await createSignIn(username, typed || initialPassword(username), role, personId);
  if ("error" in result) done(result.error);

  revalidatePath("/settings");
  if (typed) done(undefined, `สร้างบัญชี @${username} เรียบร้อยแล้ว`);
  doneAdded(username);
}

/**
 * "+ เพิ่มคน": the person and their sign-in in one step. If the sign-in cannot
 * be created, the person row just added is removed again.
 */
export async function addTeamMember(formData: FormData) {
  await blockWritesInDemoMode();
  await requireAdmin();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const position = emptyToNull(formData.get("position"));
  const username = normalizeUsername(formData.get("username"));
  const role = String(formData.get("role") ?? "supervisor") as AppRole;

  if (!displayName) done("กรุณากรอกชื่อ-สกุล");
  if (!username) done("ชื่อผู้ใช้ใช้ได้เฉพาะ a-z, 0-9, . _ - ยาว 3–30 ตัว (เช่น ชื่อเล่นภาษาอังกฤษ)");
  if (!UI_ROLES.includes(role)) done("สิทธิ์ไม่ถูกต้อง");
  if (await usernameTaken(username)) done(`ชื่อผู้ใช้ @${username} มีคนใช้แล้ว กรุณาเลือกชื่ออื่น`);

  const { createAdminClient } = await import("@/lib/supabase/server");
  const admin = createAdminClient();
  const { data: person, error: personError } = await admin
    .from("people")
    .insert({ display_name: displayName, position, is_active: true })
    .select("id")
    .single();
  if (personError || !person) done(`เพิ่มรายชื่อไม่สำเร็จ: ${personError?.message ?? "ไม่ทราบสาเหตุ"}`);

  const result = await createSignIn(username, initialPassword(username), role, person.id);
  if ("error" in result) {
    await admin.from("people").delete().eq("id", person.id);
    done(result.error);
  }

  revalidatePath("/settings");
  doneAdded(username);
}

/** ⋯ → เปลี่ยนรหัสผ่าน */
export async function changeAccountPassword(formData: FormData) {
  await blockWritesInDemoMode();
  await requireAdmin();
  const accountId = String(formData.get("accountId") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "").trim();
  if (!accountId) done("ไม่พบบัญชี");
  if (newPassword.length < 6) done("รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร");

  try {
    const { createAdminClient } = await import("@/lib/supabase/server");
    const { error } = await createAdminClient().auth.admin.updateUserById(accountId, { password: newPassword });
    if (error) done(`เปลี่ยนรหัสผ่านไม่สำเร็จ: ${error.message}`);
  } catch (err) {
    rethrowRedirect(err);
    done(err instanceof Error ? err.message : "เปลี่ยนรหัสผ่านไม่สำเร็จ");
  }
  done(undefined, "เปลี่ยนรหัสผ่านแล้ว — แจ้งรหัสใหม่ให้เจ้าตัวทางแชทส่วนตัว");
}

/** ⋯ → เปลี่ยนสิทธิ์ (one of the three levels). */
export async function changeAccountRole(formData: FormData) {
  await blockWritesInDemoMode();
  const { supabase, user } = await requireAdmin();
  const accountId = String(formData.get("accountId") ?? "");
  const role = String(formData.get("role") ?? "") as AppRole;
  if (!accountId || !UI_ROLES.includes(role)) done("สิทธิ์ไม่ถูกต้อง");
  if (accountId === user.id && role !== "admin") done("ไม่สามารถถอนสิทธิ์ผู้ดูแลของบัญชีตัวเองได้");

  const { error } = await supabase.from("profiles").update({ role }).eq("id", accountId);
  if (error) done(error.message);
  revalidatePath("/settings");
  done(undefined, "เปลี่ยนสิทธิ์แล้ว — มีผลเมื่อเจ้าตัวเปิดหน้าใหม่");
}

/** ⋯ → รับแจ้งเตือนฝั่งแอดมิน (settings line_admin_person_ids). */
export async function setAdminWatcher(formData: FormData) {
  await blockWritesInDemoMode();
  const { supabase, user } = await requireAdmin();
  const personId = String(formData.get("personId") ?? "");
  const on = String(formData.get("on") ?? "") === "true";
  if (!personId) done("ไม่พบบุคคล");

  const { data } = await supabase.from("settings").select("value").eq("key", "line_admin_person_ids").maybeSingle();
  const current = Array.isArray(data?.value) ? (data.value as unknown[]).map(String) : [];
  const next = on ? [...new Set([...current, personId])] : current.filter((id) => id !== personId);
  const { error } = await supabase
    .from("settings")
    .upsert({ key: "line_admin_person_ids", value: next, updated_by: user.id }, { onConflict: "key" });
  if (error) done(error.message);
  revalidatePath("/settings");
  done(undefined, on ? "เพิ่มเป็นผู้ติดตามงานแล้ว — จะได้รายงาน 17:00 และแจ้งเตือนเมื่อมีคนกดไม่สะดวก" : "เลิกรับแจ้งเตือนฝั่งแอดมินแล้ว");
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
      rethrowRedirect(err);
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
      // A suspended person also stops getting LINE and leaves the assignment pickers.
      await admin.from("people").update({ is_active: !suspend }).eq("id", profile.person_id);
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
    rethrowRedirect(err);
    doneAt(back, err instanceof Error ? err.message : "ทำรายการไม่สำเร็จ");
  }

  revalidatePath("/settings");
  doneAt(
    back,
    undefined,
    suspend
      ? `ระงับบัญชี ${profile?.username ? `@${profile.username}` : ""} แล้ว — เข้าระบบใหม่ไม่ได้ (ที่เปิดค้างไว้หลุดภายในไม่เกิน 1 ชั่วโมง) หยุดส่ง LINE และไม่อยู่ในรายชื่อให้มอบหมายงาน`
      : `เปิดใช้บัญชี ${profile?.username ? `@${profile.username}` : ""} แล้ว — กลับมาอยู่ในรายชื่อให้มอบหมายงานและรับ LINE ตามเดิม`,
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

/**
 * Admin says who a LINE account from the group registration is. The person
 * never signs in: this is the whole link (owner, 20 Oct 2026).
 */
export async function confirmLineRegistration(formData: FormData) {
  await blockWritesInDemoMode();
  const { user } = await requireAdmin();
  const lineUserId = String(formData.get("lineUserId") ?? "");
  const personId = String(formData.get("personId") ?? "");
  if (!lineUserId) done("ไม่พบรายการลงทะเบียน");
  if (!personId) done("กรุณาเลือกว่า LINE นี้เป็นของใคร");

  const { createAdminClient } = await import("@/lib/supabase/server");
  const admin = createAdminClient();
  const pending = await getPendingRegistrations(admin);
  const entry = pending.find((r) => r.lineUserId === lineUserId);
  if (!entry) done("รายการนี้ถูกยืนยันหรือลบไปแล้ว");

  const { data: person, error: readError } = await admin
    .from("people")
    .select("display_name, line_user_id, is_active")
    .eq("id", personId)
    .maybeSingle();
  if (readError) done(readError.message);
  if (!person) done("ไม่พบบุคลากรที่เลือก");
  if (person.is_active === false) done(`${person.display_name} ถูกระงับอยู่ — เปิดใช้ก่อนแล้วค่อยยืนยัน`);
  if (person.line_user_id && person.line_user_id !== lineUserId) {
    done(`${person.display_name} ผูก LINE อื่นอยู่แล้ว — กด ยกเลิกผูก LINE ของคนนี้ก่อน`);
  }

  const { error } = await admin.from("people").update({ line_user_id: lineUserId }).eq("id", personId);
  if (error) done(error.code === "23505" ? "LINE นี้ผูกกับคนอื่นอยู่แล้ว" : error.message);

  await savePendingRegistrations(admin, removePendingRegistration(pending, lineUserId), user.id);
  await admin.from("audit_logs").insert({
    entity_type: "person",
    entity_id: personId,
    action: "line_link",
    changed_by: user.id,
    summary: "ผูกจากการลงทะเบียนในกลุ่ม (แอดมินยืนยัน)",
    new_values: { line_display_name: entry.displayName },
  });

  const friend = isLineMessagingConfigured() ? await getFriendStatus(lineUserId) : "unknown";
  // Bridge to Telegram: the person gets their own link right away (one push).
  const invite =
    friend === "not_friend"
      ? "skipped"
      : await sendTelegramInvite(admin, { id: personId, displayName: person.display_name, lineUserId }).catch(() => "failed" as const);
  revalidatePath("/settings");
  done(
    undefined,
    invite === "sent"
      ? `ผูก LINE "${entry.displayName}" กับ ${person.display_name} แล้ว — บอทส่งลิงก์ Telegram ให้เจ้าตัวในแชท LINE แล้ว`
      : friend === "not_friend"
      ? `ผูก LINE "${entry.displayName}" กับ ${person.display_name} แล้ว — เจ้าตัวยังไม่ได้เพิ่มเพื่อนบอท ให้กดเพิ่มเพื่อนก่อนจึงจะได้รับแจ้งงานส่วนตัว`
      : `ผูก LINE "${entry.displayName}" กับ ${person.display_name} แล้ว — จากนี้จะได้รับแจ้งงานทาง LINE`,
  );
}

/** Drop a registration that is not one of the team (or a duplicate tap). */
export async function dismissLineRegistration(formData: FormData) {
  await blockWritesInDemoMode();
  const { user } = await requireAdmin();
  const lineUserId = String(formData.get("lineUserId") ?? "");
  if (!lineUserId) done("ไม่พบรายการลงทะเบียน");
  const { createAdminClient } = await import("@/lib/supabase/server");
  const admin = createAdminClient();
  const pending = await getPendingRegistrations(admin);
  const entry = pending.find((r) => r.lineUserId === lineUserId);
  await savePendingRegistrations(admin, removePendingRegistration(pending, lineUserId), user.id);
  revalidatePath("/settings");
  done(undefined, entry ? `ลบ "${entry.displayName}" ออกจากรายการรอยืนยันแล้ว` : "ลบแล้ว");
}


/**
 * "ส่งลิงก์ Telegram": everyone already on LINE but not yet on Telegram gets
 * their own link once (owner, 29 Oct 2026). One LINE push each.
 */
export async function inviteAllToTelegram() {
  await blockWritesInDemoMode();
  const { user } = await requireAdmin();
  const { createAdminClient } = await import("@/lib/supabase/server");
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("people")
    .select("id, display_name, line_user_id, telegram_chat_id")
    .eq("is_active", true)
    .not("line_user_id", "is", null)
    .is("telegram_chat_id", null);
  if (error) done(error.message);
  const sent: string[] = [];
  let failed = 0;
  for (const p of data ?? []) {
    const r = await sendTelegramInvite(admin, { id: p.id, displayName: p.display_name, lineUserId: p.line_user_id, telegramChatId: p.telegram_chat_id }).catch(() => "failed" as const);
    if (r === "sent") sent.push(p.display_name);
    if (r === "failed") failed++;
  }
  await admin.from("audit_logs").insert({
    entity_type: "settings",
    entity_id: user.id,
    action: "telegram_invite",
    changed_by: user.id,
    summary: `ส่งลิงก์ Telegram ทาง LINE ${sent.length} คน`,
    new_values: { sent, failed },
  });
  revalidatePath("/settings");
  done(
    undefined,
    sent.length
      ? `ส่งลิงก์ Telegram แล้ว ${sent.length} คน${failed ? ` · ส่งไม่ได้ ${failed} คน (ยังไม่ได้เพิ่มเพื่อนบอท?)` : ""}`
      : failed
        ? `ส่งไม่ได้ ${failed} คน (ยังไม่ได้เพิ่มเพื่อนบอท?)`
        : "ไม่มีใครต้องส่ง (ส่งไปแล้ววันนี้ หรือย้ายไป Telegram ครบแล้ว)",
  );
}

/** Everyone active who is on Telegram. */
async function telegramTeam() {
  const { createAdminClient } = await import("@/lib/supabase/server");
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("people")
    .select("id, display_name, telegram_chat_id, metadata")
    .eq("is_active", true)
    .not("telegram_chat_id", "is", null);
  if (error) done(error.message);
  return { admin, people: data ?? [] };
}

/**
 * "ส่งข้อความถึงทีม": one message to everyone on Telegram, free (owner, 29 Oct
 * 2026: LINE as little as possible). Never at night by accident: 21:00–06:59 refuses.
 */
export async function broadcastTelegram(formData: FormData) {
  await blockWritesInDemoMode();
  const { user } = await requireAdmin();
  const message = String(formData.get("message") ?? "").trim().slice(0, 1000);
  if (!message) done("พิมพ์ข้อความก่อนส่ง");
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", hour12: false }).format(new Date()));
  if (hour >= 21 || hour < 7) done("ไม่ส่งช่วง 21:00–07:00 น. เพื่อไม่รบกวนทีม — ส่งใหม่ตอนเช้า");
  const { sendTelegram, esc } = await import("@/lib/telegram/api");
  const { admin, people } = await telegramTeam();
  // "ถามไถ่": the same message plus 3 answer buttons (lib/telegram/pulse.ts).
  const pulse = formData.get("pulse") === "on";
  const { pulseButtons } = await import("@/lib/telegram/pulse");
  const text = `${pulse ? "💬 <b>ถามไถ่จากแอดมิน</b>" : "📣 <b>แจ้งจากแอดมิน</b>"}\n\n${esc(message)}`;
  const buttons = pulse ? pulseButtons() : undefined;
  let sent = 0;
  for (const p of people) if ((await sendTelegram(Number(p.telegram_chat_id), { text, buttons })).ok) sent++;
  await admin.from("audit_logs").insert({
    entity_type: "settings",
    entity_id: user.id,
    action: "telegram_broadcast",
    changed_by: user.id,
    summary: `ส่งข้อความถึงทีมทาง Telegram ${sent} คน`,
    new_values: { message, pulse, sent, total: people.length },
  });
  done(undefined, `ส่งทาง Telegram แล้ว ${sent}/${people.length} คน (ฟรี ไม่ใช้โควต้า LINE)`);
}

/** "ส่งภารกิจทดสอบ": each person on Telegram gets their own checklist (lib/trial.ts). */
export async function sendTrialMissions() {
  await blockWritesInDemoMode();
  await requireAdmin();
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", hour12: false }).format(new Date()));
  if (hour >= 21 || hour < 7) done("ไม่ส่งช่วง 21:00–07:00 น. — ส่งใหม่ตอนเช้า");
  const { sendTelegram } = await import("@/lib/telegram/api");
  const { tgTrial } = await import("@/lib/telegram/messages");
  const { TRIAL_STEPS, trialDone } = await import("@/lib/trial");
  const { people } = await telegramTeam();
  let sent = 0;
  let finished = 0;
  for (const p of people) {
    const d = trialDone(p.metadata);
    if (d.size >= TRIAL_STEPS.length) {
      finished++;
      continue;
    }
    if ((await sendTelegram(Number(p.telegram_chat_id), tgTrial(d, TRIAL_STEPS, p.display_name ?? undefined))).ok) sent++;
  }
  done(undefined, `ส่งภารกิจทดสอบแล้ว ${sent} คน${finished ? ` · ทำครบแล้ว ${finished} คน (ไม่ส่งซ้ำ)` : ""}`);
}

/**
 * "🎨 แจ้งว่ารูปใหม่เสร็จ" (owner, 2 Nov 2026: how does the owner know their
 * redraw is done?). Sends the person their cartoon on Telegram with
 * ใช้ / ไม่ใช้ / ส่งรูปใหม่. Free. Same night rule as the other team messages.
 */
export async function notifyAvatarReady(formData: FormData) {
  await blockWritesInDemoMode();
  const { user } = await requireAdmin();
  const personId = String(formData.get("personId") ?? "");
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", hour12: false }).format(new Date()));
  if (hour >= 21 || hour < 7) done("ไม่ส่งช่วง 21:00–07:00 น. — ส่งใหม่ตอนเช้า");
  const { hasAvatar, avatarUrl } = await import("@/lib/avatars");
  if (!hasAvatar(personId)) done("คนนี้ยังไม่มีรูปการ์ตูนในระบบ");
  const { createAdminClient } = await import("@/lib/supabase/server");
  const admin = createAdminClient();
  const { data: p } = await admin.from("people").select("display_name, telegram_chat_id").eq("id", personId).maybeSingle();
  if (!p?.telegram_chat_id) done("คนนี้ยังไม่ได้ผูก Telegram");
  const { sendTelegram } = await import("@/lib/telegram/api");
  const { tgAvatarReady } = await import("@/lib/telegram/messages");
  const url = new URL(avatarUrl(personId), env.appBaseUrl).toString();
  const res = await sendTelegram(Number(p!.telegram_chat_id), tgAvatarReady(p!.display_name, url));
  if (!res.ok) done(`ส่งไม่สำเร็จ: ${res.error ?? "ไม่ทราบสาเหตุ"}`);
  await admin.from("audit_logs").insert({
    entity_type: "person",
    entity_id: personId,
    action: "avatar_ready_sent",
    changed_by: user.id,
    summary: `แจ้งรูปการ์ตูนใหม่ทาง Telegram: ${p!.display_name}`,
  });
  done(undefined, `ส่งรูปใหม่ให้ ${p!.display_name} ดูทาง Telegram แล้ว`);
}

/**
 * "💬 ส่งข้อความถึงคนนี้" (owner, 3 Nov 2026: tell คุณกุ๊ก what was changed
 * for his request). One free Telegram message to one person, from the admin.
 * Same night rule as the team messages.
 */
export async function messagePersonTelegram(formData: FormData) {
  await blockWritesInDemoMode();
  const { user } = await requireAdmin();
  const personId = String(formData.get("personId") ?? "");
  const message = String(formData.get("message") ?? "").trim().slice(0, 1000);
  if (!message) done("พิมพ์ข้อความก่อนส่ง");
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", hour12: false }).format(new Date()));
  if (hour >= 21 || hour < 7) done("ไม่ส่งช่วง 21:00–07:00 น. — ส่งใหม่ตอนเช้า");
  const { createAdminClient } = await import("@/lib/supabase/server");
  const admin = createAdminClient();
  const { data: p } = await admin.from("people").select("display_name, telegram_chat_id").eq("id", personId).maybeSingle();
  if (!p?.telegram_chat_id) done("คนนี้ยังไม่ได้ผูก Telegram");
  const { sendTelegram, sendTelegramPhotoFile, esc } = await import("@/lib/telegram/api");
  // Optional picture (proof screenshots, a map…): sent as one photo with the text as its caption.
  const photo = formData.get("photo");
  const hasPhoto = photo instanceof File && photo.size > 0;
  if (hasPhoto && !/^image\/(jpeg|png|webp)$/.test(photo.type)) done("แนบได้เฉพาะรูป JPG / PNG / WEBP");
  if (hasPhoto && photo.size > 8 * 1024 * 1024) done("รูปใหญ่เกิน 8 MB");
  // น้องบอทชวนคุย (12 Nov 2026): "invite" asks first (buttons); "line" is today's chat line —
  // only to someone who said yes, working hours, one a day.
  const buddy = String(formData.get("buddy") ?? "");
  const { BUDDY_HEAD, buddyInvite, buddySentToday, isBuddyOn } = await import("@/lib/telegram/buddy");
  if (buddy === "invite" || buddy === "line") {
    const wd = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", weekday: "short" }).format(new Date());
    if (hour < 9 || hour >= 16 || wd === "Sat" || wd === "Sun") done("ชวนคุยส่งเฉพาะจันทร์–ศุกร์ 09:00–16:00 น.");
    if (hasPhoto) done("ชวนคุยไม่แนบรูป");
  }
  if (buddy === "line") {
    if (!(await isBuddyOn(admin, personId))) done("คนนี้ยังไม่ได้เปิดรับชวนคุย — ส่งคำชวน (invite) ก่อน");
    if (await buddySentToday(admin, personId)) done("วันนี้ชวนคุยไปแล้ว 1 ครั้ง — ตอบต่อได้จากแผง 🆘");
  }
  const caption = buddy === "line" ? `${BUDDY_HEAD}\n\n${esc(message)}` : `💬 <b>จากแอดมิน</b>\n\n${esc(hasPhoto ? message.slice(0, 980) : message)}`;
  const res = buddy === "invite"
    ? await sendTelegram(Number(p!.telegram_chat_id), buddyInvite())
    : hasPhoto
    ? await sendTelegramPhotoFile(Number(p!.telegram_chat_id), await photo.arrayBuffer(), photo.type, caption)
    : await sendTelegram(Number(p!.telegram_chat_id), { text: caption });
  if (!res.ok) done(`ส่งไม่สำเร็จ: ${res.error ?? "ไม่ทราบสาเหตุ"}`);
  if (buddy === "line") await admin.from("audit_logs").insert({ entity_type: "person", entity_id: personId, action: "buddy_msg", changed_by: user.id, summary: "น้องบอทชวนคุย", new_values: { message } });
  await admin.from("audit_logs").insert({
    entity_type: "person",
    entity_id: personId,
    action: "telegram_direct",
    changed_by: user.id,
    summary: `ส่งข้อความถึง ${p!.display_name} ทาง Telegram`,
    new_values: { message, photo: hasPhoto ? { type: photo.type, bytes: photo.size } : null },
  });
  done(undefined, `ส่งข้อความ${hasPhoto ? "พร้อมรูป" : ""}ถึง ${p!.display_name} ทาง Telegram แล้ว`);
}

/** คำถามที่พักไว้: ผู้ช่วยตอบเองไม่ได้ → ส่งต่อให้แอดมินทาง Telegram (12 Nov 2026). */
export async function escalateTeamQuestion(formData: FormData) {
  await blockWritesInDemoMode();
  await requireAdmin();
  const code = String(formData.get("code") ?? "").toUpperCase();
  if (!/^[A-Z0-9]{5}$/.test(code)) done("ไม่พบคำถาม");
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", hour12: false }).format(new Date()));
  if (hour >= 21 || hour < 7) done("ไม่ส่งช่วง 21:00–07:00 น. — ส่งต่อใหม่ตอนเช้า");
  const { createAdminClient } = await import("@/lib/supabase/server");
  const { escalateQuestion } = await import("@/lib/telegram/questions");
  const r = await escalateQuestion(createAdminClient(), code);
  if (!r.ok) done(r.error);
  revalidatePath("/settings");
  done(undefined, `ส่งต่อให้แอดมินแล้ว ${r.sent} คน`);
}

/** ปุ่ม "รีเฟรชทีวีตอนนี้" (owner, 4 Nov 2026): the TV reloads within a minute. */
export async function reloadTv() {
  await blockWritesInDemoMode();
  const { user } = await requireAdmin();
  const { error } = await createAdminClient()
    .from("settings")
    .upsert({ key: "tv_reload_at", value: new Date().toISOString(), description: "ปุ่มสั่งรีเฟรชทีวี (หน้าตั้งค่า)", updated_at: new Date().toISOString(), updated_by: user.id });
  done(error ? `สั่งรีเฟรชไม่สำเร็จ: ${error.message}` : undefined, error ? undefined : "สั่งรีเฟรชทีวีแล้ว — ทีวีจะโหลดใหม่ภายใน 1 นาที");
}

/** คำขอจากทีม: move a request along (รอเลือก / เสร็จ tell the person privately, 07–21 น. only). */
export async function setTeamRequestStatus(formData: FormData) {
  await blockWritesInDemoMode();
  const { user } = await requireAdmin();
  const { asReqStatus, setRequestStatus, REQ_STATUS_TH } = await import("@/lib/team-requests");
  const status = asReqStatus(formData.get("status"));
  const requestId = String(formData.get("requestId") ?? "");
  if (!status || !requestId) done("เลือกสถานะก่อน");
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", hour12: false }).format(new Date()));
  const quiet = hour >= 21 || hour < 7;
  const { createAdminClient } = await import("@/lib/supabase/server");
  const r = await setRequestStatus(createAdminClient(), {
    requestId,
    status,
    by: user.id,
    topic: String(formData.get("topic") ?? ""),
    image: String(formData.get("image") ?? ""),
    note: String(formData.get("note") ?? ""),
    notify: formData.get("notify") === "on" && !quiet,
    base: env.appBaseUrl,
  });
  if (!r.ok) done(r.error ?? "บันทึกไม่สำเร็จ");
  revalidatePath("/settings");
  done(undefined, `คำขอ → ${REQ_STATUS_TH[status]}${r.notified ? " · แจ้งเจ้าของคำขอทาง Telegram แล้ว" : quiet && formData.get("notify") === "on" ? " · ไม่แจ้งช่วง 21:00–07:00" : ""}`);
}

/** คำขอจากทีม that came in person: logged for that person so it shows on the TV board. */
export async function addTeamRequest(formData: FormData) {
  await blockWritesInDemoMode();
  const { user } = await requireAdmin();
  const { addRequestFor, asReqStatus, setRequestStatus } = await import("@/lib/team-requests");
  const personId = String(formData.get("personId") ?? "");
  const kind = formData.get("kind") === "gag_idea" ? "gag_idea" : "look_request";
  const text = String(formData.get("text") ?? "");
  if (!personId || text.trim().length < 2) done("เลือกคนและพิมพ์เรื่องที่ขอ");
  const { createAdminClient } = await import("@/lib/supabase/server");
  const admin = createAdminClient();
  const id = await addRequestFor(admin, personId, kind, text, user.id);
  if (!id) done("บันทึกไม่สำเร็จ");
  const status = asReqStatus(formData.get("status"));
  const topic = String(formData.get("topic") ?? "");
  const image = String(formData.get("image") ?? "");
  if ((status && status !== "received") || topic.trim() || image.trim()) {
    await setRequestStatus(admin, { requestId: id, status: status ?? "received", by: user.id, topic, image, notify: false, base: env.appBaseUrl });
  }
  revalidatePath("/settings");
  done(undefined, "เพิ่มคำขอแล้ว · ขึ้นกระดานบนทีวีภายใน 5 นาที");
}

export type TelegramLinkState = { url?: string; error?: string; expires?: string; qr?: string };

/**
 * ลิงก์ Telegram ส่วนตัว (owner, 12 Nov 2026): for someone whose LINE sign-up did
 * not work — the admin copies this link and passes it on. One use, 24 hours.
 * The bot tells the admins which Telegram account used it.
 */
export async function createTelegramLink(_prev: TelegramLinkState, formData: FormData): Promise<TelegramLinkState> {
  await blockWritesInDemoMode();
  await requireAdmin();
  const personId = String(formData.get("personId") ?? "");
  const { createAdminClient } = await import("@/lib/supabase/server");
  const admin = createAdminClient();
  const { data: p } = await admin.from("people").select("id, is_active, telegram_chat_id").eq("id", personId).maybeSingle();
  if (!p) return { error: "ไม่พบคนนี้" };
  if (!p.is_active) return { error: "บัญชีนี้ถูกระงับอยู่" };
  if (p.telegram_chat_id) return { error: "ผูก Telegram แล้ว — ถ้าผิดคน กด ยกเลิกผูก Telegram ก่อน" };
  const { getBotUsername } = await import("@/lib/telegram/api");
  const { ADMIN_LINK_MINUTES, createLinkToken } = await import("@/lib/telegram/link");
  const username = await getBotUsername();
  if (!username) return { error: "ติดต่อบอท Telegram ไม่ได้ ลองใหม่อีกครั้ง" };
  const now = new Date();
  const token = await createLinkToken(admin, personId, now, ADMIN_LINK_MINUTES);
  const expires = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(
    new Date(now.getTime() + ADMIN_LINK_MINUTES * 60_000),
  );
  const url = `https://t.me/${username}?start=${token}`;
  // QR made here (no outside service sees the link): scan from the admin's screen (12 Nov 2026).
  const QR = (await import("qrcode")).default;
  const qr = await QR.toDataURL(url, { margin: 1, width: 360, errorCorrectionLevel: "M" }).catch(() => undefined);
  return { url, expires, qr };
}

/** Wrong person took a link, or a phone changed: clear this person's Telegram. */
export async function unlinkPersonTelegram(formData: FormData) {
  await blockWritesInDemoMode();
  const { user } = await requireAdmin();
  const personId = String(formData.get("personId") ?? "");
  const { createAdminClient } = await import("@/lib/supabase/server");
  const admin = createAdminClient();
  const { data: p } = await admin.from("people").select("display_name, telegram_chat_id").eq("id", personId).maybeSingle();
  if (!p?.telegram_chat_id) done("คนนี้ยังไม่ได้ผูก Telegram");
  const { error } = await admin.from("people").update({ telegram_chat_id: null }).eq("id", personId);
  if (error) done(error.message);
  await admin.from("audit_logs").insert({
    entity_type: "person",
    entity_id: personId,
    action: "telegram_unlink_admin",
    changed_by: user.id,
    summary: "แอดมินยกเลิกผูก Telegram",
    new_values: {},
  });
  revalidatePath("/settings");
  done(undefined, `ยกเลิกผูก Telegram ของ ${p!.display_name} แล้ว · ออกลิงก์ใหม่ได้จากเมนู ⋯`);
}

/** คำถามจากทีม: answer on the web; the bot delivers it (Telegram, free). */
export async function answerTeamQuestion(formData: FormData) {
  await blockWritesInDemoMode();
  const { user } = await requireAdmin();
  const code = String(formData.get("code") ?? "").toUpperCase();
  if (!/^[A-Z0-9]{5}$/.test(code)) done("ไม่พบคำถาม");
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", hour12: false }).format(new Date()));
  if (hour >= 21 || hour < 7) done("ไม่ส่งช่วง 21:00–07:00 น. — ตอบใหม่ตอนเช้า");
  const { createAdminClient } = await import("@/lib/supabase/server");
  const { answerQuestionFromWeb } = await import("@/lib/telegram/questions");
  const r = await answerQuestionFromWeb(createAdminClient(), code, String(formData.get("answer") ?? ""), user.id);
  if (!r.ok) done(r.error);
  revalidatePath("/settings");
  done(undefined, `ส่งคำตอบถึง${r.who}แล้ว`);
}

/** คำถามจากทีม that needs no reply (chatter, already handled): closed without a message. */
export async function closeTeamQuestion(formData: FormData) {
  await blockWritesInDemoMode();
  const { user } = await requireAdmin();
  const code = String(formData.get("code") ?? "").toUpperCase();
  if (!/^[A-Z0-9]{5}$/.test(code)) done("ไม่พบคำถาม");
  const { createAdminClient } = await import("@/lib/supabase/server");
  const admin = createAdminClient();
  const { data } = await admin.from("audit_logs").select("entity_id, new_values").eq("action", "team_question").order("changed_at", { ascending: false }).limit(300);
  const q = ((data ?? []) as { entity_id: string; new_values: { code?: string } | null }[]).find((r) => r.new_values?.code === code);
  if (!q) done("ไม่พบคำถาม");
  await admin.from("audit_logs").insert({
    entity_type: "person",
    entity_id: q!.entity_id,
    action: "team_answer",
    changed_by: user.id,
    summary: "ปิดคำถามทีม (ไม่ต้องตอบ)",
    new_values: { code, text: "(ปิด ไม่ต้องตอบ)", by: user.id, via: "closed" },
  });
  revalidatePath("/settings");
  done(undefined, `ปิด #Q${code} แล้ว (ไม่ส่งข้อความ)`);
}

/** 🆘 panel: reply privately on Telegram (optional) and mark the signal handled. */
export async function handleHelpSignal(formData: FormData) {
  await blockWritesInDemoMode();
  const { user } = await requireAdmin();
  const id = String(formData.get("signalId") ?? "");
  const personId = String(formData.get("personId") ?? "");
  const reply = String(formData.get("reply") ?? "").trim().slice(0, 1000);
  if (!id || !personId) done("ไม่พบรายการ");
  const { createAdminClient } = await import("@/lib/supabase/server");
  const admin = createAdminClient();
  let sent = false;
  if (reply) {
    const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", hour12: false }).format(new Date()));
    if (hour >= 21 || hour < 7) done("ไม่ส่งช่วง 21:00–07:00 น. — ตอบใหม่ตอนเช้า");
    const { data: p } = await admin.from("people").select("telegram_chat_id").eq("id", personId).maybeSingle();
    if (!p?.telegram_chat_id) done("คนนี้ยังไม่ได้ผูก Telegram");
    const { sendTelegram, esc } = await import("@/lib/telegram/api");
    // A reply in the น้องบอทชวนคุย chat keeps the bot's voice (and the chat stays "live").
    const buddy = formData.get("buddy") === "on";
    const { BUDDY_HEAD, isBuddyOn } = await import("@/lib/telegram/buddy");
    if (buddy && !(await isBuddyOn(admin, personId))) done("คนนี้ปิดชวนคุยแล้ว — ปิดรายการโดยไม่ส่ง (เว้นช่องตอบว่าง)");
    const res = await sendTelegram(Number(p!.telegram_chat_id), {
      text: buddy ? `${BUDDY_HEAD}\n\n${esc(reply)}` : `💬 <b>จากแอดมิน</b>\n\n${esc(reply)}\n\nติดตรงไหนอีก พิมพ์มาในแชทนี้ได้เลยครับ`,
    });
    if (!res.ok) done(`ส่งไม่สำเร็จ: ${res.error ?? "ไม่ทราบสาเหตุ"}`);
    if (buddy) await admin.from("audit_logs").insert({ entity_type: "person", entity_id: personId, action: "buddy_msg", changed_by: user.id, summary: "น้องบอทชวนคุย (ตอบ)", new_values: { message: reply } });
    sent = true;
  }
  await admin.from("audit_logs").insert({
    entity_type: "help_signal",
    entity_id: id,
    action: "help_done",
    changed_by: user.id,
    summary: sent ? "ตอบสัญญาณขอความช่วยเหลือ" : "ปิดสัญญาณขอความช่วยเหลือ",
    new_values: { personId, ...(reply ? { reply } : {}) },
  });
  revalidatePath("/settings");
  done(undefined, sent ? "ส่งคำตอบแล้ว" : "ปิดรายการแล้ว");
}
