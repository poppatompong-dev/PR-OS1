import type { Metadata, Viewport } from "next";
import { JobsView } from "./JobsView";
import { LIFF_ADD_EVENT_ID } from "@/lib/liff/config";

export const metadata: Metadata = { title: "รายการงาน · PR-OS" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1 };

// รายการงาน on the phone (owner, 30 Oct 2026): see, add, edit, publish, put on
// hold, cancel, delete — inside Telegram (?tg=1) or LINE (liff.line.me/<id>/jobs).
export default function LiffJobsPage() {
  return <JobsView liffId={LIFF_ADD_EVENT_ID} />;
}
