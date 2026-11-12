"use client";

// ลิงก์ Telegram ส่วนตัว (owner, 12 Nov 2026): when the LINE sign-up does not
// work, the admin makes a one-use link here and passes it on (LINE, group, in person).

import { useActionState, useState } from "react";
import { createTelegramLink, type TelegramLinkState } from "@/lib/settings/mutations";

export function TelegramLinkMaker({ personId, name }: { personId: string; name: string }) {
  const [state, action, pending] = useActionState<TelegramLinkState, FormData>(createTelegramLink, {});
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!state.url) return;
    try {
      await navigator.clipboard.writeText(state.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <form action={action} className="team-menu-form tg-link-maker">
      <input type="hidden" name="personId" value={personId} />
      <button className="button secondary" type="submit" disabled={pending}>
        🔗 {state.url ? "ออกลิงก์ใหม่" : "ลิงก์ Telegram ส่วนตัว"}
      </button>
      {state.error ? <small className="tg-link-error">{state.error}</small> : null}
      {state.url ? (
        <div className="tg-link-box">
          <input className="input" readOnly value={state.url} aria-label={`ลิงก์ Telegram ของ ${name}`} onFocus={(e) => e.currentTarget.select()} />
          <button className="button primary" type="button" onClick={copy}>
            {copied ? "คัดลอกแล้ว ✓" : "คัดลอก"}
          </button>
          <small>
            ของ {name} คนเดียว · ใช้ได้ครั้งเดียว ถึง {state.expires} · ใครกดก่อนได้บัญชีนี้ — บอทจะแจ้งแอดมินว่าบัญชี Telegram ไหนผูก
          </small>
        </div>
      ) : (
        <small>เมื่อลงทะเบียนผ่าน LINE ไม่ได้: คัดลอกลิงก์ส่งให้เจ้าตัว กดแล้วกด Start จบ</small>
      )}
    </form>
  );
}
