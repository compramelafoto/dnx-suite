/**
 * Avatar del jurado: validación de URL pública y límites para subida de archivo.
 */

export const JUDGE_AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MiB
export const JUDGE_AVATAR_ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const AVATAR_URL_MAX_LEN = 2048;

export type JudgeAvatarExtension = "jpg" | "png" | "webp";

const JUDGE_AVATAR_KEY_RE =
  /^fotorank\/judges\/([A-Za-z0-9_-]+)\/avatar\/([a-f0-9]+)\.(jpg|png|webp)$/;

export function buildJudgeAvatarKey(
  judgeAccountId: string,
  hash: string,
  ext: JudgeAvatarExtension,
): string {
  return `fotorank/judges/${judgeAccountId}/avatar/${hash}.${ext}`;
}

export function parseJudgeAvatarKey(
  key: string,
): { judgeAccountId: string; hash: string; ext: string } | null {
  const m = JUDGE_AVATAR_KEY_RE.exec(key);
  if (!m) return null;
  return { judgeAccountId: m[1]!, hash: m[2]!, ext: m[3]! };
}

export function isJudgeAvatarKey(value: string | null | undefined): boolean {
  return !!value && parseJudgeAvatarKey(value.trim()) !== null;
}


export function extensionForJudgeAvatarMime(mime: string): string | null {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}

/**
 * Normaliza URL de avatar (http/https) o null si vacío/ inválida.
 */
export function normalizeJudgeAvatarUrl(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  if (s.length > AVATAR_URL_MAX_LEN) return null;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname) return null;
  return url.toString();
}

/** Acepta una clave del bucket privado o una URL absoluta http(s). */
export function normalizeStoredJudgeAvatarRef(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  if (parseJudgeAvatarKey(s)) return s;
  return normalizeJudgeAvatarUrl(s);
}

/** Sitio web público (http/https). Si falta protocolo, se asume https. */
export function normalizeJudgeWebsite(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  return normalizeJudgeAvatarUrl(withProto);
}

const INSTAGRAM_MAX = 120;

/** Instagram: handle o URL; sin HTML. */
export function normalizeJudgeInstagram(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  if (s.length > INSTAGRAM_MAX) return null;
  if (/[<>]/.test(s)) return null;
  if (/^https?:\/\//i.test(s)) {
    return normalizeJudgeAvatarUrl(s);
  }
  return s.replace(/^@+/, "").trim() || null;
}
