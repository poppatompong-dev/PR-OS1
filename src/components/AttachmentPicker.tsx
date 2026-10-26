"use client";

// Pick files for a job that is not saved yet. Each file uploads at once to
// Storage (staging) through /api/attachments/stage; the form then carries the
// staged list — as hidden inputs (web form, `name`) or via onChange (LINE form).
// While a file is still uploading, submitting the surrounding form is held back.

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENTS_PER_EVENT,
  checkAttachmentMeta,
  formatMb,
  type StagedAttachment,
} from "@/lib/attachments/rules";

const BUCKET = "event-attachments";

type Item = {
  key: string;
  fileName: string;
  sizeBytes: number;
  status: "uploading" | "done" | "error";
  error?: string;
  staged?: StagedAttachment;
};

export function AttachmentPicker({
  name,
  authHeader,
  onChange,
  className,
}: {
  /** Web form: one hidden input per staged file under this name. */
  name?: string;
  /** LINE form: "Bearer <LINE ID token>". Web form: leave out (cookie session). */
  authHeader?: () => string | null;
  onChange?: (staged: StagedAttachment[], busy: boolean) => void;
  className?: string;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const busy = items.some((i) => i.status === "uploading");
  const staged = items.filter((i) => i.status === "done" && i.staged).map((i) => i.staged!);

  useEffect(() => {
    onChange?.(staged, busy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // Hold the form while an upload is running (capture phase: before React's own submit handling).
  useEffect(() => {
    const form = boxRef.current?.closest("form");
    if (!form) return;
    const hold = (e: Event) => {
      if (!busy) return;
      e.preventDefault();
      e.stopPropagation();
      window.alert("กำลังอัปโหลดไฟล์แนบ รอสักครู่แล้วกดอีกครั้ง");
    };
    form.addEventListener("submit", hold, true);
    return () => form.removeEventListener("submit", hold, true);
  }, [busy]);

  const update = (key: string, patch: Partial<Item>) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  async function upload(file: File, key: string) {
    const meta = { fileName: file.name, mimeType: file.type, sizeBytes: file.size };
    const problem = checkAttachmentMeta(meta);
    if (problem) return update(key, { status: "error", error: problem });
    try {
      const auth = authHeader?.();
      const res = await fetch("/api/attachments/stage", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(auth ? { Authorization: auth } : {}) },
        body: JSON.stringify(meta),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "อัปโหลดไม่สำเร็จ");
      const { error } = await createClient()
        .storage.from(BUCKET)
        .uploadToSignedUrl(data.path, data.token, file, { contentType: file.type });
      if (error) throw new Error(error.message);
      update(key, { status: "done", staged: { path: data.path, ...meta } });
    } catch (e) {
      update(key, { status: "error", error: e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ" });
    }
  }

  function pick(files: FileList | null) {
    if (!files) return;
    const room = MAX_ATTACHMENTS_PER_EVENT - items.filter((i) => i.status !== "error").length;
    const chosen = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > chosen.length) window.alert(`แนบได้สูงสุด ${MAX_ATTACHMENTS_PER_EVENT} ไฟล์ต่องาน`);
    const added = chosen.map((f, n) => ({ key: `${Date.now()}-${n}-${f.name}`, fileName: f.name, sizeBytes: f.size, status: "uploading" as const }));
    setItems((list) => [...list, ...added]);
    chosen.forEach((f, n) => void upload(f, added[n].key));
    if (inputRef.current) inputRef.current.value = "";
  }

  const full = items.filter((i) => i.status !== "error").length >= MAX_ATTACHMENTS_PER_EVENT;

  return (
    <div ref={boxRef} className={className} style={{ display: "grid", gap: 8 }}>
      <span style={{ fontWeight: 600 }}>ไฟล์ประกอบการสั่งงาน (ถ้ามี)</span>
      <button
        type="button"
        className="button secondary"
        onClick={() => inputRef.current?.click()}
        disabled={full}
        style={{ justifySelf: "start" }}
      >
        📎 แนบไฟล์ / ถ่ายรูป
      </button>
      <small style={{ opacity: 0.75 }}>
        PDF, Word, Excel, รูปภาพ · สูงสุด {MAX_ATTACHMENTS_PER_EVENT} ไฟล์ ไฟล์ละไม่เกิน 10 MB · ทีมงานเปิดดูได้จากปุ่มบนการ์ดในไลน์
      </small>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ATTACHMENT_ACCEPT}
        hidden
        onChange={(e) => pick(e.target.files)}
      />
      {items.length > 0 ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
          {items.map((i) => (
            <li key={i.key} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
              <span aria-hidden="true">{i.status === "done" ? "✅" : i.status === "error" ? "⚠️" : "⏳"}</span>
              <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
                {i.fileName} <small style={{ opacity: 0.7 }}>({formatMb(i.sizeBytes)} MB)</small>
                {i.status === "uploading" ? <small> · กำลังอัปโหลด…</small> : null}
                {i.error ? <small style={{ display: "block", color: "#b42318" }}>{i.error}</small> : null}
              </span>
              <button
                type="button"
                aria-label={`เอา ${i.fileName} ออก`}
                onClick={() => setItems((list) => list.filter((x) => x.key !== i.key))}
                style={{ border: 0, background: "transparent", fontSize: 18, cursor: "pointer" }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {name ? staged.map((s) => <input key={s.path} type="hidden" name={name} value={JSON.stringify(s)} />) : null}
    </div>
  );
}
