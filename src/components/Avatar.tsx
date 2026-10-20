/* eslint-disable @next/next/no-img-element -- tiny static PNGs from /public; next/image adds nothing here */
import { avatarUrl } from "@/lib/avatars";

/** Round cartoon avatar. Falls back to the mascot for anyone without a drawing. */
export function Avatar({
  personId,
  name,
  size = 32,
  eager = false,
  className = "",
}: {
  personId: string | null | undefined;
  name: string;
  size?: number;
  eager?: boolean;
  className?: string;
}) {
  return (
    <img
      className={`avatar ${className}`.trim()}
      src={avatarUrl(personId)}
      alt={name}
      title={name}
      width={size}
      height={size}
      decoding="async"
      loading={eager ? "eager" : "lazy"}
      style={{ width: size, height: size }}
    />
  );
}
