import type { Metadata, Viewport } from "next";
import { FilesView } from "./FilesView";
import { LIFF_ADD_EVENT_ID } from "@/lib/liff/config";

export const metadata: Metadata = { title: "ไฟล์แนบ · PR-OS" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1 };

// Opened from "📎 ดูไฟล์แนบ" on a LINE job card: liff.line.me/<id>/files?e=<event>
// lands here (the LIFF endpoint + "/files"). Same LIFF app as the add-job form.
export default function LiffFilesPage() {
  return <FilesView liffId={LIFF_ADD_EVENT_ID} />;
}
