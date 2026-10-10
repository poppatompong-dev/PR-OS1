"use client";

import { useEffect, useState } from "react";
import { CloudOff } from "lucide-react";
import { pendingAckCount, subscribeToQueue } from "@/lib/offline/ack-queue";

/**
 * Tells the truth about the connection, because a phone in a function hall
 * basement looks exactly like a phone that is working until something fails.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const [queued, setQueued] = useState(0);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    pendingAckCount().then(setQueued);
    const unsubscribe = subscribeToQueue(setQueued);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      unsubscribe();
    };
  }, []);

  if (!offline && queued === 0) return null;

  return (
    <div className="offline-banner" role="status">
      <CloudOff size={16} aria-hidden="true" />
      {offline ? <span>ออฟไลน์ — ดูข้อมูลที่เคยเปิดไว้ได้</span> : <span>กำลังส่งข้อมูลที่ค้างไว้</span>}
      {queued > 0 ? <strong>รับทราบรอส่ง {queued}</strong> : null}
    </div>
  );
}
