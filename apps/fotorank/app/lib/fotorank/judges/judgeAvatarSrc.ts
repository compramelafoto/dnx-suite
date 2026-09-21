/**
 * Única forma de armar el src de la foto de un jurado. No duplicar en pantallas.
 */
import { parseJudgeAvatarKey } from "./judgeAvatar";

export function judgeAvatarSrc(profile: { id: string; avatarUrl: string | null }): string | null {
  const raw = profile.avatarUrl?.trim();
  if (!raw) return null;
  if (raw.startsWith("https://") || raw.startsWith("http://")) return raw;
  const parsed = parseJudgeAvatarKey(raw);
  if (!parsed) return null;
  return `/api/jurados/avatar/${profile.id}/${parsed.hash}.${parsed.ext}`;
}
