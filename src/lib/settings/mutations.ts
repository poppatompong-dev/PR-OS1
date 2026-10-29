"use server";

import { blockWritesInDemoMode } from "@/lib/demo-guard";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
