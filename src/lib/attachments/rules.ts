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

/** A file already uploaded to the staging area, waiting for its job to exist. */
export type StagedAttachment = { path: string; fileName: string; mimeType: string; sizeBytes: number };

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
    out.push({ path, fileName, mimeType, sizeBytes });
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
