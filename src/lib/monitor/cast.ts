// ตัวการ์ตูนเต็มตัวบนทีวี (แบบ M, 4 Nov 2026): sprites made in Blender from each
// person's own avatar (head cut out) — public/cast/<personId>/<pose>.webp.
// Add a person: render their 8 poses with the same pipeline, then list them here.

export const CAST_POSES = ["stand", "walkA", "walkB", "runA", "runB", "wave", "up", "sit"] as const;
export type CastPose = (typeof CAST_POSES)[number];

export const CAST_IDS: string[] = [
  "00000000-0000-0000-0000-000000000501", // พี่ไป๋
  "00000000-0000-0000-0000-000000000502", // พี่เอิร์ธ
  "00000000-0000-0000-0000-000000000503", // กุ๊ก
  "00000000-0000-0000-0000-000000000504", // นัท
  "00000000-0000-0000-0000-000000000505", // แป้ง
  "00000000-0000-0000-0000-000000000506", // แข
  "dd5a7eb4-d62a-45bc-b11b-33dae93d6b49", // ภัส
  "1b378ad3-73a3-461c-985e-b1d52189dbee", // พี่เอ๋
];

export const castUrl = (id: string, pose: CastPose) => `/cast/${id}/${pose}.webp`;
