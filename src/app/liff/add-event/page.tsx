import type { Metadata, Viewport } from "next";
import { AddEventForm } from "./AddEventForm";
import { LIFF_ADD_EVENT_ID } from "@/lib/liff/config";

export const metadata: Metadata = { title: "เพิ่มงาน · PR-OS" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1 };

// Opened from the "➕ เพิ่มงาน" button under the bot's chat (a LIFF app), so
// it runs inside LINE and knows who you are from LINE — no web login.
export default function LiffAddEventPage() {
  return <AddEventForm liffId={LIFF_ADD_EVENT_ID} />;
}
