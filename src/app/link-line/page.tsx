// The "ผูกบัญชี" button lands here before LINE Login. LINE's in-app browser
// keeps whoever signed in last, so a phone that was once signed in as someone
// else would link the wrong person without a word. This page says whose
// record the LINE account is about to be attached to, and offers to sign out.

import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/roles";
import { isSupabaseConfigured } from "@/lib/env";
import { signOutToRelink } from "@/lib/auth/actions";

export const dynamic = "force-dynamic";

const LOGIN = "/login?next=%2Flink-line";

export default async function LinkLinePage() {
  let personName = "นางสาวตัวอย่าง ใจดี";
  let username: string | null = "sample";
  let replacing = false;
  let noPerson = false;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const user = await getSessionUser(supabase);
    if (!user) redirect(LOGIN);

    const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
    username = (profile?.username as string | null) ?? null;

    if (!user.personId) {
      noPerson = true;
    } else {
      // The session user's own person row; line_user_id is not readable under RLS.
      const { data: person } = await createAdminClient()
        .from("people")
        .select("display_name, line_user_id")
        .eq("id", user.personId)
        .maybeSingle();
      personName = (person?.display_name as string | undefined) ?? user.displayName ?? "—";
      replacing = Boolean(person?.line_user_id);
    }
  }

  return (
    <div className="login-wrap">
      <div className="panel login-card link-line-card">
        <h1>ผูกบัญชี LINE</h1>
        {noPerson ? (
          <>
            <div className="login-error">บัญชีนี้ยังไม่ผูกกับรายชื่อบุคลากร ให้ผู้ดูแลระบบผูกในหน้าตั้งค่าก่อน</div>
            <form action={signOutToRelink}>
              <button className="button secondary" type="submit">ออกจากระบบ แล้วเข้าด้วยบัญชีอื่น</button>
            </form>
          </>
        ) : (
          <>
            <p className="link-line-lead">คุณกำลังผูก LINE นี้กับ</p>
            <p className="link-line-who">
              {personName}
              {username ? <small>@{username}</small> : null}
            </p>
            {replacing ? (
              <p className="link-line-warn">คนนี้ผูก LINE ไว้แล้ว — LINE เดิมของคนนี้จะถูกแทนที่ด้วย LINE นี้</p>
            ) : null}
            <a className="button coral link-line-yes" href="/api/auth/line/start?confirmed=1">
              ใช่ ผูกเลย
            </a>
            <form action={signOutToRelink}>
              <button className="button secondary link-line-no" type="submit">
                ไม่ใช่ฉัน — ออกจากระบบ
              </button>
            </form>
            <p className="login-hint">ถ้าชื่อด้านบนไม่ใช่ของคุณ ให้กด “ไม่ใช่ฉัน” แล้วเข้าด้วยชื่อผู้ใช้ของตัวเอง</p>
          </>
        )}
      </div>
    </div>
  );
}
