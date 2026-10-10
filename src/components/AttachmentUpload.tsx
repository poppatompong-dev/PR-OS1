"use client";

import { Camera, Paperclip } from "lucide-react";

const DOC_TYPES = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp";

/**
 * Two ways to attach the same thing. On a phone — the device most of this
 * work is logged from — "ถ่ายรูป" opens the camera straight away and uploads
 * the shot, instead of making someone take the photo, leave the app, find it
 * in the gallery and come back.
 *
 * Each picker is its own form so only one field named "file" is ever
 * submitted, and both post to the same server action.
 */
export function AttachmentUpload({
  eventId,
  action,
}: {
  eventId: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  function submitOnPick(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.currentTarget.files?.length) event.currentTarget.form?.requestSubmit();
  }

  return (
    <div className="attach-actions">
      <form action={action} className="attach-form">
        <input type="hidden" name="eventId" value={eventId} />
        <label className="button attach-camera">
          <Camera size={18} aria-hidden="true" />
          ถ่ายรูป
          <input
            type="file"
            name="file"
            accept="image/*"
            capture="environment"
            onChange={submitOnPick}
            required
          />
        </label>
      </form>

      <form action={action} className="attach-form">
        <input type="hidden" name="eventId" value={eventId} />
        <label className="button secondary attach-pick">
          <Paperclip size={18} aria-hidden="true" />
          เลือกไฟล์
          <input type="file" name="file" accept={DOC_TYPES} onChange={submitOnPick} required />
        </label>
      </form>

      <p className="attach-note">PDF / Word / Excel / รูปภาพ ไม่เกิน 10 MB</p>
    </div>
  );
}
