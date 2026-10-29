// How the bots and the TV address people: first name only, no title.
// "นายปฐมพงษ์ หล้ามหศักดิ์" → "ปฐมพงษ์"; callName → "คุณปฐมพงษ์".

export function shortName(full: string): string {
  const t = full.trim().replace(/^(นางสาว|นาย|นาง|น\.ส\.|ว่าที่ร้อยตรี|ว่าที่ ร\.ต\.)\s*/u, "");
  return t.split(/\s+/)[0] || full.trim();
}

export function callName(full: string): string {
  return `คุณ${shortName(full)}`;
}
