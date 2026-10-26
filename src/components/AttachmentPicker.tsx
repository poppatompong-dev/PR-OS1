"use client";

// Pick files for a job that is not saved yet. Each file uploads at once to
// Storage (staging) through /api/attachments/stage; the form then carries the
// staged list — as hidden inputs (web form, `name`) or via onChange (LINE form).
// While a file is still uploading, submitting the surrounding form is held back.
// Owner, 26 Oct 2026: tiles with a thumbnail — the photo itself, an icon for
// PDF/Word/Excel. For a photo the browser also makes a small JPEG preview and
// uploads it next to the file, so lists later never pull the full picture.

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENTS_PER_EVENT,
  THUMB_MAX_PX,
  checkAttachmentMeta,
  fileKind,
  formatMb,
  isImageMime,
  type StagedAttachment,
} from "@/lib/attachments/rules";

const BUCKET = "event-attachments";

type Item = {
  key: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  /** Object URL of the picked photo, for the tile only (never uploaded). */
  preview?: string;
  status: "uploading" | "done" | "error";
  error?: string;
  staged?: StagedAttachment;
};

/** A small JPEG of a photo, or null when the browser cannot read it. */
async function makeThumb(file: File): Promise<Blob | null> {
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const scale = Math.min(1, THUMB_MAX_PX / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.78));
  } catch {
    return null;
  }
}

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

  // Free the photo previews when the picker goes away.
  const previews = useRef<string[]>([]);
  useEffect(() => {
    const list = previews.current;
    return () => list.forEach((u) => URL.revokeObjectURL(u));
  }, []);

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

  async function stage(meta: { fileName: string; mimeType: string; sizeBytes: number }, body: Blob): Promise<string> {
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
      .uploadToSignedUrl(data.path, data.token, body, { contentType: meta.mimeType });
    if (error) throw new Error(error.message);
    return data.path as string;
  }

  async function upload(file: File, key: string) {
    const meta = { fileName: file.name, mimeType: file.type, sizeBytes: file.size };
    const problem = checkAttachmentMeta(meta);
    if (problem) return update(key, { status: "error", error: problem });
    try {
      const path = await stage(meta, file);
      let thumbPath: string | undefined;
      if (isImageMime(file.type)) {
        const thumb = await makeThumb(file);
        if (thumb) {
          thumbPath = await stage(
            { fileName: `thumb-${file.name}.jpg`, mimeType: "image/jpeg", sizeBytes: thumb.size },
            thumb,
          ).catch(() => undefined);
        }
      }
      update(key, { status: "done", staged: { path, ...meta, ...(thumbPath ? { thumbPath } : {}) } });
    } catch (e) {
      update(key, { status: "error", error: e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ" });
    }
  }

  function pick(files: FileList | null) {
    if (!files) return;
    const room = MAX_ATTACHMENTS_PER_EVENT - items.filter((i) => i.status !== "error").length;
    const chosen = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > chosen.length) window.alert(`แนบได้สูงสุด ${MAX_ATTACHMENTS_PER_EVENT} ไฟล์ต่องาน`);
    const added: Item[] = chosen.map((f, n) => {
      const preview = isImageMime(f.type) ? URL.createObjectURL(f) : undefined;
      if (preview) previews.current.push(preview);
      return {
        key: `${Date.now()}-${n}-${f.name}`,
        fileName: f.name,
        sizeBytes: f.size,
        mimeType: f.type,
        preview,
        status: "uploading" as const,
      };
    });
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
      <input ref={inputRef} type="file" multiple accept={ATTACHMENT_ACCEPT} hidden onChange={(e) => pick(e.target.files)} />
      {items.length > 0 ? (
        <ul className="file-tiles picker-tiles">
          {items.map((i) => {
            const kind = fileKind(i.mimeType, i.fileName);
            return (
              <li key={i.key} className={`file-tile${i.status === "error" ? " file-tile-error" : ""}`}>
                <div className="file-tile-link">
                  <span className={`file-thumb file-thumb-${kind.tone}`}>
                    {i.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.preview} alt="" />
                    ) : (
                      <span aria-hidden="true">
                        {kind.icon}
                        <small>{kind.label}</small>
                      </span>
                    )}
                    {i.status !== "done" ? (
                      <span className="file-badge" aria-hidden="true">
                        {i.status === "uploading" ? "⏳" : "⚠️"}
                      </span>
                    ) : null}
                  </span>
                  <span className="file-name">{i.fileName}</span>
                  <span className="file-size">
                    {i.status === "uploading"
                      ? "กำลังอัปโหลด…"
                      : i.status === "done"
                        ? `✅ ${formatMb(i.sizeBytes)} MB`
                        : `${formatMb(i.sizeBytes)} MB`}
                  </span>
                  {i.error ? <small className="file-error">{i.error}</small> : null}
                </div>
                <button
                  type="button"
                  className="file-delete"
                  aria-label={`เอา ${i.fileName} ออก`}
                  onClick={() => setItems((list) => list.filter((x) => x.key !== i.key))}
                >
                  เอาออก
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {name ? staged.map((s) => <input key={s.path} type="hidden" name={name} value={JSON.stringify(s)} />) : null}
    </div>
  );
}
