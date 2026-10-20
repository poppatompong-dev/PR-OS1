import { AVATAR_FILES } from "./avatars-manifest";

export const DEFAULT_AVATAR = "/avatars/default.png";

/** Cartoon avatar for a person, or the mascot when none has been drawn yet. */
export function avatarUrl(personId: string | null | undefined): string {
  const file = personId ? AVATAR_FILES[personId] : undefined;
  return file ? `/avatars/${file}` : DEFAULT_AVATAR;
}

export function hasAvatar(personId: string | null | undefined): boolean {
  return Boolean(personId && AVATAR_FILES[personId]);
}
