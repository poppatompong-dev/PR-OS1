const BASE = "https://pr-os.invalid";

/**
 * Where to go after signing in. Same-site paths only. Parsed with the same
 * URL rules a browser uses, because string checks miss tricks like
 * "/\t/evil.com" (browsers drop the tab and read it as "//evil.com").
 */
export function safeNextPath(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("/")) return "/";
  if (/[\u0000-\u001f\\]/.test(raw)) return "/";
  try {
    const u = new URL(raw, BASE);
    if (u.origin !== BASE) return "/";
    return `${u.pathname}${u.search}${u.hash}` || "/";
  } catch {
    return "/";
  }
}
