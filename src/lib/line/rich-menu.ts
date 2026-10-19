// The button panel under the bot's chat. 2 rows × 3 buttons on LINE's
// "compact" size (2500 × 843). The picture is public/line/rich-menu.png —
// regenerate it with scripts/render-rich-menu.mjs if the labels change, so
// the picture and the tap areas stay in step.

import { COMMANDS, appUrl } from "@/lib/line/messages";

export const RICH_MENU_IMAGE_PATH = "/line/rich-menu.png";

export const RICH_MENU_BUTTONS: Array<{ label: string; action: Record<string, string> }> = [
  { label: COMMANDS.mine, action: { type: "message", text: COMMANDS.mine } },
  { label: COMMANDS.today, action: { type: "message", text: COMMANDS.today } },
  { label: COMMANDS.tomorrow, action: { type: "message", text: COMMANDS.tomorrow } },
  { label: COMMANDS.pending, action: { type: "message", text: COMMANDS.pending } },
  { label: "เปิดระบบ PR-OS", action: { type: "uri", uri: "" } },
  { label: COMMANDS.help, action: { type: "message", text: COMMANDS.help } },
];

export function richMenuDefinition(): Record<string, unknown> {
  const W = 2500;
  const H = 843;
  const cols = 3;
  const cellW = Math.floor(W / cols);
  const cellH = Math.floor(H / 2);
  return {
    size: { width: W, height: H },
    selected: true,
    name: "PR-OS main menu",
    chatBarText: "เมนูงาน ปชส.",
    areas: RICH_MENU_BUTTONS.map((b, i) => {
      const col = i % cols;
      const r = Math.floor(i / cols);
      const action = b.action.type === "uri" ? { type: "uri", label: b.label, uri: appUrl("/") } : { ...b.action, label: b.label };
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
