/**
 * Almacenamiento de la foto del jurado en el bucket privado de FotoRank.
 *
 * Reemplaza a judgeAvatarStorage.ts, que escribía en el disco del servidor:
 * en Vercel ese disco se borra en cada despliegue.
 *
 * El hash del contenido va EN LA CLAVE: al cambiar la foto cambia la URL, así
 * que la ruta se puede cachear sin miedo a que quede pegada la anterior.
 */
import { createHash } from "node:crypto";

import { getPrivateContestStorageProvider } from "../storage/provider";
import {
  buildJudgeAvatarKey,
  parseJudgeAvatarKey,
  isJudgeAvatarKey,
  type JudgeAvatarExtension,
} from "./judgeAvatar";
import {
  buildPortfolioKey,
  contentTypeForPortfolioExtension,
  extensionForPortfolioMime,
  parsePortfolioKey,
  PORTFOLIO_MAX_BYTES,
  type PortfolioExtension,
} from "./portfolioKeys";

export type { JudgeAvatarExtension };
export { buildJudgeAvatarKey, parseJudgeAvatarKey, isJudgeAvatarKey };

export const JUDGE_AVATAR_MAX_BYTES = 2 * 1024 * 1024;

const MIME_TO_EXT: Record<string, JudgeAvatarExtension> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const EXT_TO_MIME: Record<JudgeAvatarExtension, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function extensionForJudgeAvatarMime(mime: string): JudgeAvatarExtension | null {
  return MIME_TO_EXT[mime.trim().toLowerCase()] ?? null;
}

export function contentTypeForJudgeAvatarExtension(ext: JudgeAvatarExtension): string {
  return EXT_TO_MIME[ext];
}

export function hashJudgeAvatarContent(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex").slice(0, 32);
}

export async function saveJudgeAvatar(input: {
  judgeAccountId: string;
  body: Uint8Array;
  mime: string;
}): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
  const ext = extensionForJudgeAvatarMime(input.mime);
  if (!ext) return { ok: false, error: "Formato no permitido. Usá JPEG, PNG o WebP." };
  if (input.body.length === 0) return { ok: false, error: "El archivo está vacío." };
  if (input.body.length > JUDGE_AVATAR_MAX_BYTES) {
    return { ok: false, error: "La imagen supera los 2 MB." };
  }

  const hash = hashJudgeAvatarContent(input.body);
  const key = buildJudgeAvatarKey(input.judgeAccountId, hash, ext);
  const storage = getPrivateContestStorageProvider();
  await storage.putObject(key, input.body, contentTypeForJudgeAvatarExtension(ext));
  return { ok: true, key };
}

export async function deleteJudgeAvatarByKey(key: string): Promise<void> {
  if (!parseJudgeAvatarKey(key)) return;
  const storage = getPrivateContestStorageProvider();
  await storage.deleteObject(key);
}

export async function savePortfolioImage(input: {
  judgeAccountId: string;
  body: Uint8Array;
  mime: string;
}): Promise<
  | { ok: true; key: string; hash: string; ext: PortfolioExtension; sizeBytes: number }
  | { ok: false; error: string }
> {
  const ext = extensionForPortfolioMime(input.mime);
  if (!ext) return { ok: false, error: "Formato no permitido. Usá JPEG, PNG o WebP." };
  if (input.body.length === 0) return { ok: false, error: "El archivo está vacío." };
  if (input.body.length > PORTFOLIO_MAX_BYTES) {
    return { ok: false, error: "La imagen supera los 4 MB incluso después de achicarla." };
  }

  const hash = hashJudgeAvatarContent(input.body);
  const key = buildPortfolioKey(input.judgeAccountId, hash, ext);
  const storage = getPrivateContestStorageProvider();
  await storage.putObject(key, input.body, contentTypeForPortfolioExtension(ext));
  return { ok: true, key, hash, ext, sizeBytes: input.body.length };
}

export async function deletePortfolioImageByKey(key: string): Promise<void> {
  // Una clave que no es de portfolio no se borra: no vaya a ser que llegue acá
  // la de un avatar o la de una obra de concurso.
  if (!parsePortfolioKey(key)) return;
  const storage = getPrivateContestStorageProvider();
  await storage.deleteObject(key);
}
