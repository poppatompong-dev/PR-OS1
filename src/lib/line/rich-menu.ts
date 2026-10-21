// The button panel under the bot's chat. 2 rows × 3 buttons on LINE's
// "compact" size (2500 × 843), under a strip naming the two zones. The picture is public/line/rich-menu.png —
// regenerate it with scripts/render-rich-menu.mjs if the labels change, so
// the picture and the tap areas stay in step.

import { COMMANDS } from "@/lib/line/messages";
import { LIFF_ADD_EVENT_URL } from "@/lib/liff/config";

export const RICH_MENU_IMAGE_PATH = "/line/rich-menu.png";

// Menu A (owner, 21 Oct 2026). Left column = ของฉัน (purple), the other two
// = ของทีม. Order is row by row, left to right, as the picture draws it.
export const RICH_MENU_BUTTONS: Array<{ label: string; action: Record<string, string> }> = [
  { label: COMMANDS.mine, action: { type: "message", text: COMMANDS.mine } },
  { label: COMMANDS.today, action: { type: "message", text: COMMANDS.today } },
  { label: COMMANDS.tomorrow, action: { type: "message", text: COMMANDS.tomorrow } },
  // Opens the LINE "add job" form (LIFF). Replaced "เปิดระบบ PR-OS" on 20 Oct
  // 2026: staff registered from the group have no web login.
  { label: "เพิ่มงาน", action: { type: "uri", uri: LIFF_ADD_EVENT_URL } },
  { label: COMMANDS.pending, action: { type: "message", text: COMMANDS.pending } },
  { label: COMMANDS.help, action: { type: "message", text: COMMANDS.help } },
];

/** The zone labels "ของฉัน / ของทีม" sit in a strip across the top; the top row of buttons includes it. */
export const RICH_MENU_BAND = 110;

export function richMenuDefinition(): Record<string, unknown> {
  const W = 2500;
  const H = 843;
  const cols = 3;
  const cellW = Math.floor(W / cols);
  // Must match scripts/render-rich-menu.mjs: strip 110 px, then two rows.
  const cellH = RICH_MENU_BAND + Math.floor((H - RICH_MENU_BAND) / 2);
  return {
    size: { width: W, height: H },
    selected: true,
    name: "PR-OS main menu",
    chatBarText: "เมนูงาน ปชส.",
    areas: RICH_MENU_BUTTONS.map((b, i) => {
      const col = i % cols;
      const r = Math.floor(i / cols);
      const action = { ...b.action, label: b.label };
      return {
        bounds: {
          x: col * cellW,
          y: r * cellH,
          width: col === cols - 1 ? W - col * cellW : cellW,
          height: r === 1 ? H - cellH : cellH,
        },
        action,
      };
    }),
  };
}
