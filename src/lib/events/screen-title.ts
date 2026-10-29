// "ชื่อสั้นบนจอ" (0017): optional, at most 60 characters, blank = use the title.
export const SCREEN_TITLE_MAX = 60;

export function cleanScreenTitle(v: FormDataEntryValue | string | null | undefined): string | null {
  const t = String(v ?? "").replace(/\s+/g, " ").trim();
  return t ? [...t].slice(0, SCREEN_TITLE_MAX).join("") : null;
}
