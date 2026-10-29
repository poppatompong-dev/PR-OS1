import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/roles";
import { isSupabaseConfigured } from "@/lib/env";
import { ANNOUNCE_MAX } from "@/lib/announcements";
import { postAnnouncement, removeAnnouncement } from "./actions";

export const dynamic = "force-dynamic";

type Row = { id: string; message: string; author_name: string; author_person_id: string | null; source: string; ends_at: string; created_at: string };

const SOURCE_TH: Record<string, string> = { web: "เว็บ", line: "LINE", telegram: "Telegram", event_form: "ฟอร์มเพิ่มงาน" };

function when(iso: string) {
  return new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { error, notice } = await searchParams;
  let rows: Row[] = [];
  let me: { personId: string | null; admin: boolean } = { personId: null, admin: false };
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const user = await getSessionUser(supabase);
    me = { personId: user?.personId ?? null, admin: user?.role === "admin" };
    const { data } = await supabase
      .from("tv_announcements")
      .select("id, message, author_name, author_person_id, source, ends_at, created_at")
      .is("deleted_at", null)
      .gt("ends_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(50);
    rows = (data as Row[]) ?? [];
  }

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <h1 className="page-title">ประกาศบนจอทีวี</h1>
          <p className="page-subtitle">ขึ้นตัววิ่งด้านล่างจอทันที หายเองตอนเที่ยงคืน · พิมพ์ &quot;ประกาศ ข้อความ&quot; ในแชทบอท LINE / Telegram ก็ได้</p>
        </div>
      </header>
      {error ? <p className="login-error">{error}</p> : null}
      {notice ? <p className="notice">{notice}</p> : null}

      <section className="panel">
        <form action={postAnnouncement} className="form-grid">
          <label className="form-field full">
            ข้อความ (ไม่เกิน {ANNOUNCE_MAX} ตัวอักษร)
            <input className="input" name="message" maxLength={ANNOUNCE_MAX} required placeholder="เช่น พรุ่งนี้ประชุมทีม 9 โมง ห้องประชุม 1" />
          </label>
          <label className="form-field">
            แสดงถึง
            <select className="select" name="days" defaultValue="0">
              <option value="0">สิ้นวันนี้</option>
              <option value="1">สิ้นวันพรุ่งนี้</option>
              <option value="2">อีก 3 วัน</option>
              <option value="6">อีก 7 วัน</option>
            </select>
          </label>
          <div className="form-actions" style={{ alignSelf: "end" }}>
            <button className="btn btn-primary" type="submit">ขึ้นจอ</button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>กำลังแสดงอยู่ ({rows.length})</h2>
        {rows.length === 0 ? <p>ยังไม่มีประกาศ</p> : null}
        {rows.map((r) => (
          <div className="assignment-row" key={r.id}>
            <div className="assignment-main">
              <strong>📢 {r.message}</strong>
              <div className="muted">
                {r.author_name} · {SOURCE_TH[r.source] ?? r.source} · {when(r.created_at)} · ถึง {when(new Date(new Date(r.ends_at).getTime() - 60000).toISOString())}
              </div>
            </div>
            {me.admin || (me.personId && me.personId === r.author_person_id) ? (
              <form action={removeAnnouncement}>
                <input type="hidden" name="id" value={r.id} />
                <button className="btn" type="submit">เอาลง</button>
              </form>
            ) : null}
          </div>
        ))}
      </section>
    </AppShell>
  );
}
