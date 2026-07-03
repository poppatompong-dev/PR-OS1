"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const usernameOrEmail = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();

  // Resolve a short username to its account email server-side (email never
  // reaches the browser). A full email may also be entered directly.
  let email = usernameOrEmail;
  if (usernameOrEmail.length > 0 && !usernameOrEmail.includes("@")) {
    const { data } = await supabase.rpc("get_login_email", {
      p_username: usernameOrEmail.toLowerCase(),
    });
    if (!data) {
      redirect(`/login?error=${encodeURIComponent("ไม่พบชื่อผู้ใช้นี้")}`);
    }
    email = data as string;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?error=${encodeURIComponent("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง")}`);
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
