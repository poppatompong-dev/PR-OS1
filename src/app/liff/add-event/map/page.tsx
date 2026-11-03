import type { Metadata, Viewport } from "next";
import { MapView } from "./MapView";
import { LIFF_ADD_EVENT_ID } from "@/lib/liff/config";

export const metadata: Metadata = { title: "พิกัดงาน · PR-OS" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1 };

// "🗺️ ดูพิกัด" on a job card: Telegram opens /liff/add-event/map?tg=1&e=<id>
// as a Mini App; LINE opens liff.line.me/<id>/map?e=<id> (the LIFF endpoint + "/map").
export default function LiffMapPage() {
  return <MapView liffId={LIFF_ADD_EVENT_ID} />;
}
