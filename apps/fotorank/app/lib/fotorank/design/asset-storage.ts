/**
 * Imágenes que se suben dentro del diseñador (un fondo, un logo, una firma).
 *
 * FotoRank no tiene almacenamiento público: todo va al privado (R2 en producción, disco en
 * desarrollo) y se sirve por rutas propias. Estas imágenes no son sensibles —son parte del
 * diseño de un diploma—, así que su ruta las entrega a cualquiera que tenga la dirección; el
 * nombre del archivo es un UUID, imposible de adivinar.
 *
 * Módulo puro: sólo arma y valida claves y direcciones.
 */

const KEY_ROOT = "fotorank/design-templates";
export const DESIGN_ASSET_URL_PREFIX = "/api/fotorank/design-assets/";

const SEGMENTO = /^[A-Za-z0-9_-]{1,80}$/;
const ARCHIVO = /^[A-Za-z0-9_-]{1,80}\.(png|jpg|jpeg|webp|svg|gif)$/i;

export function designAssetKey(input: {
  templateId: string;
  versionId: string;
  fileName: string;
}): string {
  return `${KEY_ROOT}/${input.templateId}/${input.versionId}/${input.fileName}`;
}

export function designAssetUrl(key: string): string {
  return `${DESIGN_ASSET_URL_PREFIX}${key.slice(KEY_ROOT.length + 1)}`;
}

/**
 * De los segmentos de la ruta pública a la clave del almacenamiento, o `null` si no tienen la
 * forma esperada. Es la defensa contra `..` o contra pedir otra cosa del bucket privado.
 */
export function designAssetKeyFromSegments(segments: string[]): string | null {
  if (segments.length !== 3) return null;
  const [templateId = "", versionId = "", fileName = ""] = segments;
  if (!SEGMENTO.test(templateId) || !SEGMENTO.test(versionId) || !ARCHIVO.test(fileName)) {
    return null;
  }
  return designAssetKey({ templateId, versionId, fileName });
}

/**
 * Si una referencia de imagen del diseño apunta a esta ruta —relativa o absoluta—, la clave del
 * almacenamiento. Sirve para que el servidor lea los bytes directo en vez de pedirse a sí mismo.
 */
export function designAssetKeyFromRef(ref: string): string | null {
  let path = ref;
  if (/^https?:\/\//i.test(ref)) {
    try {
      path = new URL(ref).pathname;
    } catch {
      return null;
    }
  }
  if (!path.startsWith(DESIGN_ASSET_URL_PREFIX)) return null;
  const resto = path.slice(DESIGN_ASSET_URL_PREFIX.length).split("?")[0] ?? "";
  return designAssetKeyFromSegments(resto.split("/").map((s) => decodeURIComponent(s)));
}

export function contentTypeForAsset(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}
