import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { signIn } from "@/lib/auth/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // In mock mode there is no auth layer — send users straight to the app.
  if (!isSupabaseConfigured()) {
    redirect("/");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect("/");
  }

  const { error } = await searchParams;

  return (
    <div className="login-wrap">
      <form className="panel login-card" action={signIn}>
        <h1>PR-OS</h1>
        <p className="login-sub">เข้าสู่ระบบบริหารงานประชาสัมพันธ์เทศบาล</p>

        {error ? <div className="login-error">{error}</div> : null}

        <label className="form-field">
          ชื่อผู้ใช้
          <input
            className="input"
            name="username"
            type="text"
            autoComplete="username"
            placeholder="เช่น admin"
            required
          />
        </label>
        <label className="form-field">
          รหัสผ่าน
          <input
            className="input"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <button className="button" type="submit">
          เข้าสู่ระบบ
        </button>
      </form>
    </div>
  );
}
