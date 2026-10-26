// Attachment limits shared by the browser (picker) and the server (stage /
// attach). Owner, 26 Oct 2026: files can go with the order itself, up to 5
// per job, 10 MB each. Keep the size and types in sync with the bucket in
// supabase/migrations/0010_event_attachments.sql (the hard limit).

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_EVENT = 5;

export const ATTACHMENT_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

export const ATTACHMENT_ACCEPT = Object.keys(ATTACHMENT_MIME).join(",");

/**
 * A file already uploaded to the staging area, waiting for its job to exist.
 * thumbPath: a small JPEG preview the browser made for a photo (owner,
 * 26 Oct 2026: thumbnails), so lists never pull the full-size picture.
 */
export type StagedAttachment = { path: string; fileName: string; mimeType: string; sizeBytes: number; thumbPath?: string };

/** Size of the preview the browser makes for a photo (longest side, px). */
export const THUMB_MAX_PX = 360;

/** Where a file's preview sits next to it in storage: <event>/<uuid>.thumb.jpg */
export function thumbPathFor(storagePath: string): string {
  return storagePath.replace(/\.[a-z0-9]+$/i, "") + ".thumb.jpg";
}

export function isImageMime(mime: string | null | undefined): boolean {
  return typeof mime === "string" && mime.startsWith("image/");
}

/** Icon + colour for a file tile when there is no picture to show. */
export function fileKind(mime: string | null | undefined, fileName = ""): { icon: string; label: string; tone: string } {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (isImageMime(mime)) return { icon: "🖼️", label: "รูป", tone: "img" };
  if (mime === "application/pdf" || ext === "pdf") return { icon: "📕", label: "PDF", tone: "pdf" };
  if (/word/.test(mime ?? "") || ext === "doc" || ext === "docx") return { icon: "📘", label: "Word", tone: "doc" };
  if (/excel|sheet/.test(mime ?? "") || ext === "xls" || ext === "xlsx") return { icon: "📗", label: "Excel", tone: "xls" };
  return { icon: "📄", label: "ไฟล์", tone: "file" };
}

export function formatMb(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

/** Thai message for the user, or null when the file may be uploaded. */
export function checkAttachmentMeta(m: { fileName: string; mimeType: string; sizeBytes: number }): string | null {
  if (!m.fileName.trim() || !(m.sizeBytes > 0)) return "ไฟล์ว่างหรือเสีย ลองเลือกใหม่";
  if (!ATTACHMENT_MIME[m.mimeType]) return `"${m.fileName}" ไม่รองรับ — แนบได้เฉพาะ PDF, Word, Excel และรูปภาพ`;
  if (m.sizeBytes > MAX_ATTACHMENT_BYTES) {
    return `"${m.fileName}" ใหญ่ ${formatMb(m.sizeBytes)} MB — จำกัดไฟล์ละไม่เกิน ${formatMb(MAX_ATTACHMENT_BYTES)} MB`;
  }
  return null;
}

const STAGED_PATH = /^staging\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|png|webp|docx?|xlsx?)$/;
const STAGED_THUMB = /^staging\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/;

/** Keep only well-formed staged entries (a client could send anything), at most the per-job limit. */
export function parseStagedList(raw: unknown): StagedAttachment[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: StagedAttachment[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const s = (item ?? {}) as Record<string, unknown>;
    const path = typeof s.path === "string" ? s.path : "";
    const fileName = typeof s.fileName === "string" ? s.fileName.trim().slice(0, 200) : "";
    const mimeType = typeof s.mimeType === "string" ? s.mimeType : "";
    const sizeBytes = typeof s.sizeBytes === "number" ? s.sizeBytes : Number(s.sizeBytes);
    if (!STAGED_PATH.test(path) || seen.has(path)) continue;
    if (checkAttachmentMeta({ fileName, mimeType, sizeBytes })) continue;
    if (!path.endsWith(`.${ATTACHMENT_MIME[mimeType]}`)) continue;
    seen.add(path);
    const thumbPath = typeof s.thumbPath === "string" && STAGED_THUMB.test(s.thumbPath) && s.thumbPath !== path && isImageMime(mimeType) ? s.thumbPath : null;
    out.push({ path, fileName, mimeType, sizeBytes, ...(thumbPath ? { thumbPath } : {}) });
    if (out.length >= MAX_ATTACHMENTS_PER_EVENT) break;
  }
  return out;
}

/** Web form: hidden inputs carry one JSON entry each. */
export function parseStagedFormValues(values: FormDataEntryValue[]): StagedAttachment[] {
  return parseStagedList(
    values.map((v) => {
      try {
        return JSON.parse(String(v));
      } catch {
        return null;
      }
    }),
  );
}
