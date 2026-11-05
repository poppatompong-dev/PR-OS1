// แนบไฟล์จากฟอร์มใน Telegram (5 Nov 2026): the upload slot must go through the
// phone-form check for Telegram's "tma" token too, not fall to the web login.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { isPhoneAuth, verifyTelegramInitData } from "@/lib/liff/auth";

test("phone auth header: LINE and Telegram both count, web (none) does not", () => {
  assert.equal(isPhoneAuth("Bearer abc"), true);
  assert.equal(isPhoneAuth("tma query_id=1&hash=x"), true);
  assert.equal(isPhoneAuth(""), false);
  assert.equal(isPhoneAuth(null), false);
  assert.equal(isPhoneAuth("Basic xyz"), false);
});

test("Telegram initData signed with the bot token is accepted, tampered is not", () => {
  const token = "123:TEST";
  const now = Date.now();
  const fields: Record<string, string> = { auth_date: String(Math.floor(now / 1000)), query_id: "Q", user: JSON.stringify({ id: 4242 }) };
  const check = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret).update(check).digest("hex");
  const initData = new URLSearchParams({ ...fields, hash }).toString();
  assert.equal(verifyTelegramInitData(initData, token, now), 4242);
  assert.equal(verifyTelegramInitData(initData.replace("4242", "4243"), token, now), null);
});
