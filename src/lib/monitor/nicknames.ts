// What the TV calls each person (first name when not listed). Client-safe:
// the bench (server) and the birthday banner (browser) both use it.
// 4 Nov 2026: วิภัสรา is "ภัส" (owner), not "พัท".

import { shortName } from "@/lib/names";

const NICKNAMES: Record<string, string> = {
  "00000000-0000-0000-0000-000000000501": "พี่ไป๋",
  "00000000-0000-0000-0000-000000000502": "พี่เอิร์ธ",
  "00000000-0000-0000-0000-000000000503": "กุ๊ก",
  "00000000-0000-0000-0000-000000000504": "นัท",
  "00000000-0000-0000-0000-000000000505": "แป้ง",
  "00000000-0000-0000-0000-000000000506": "แข",
  "dd5a7eb4-d62a-45bc-b11b-33dae93d6b49": "ภัส",
  "1b378ad3-73a3-461c-985e-b1d52189dbee": "พี่เอ๋",
};

export const nickname = (id: string | undefined, displayName: string) => (id && NICKNAMES[id]) || shortName(displayName);
