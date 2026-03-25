/**
 * Avatar del jurado: validación de URL pública y límites para subida de archivo.
 */

export const JUDGE_AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MiB
export const JUDGE_AVATAR_ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const AVATAR_URL_MAX_LEN = 2048;

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

/**
 * Nombre de archivo seguro bajo uploads/judges (sin path traversal), o null si no es un avatar gestionado localmente.
 * No usa fs (seguro de importar en cliente).
 */
export function managedJudgeAvatarFilenameFromPublicUrl(publicUrl: string | null | undefined): string | null {
  const s = publicUrl?.trim();
  if (!s || !s.startsWith("/uploads/judges/")) return null;
  const rest = s.slice("/uploads/judges/".length);
  if (!rest || rest.includes("..") || rest.includes("/") || rest.includes("\\")) return null;
  if (!/^[a-f0-9]{32}\.(jpg|png|webp)$/.test(rest)) return null;
  return rest;
}

export function isManagedJudgeAvatarPublicUrl(publicUrl: string | null | undefined): boolean {
  return managedJudgeAvatarFilenameFromPublicUrl(publicUrl) !== null;
}

/** Acepta URL absoluta http(s) o ruta local segura de avatar subido por admin. */
export function normalizeStoredJudgeAvatarRef(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  if (s.startsWith("/uploads/judges/")) {
    const filename = managedJudgeAvatarFilenameFromPublicUrl(s);
    if (!filename) return null;
    return `/uploads/judges/${filename}`;
  }
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
