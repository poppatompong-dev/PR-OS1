// Role model + capability checks for PR-OS.
// Mirrors the role matrix in docs/03-user-flows.md and docs/08-security-and-permissions.md.
// Server operations and Supabase RLS are the source of truth; these helpers keep
// the UI consistent with that policy.

import type { SupabaseClient } from "@supabase/supabase-js";

export type AppRole = "admin" | "supervisor" | "staff" | "assignee" | "display";

export const ROLE_LABELS_TH: Record<AppRole, string> = {
  admin: "ผู้ดูแลระบบ",
  supervisor: "หัวหน้างาน",
  staff: "เจ้าหน้าที่",
  assignee: "ผู้รับมอบหมาย",
  display: "จอมอนิเตอร์",
};

const BACKEND_ROLES: AppRole[] = ["admin", "supervisor", "staff"];

export const can = {
  manageSettings: (r: AppRole) => r === "admin",
  managePeople: (r: AppRole) => r === "admin",
  createDraft: (r: AppRole) => BACKEND_ROLES.includes(r),
  editPublished: (r: AppRole) => BACKEND_ROLES.includes(r),
  publishEvent: (r: AppRole) => r === "admin" || r === "supervisor",
  cancelEvent: (r: AppRole) => r === "admin" || r === "supervisor",
  manageAssignments: (r: AppRole) => BACKEND_ROLES.includes(r),
  viewReports: (r: AppRole) => r === "admin" || r === "supervisor",
  viewAuditLogs: (r: AppRole) => r === "admin" || r === "supervisor",
};

export type SessionUser = {
  id: string;
  email: string | null;
  role: AppRole;
  personId: string | null;
  displayName: string | null;
};

/**
 * Resolve the logged-in user and their role from the `profiles` table.
 * Returns null when no user is authenticated.
 */
export async function getSessionUser(
  supabase: SupabaseClient,
): Promise<SessionUser | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, person_id, display_name")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email ?? null,
    role: (profile?.role as AppRole) ?? "assignee",
    personId: profile?.person_id ?? null,
    displayName: profile?.display_name ?? null,
  };
}
