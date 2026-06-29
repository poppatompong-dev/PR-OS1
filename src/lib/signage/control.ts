// "ภาษากลาง" ระหว่างจอ TV (จอใบ้) กับหน้า control (รีโมท)
// prototype: ใช้ localStorage + storage event (เครื่อง/เบราว์เซอร์เดียวกันคุยกันทันที)
// production: เปลี่ยนเป็น Supabase Realtime ให้สั่งข้ามเครื่องได้

export type ControlState = {
  channel: string | null;   // บังคับช่อง (null = ปล่อยให้สลับอัตโนมัติ)
  auto: boolean;            // เปิด/ปิดสลับอัตโนมัติ
  theme: "dark" | "light";
  radio: boolean;          // สั่งเปิดวิทยุ (จอจะพยายามเล่นถ้า user เคย interact)
  stationIdx: number;
  ts: number;              // เวลาแก้ล่าสุด (ใช้ trigger)
};

export const CONTROL_KEY = "pros-monitor-control";

export const DEFAULT_CONTROL: ControlState = {
  channel: null, auto: true, theme: "dark", radio: false, stationIdx: 0, ts: 0,
};

export function readControl(): ControlState {
  if (typeof window === "undefined") return DEFAULT_CONTROL;
  try {
    const raw = localStorage.getItem(CONTROL_KEY);
    return raw ? { ...DEFAULT_CONTROL, ...JSON.parse(raw) } : DEFAULT_CONTROL;
  } catch { return DEFAULT_CONTROL; }
}

export function writeControl(patch: Partial<ControlState>) {
  if (typeof window === "undefined") return;
  const next = { ...readControl(), ...patch, ts: Date.now() };
  localStorage.setItem(CONTROL_KEY, JSON.stringify(next));
  // กระตุ้น event ในแท็บเดียวกันด้วย (storage event ยิงเฉพาะข้ามแท็บ)
  window.dispatchEvent(new CustomEvent("pros-control", { detail: next }));
}
