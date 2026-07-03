"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { ROLE_LABELS_TH, type AppRole } from "@/lib/auth/roles";

export function UserMenu() {
  const router = useRouter();
  const [label, setLabel] = useState<string | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    let active = true;

    supabase.auth.getUser().then(async ({ data }) => {
      if (!active || !data.user) return;
      setLabel(data.user.email ?? null);
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, username")
        .eq("id", data.user.id)
        .single();
      if (!active) return;
      if (profile?.role) setRole(profile.role as AppRole);
      if (profile?.username) setLabel(`@${profile.username}`);
    });

    return () => {
      active = false;
    };
  }, []);

  // Mock mode: no Supabase wired up yet.
  if (!isSupabaseConfigured()) {
    return (
      <div className="sidebar-user">
        <div className="sidebar-user-info">
          <strong>โหมด Mock</strong>
          <small>ยังไม่เชื่อม Supabase</small>
        </div>
      </div>
    );
  }

  if (!label) return null;

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="sidebar-user">
      <div className="sidebar-user-info">
        <strong>{label}</strong>
        {role ? <small>{ROLE_LABELS_TH[role]}</small> : null}
      </div>
      <button className="icon-button" type="button" onClick={logout} title="ออกจากระบบ">
        <LogOut size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
