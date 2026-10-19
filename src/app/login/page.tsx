import { redirect } from "next/navigation";
import { isLineLoginConfigured, isSupabaseConfigured } from "@/lib/env";
import { safeNextPath } from "@/lib/auth/next-path";
import { createClient } from "@/lib/supabase/server";
import { signIn } from "@/lib/auth/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  // In mock mode there is no auth layer — send users straight to the app.
  if (!isSupabaseConfigured()) {
    redirect("/");
  }

  const { error, next: rawNext } = await searchParams;
  const next = safeNextPath(rawNext);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect(next);
  }

  return (
    <div className="login-wrap">
      <form className="panel login-card" action={signIn}>
        <h1>PR-OS</h1>
        <p className="login-sub">เข้าสู่ระบบบริหารงานประชาสัมพันธ์เทศบาล</p>

        {error ? <div className="login-error">{error}</div> : null}
        <input type="hidden" name="next" value={next} />

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
        {isLineLoginConfigured() ? (
          <>
            <p className="login-or">หรือ</p>
            <a className="button line-login" href={`/api/auth/line/login?next=${encodeURIComponent(next)}`}>
              เข้าสู่ระบบด้วย LINE
            </a>
            <p className="login-hint">ใช้ได้หลังจากผูกบัญชี LINE ในหน้า “งานของฉัน” แล้ว</p>
          </>
        ) : null}
      </form>
    </div>
  );
}
