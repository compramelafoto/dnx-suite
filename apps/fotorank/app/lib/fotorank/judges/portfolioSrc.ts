/**
 * Única forma de armar el src de una imagen de portfolio. No duplicar en
 * pantallas: el hash tiene que ir siempre, o se queda pegada la imagen vieja.
 */
import { parsePortfolioKey } from "./portfolioKeys";

export function portfolioImageSrc(img: {
  id: string;
  contentHash: string;
  storageKey: string;
}): string | null {
  const clave = img.storageKey?.trim();
  if (!clave) return null;
  const parsed = parsePortfolioKey(clave);
  if (!parsed) return null;
  return `/api/jurados/portfolio/${img.id}/${parsed.hash}.${parsed.ext}`;
}
