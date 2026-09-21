/**
 * Claves de las imágenes de portfolio de un jurado.
 *
 * Módulo puro, igual que judgeAvatar.ts: no toca el disco ni el proveedor de
 * almacenamiento, así que lo puede importar tanto el servidor como una pantalla
 * de cliente.
 */
export const PORTFOLIO_MAX_IMAGENES = 12;

/** Por debajo del tope de 4,5 MB de Vercel para una acción de servidor. */
export const PORTFOLIO_MAX_BYTES = 4 * 1024 * 1024;

export type PortfolioExtension = "jpg" | "png" | "webp";

const MIME_A_EXT: Record<string, PortfolioExtension> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const EXT_A_MIME: Record<PortfolioExtension, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const CLAVE_RE =
  /^fotorank\/judges\/([A-Za-z0-9_-]+)\/portfolio\/([a-f0-9]+)\.(jpg|png|webp)$/;

export function extensionForPortfolioMime(mime: string): PortfolioExtension | null {
  return MIME_A_EXT[mime.trim().toLowerCase()] ?? null;
}

export function contentTypeForPortfolioExtension(ext: PortfolioExtension): string {
  return EXT_A_MIME[ext];
}

export function buildPortfolioKey(
  judgeAccountId: string,
  hash: string,
  ext: PortfolioExtension,
): string {
  return `fotorank/judges/${judgeAccountId}/portfolio/${hash}.${ext}`;
}

export function parsePortfolioKey(
  key: string,
): { judgeAccountId: string; hash: string; ext: string } | null {
  const m = CLAVE_RE.exec(key);
  if (!m) return null;
  return { judgeAccountId: m[1]!, hash: m[2]!, ext: m[3]! };
}
