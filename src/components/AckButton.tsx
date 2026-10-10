"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CloudOff } from "lucide-react";
import { flushAckQueue, queueAck } from "@/lib/offline/ack-queue";
import type { AckResult } from "@/lib/offline/ack-queue";

/**
 * Acknowledging a job, with or without signal.
 *
 * Online this is an ordinary form post to the server action, so it still
 * works with JavaScript turned off. Offline the tap is kept in IndexedDB and
 * replayed when the connection returns — the one write in the system that is
 * safe to take on trust, because it records that a person saw something, and
 * a duplicate insert is ignored by the database.
 */
export function AckButton({
  assignmentId,
  assignmentVersion,
  eventTitle,
  action,
  flushAction,
}: {
  assignmentId: string;
  assignmentVersion: number;
  eventTitle: string;
  action: (formData: FormData) => void | Promise<void>;
  flushAction: (formData: FormData) => Promise<AckResult>;
}) {
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    const drain = () => {
      flushAckQueue(flushAction).then(() => setQueued(false));
    };
    window.addEventListener("online", drain);
    drain();
    return () => window.removeEventListener("online", drain);
  }, [flushAction]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (navigator.onLine) return; // let the form post as normal
    event.preventDefault();
    await queueAck({
      assignmentId,
      assignmentVersion,
      eventTitle,
      queuedAt: new Date().toISOString(),
    });
    setQueued(true);
  }

  if (queued) {
    return (
      <p className="ack-queued">
        <CloudOff size={18} aria-hidden="true" />
        บันทึกไว้แล้ว — จะส่งให้อัตโนมัติเมื่อกลับมาออนไลน์
      </p>
    );
  }

  return (
    <form action={action} onSubmit={handleSubmit}>
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="assignmentVersion" value={assignmentVersion} />
      <button className="button success" type="submit">
        <CheckCircle2 size={18} aria-hidden="true" />
        รับทราบ
      </button>
    </form>
  );
}
