/**
 * Área de staging para la subida directa al storage privado.
 *
 * Por qué existe: la función serverless tiene un tope duro de 4,5 MB por
 * pedido (Vercel: FUNCTION_PAYLOAD_TOO_LARGE), mientras que las bases del
 * concurso admiten JPEG de hasta 25 MB. Mandar el archivo *a través* de la
 * función es entonces imposible por diseño para la mayoría de las obras. El
 * navegador sube el original directo al bucket privado con una URL firmada, y
 * la función después lo lee de ahí — el archivo nunca pasa por el pedido HTTP
 * a la app.
 *
 * El objeto de staging es efímero: `processStagedUpload` lo borra apenas lo
 * consumió, y `orphan-assets-report.ts` puede barrer los que hayan quedado de
 * envíos abandonados.
 */
import { randomBytes } from "node:crypto";

/**
 * Sólo hex de 32 caracteres. El cliente devuelve este id para decir "ya subí";
 * el servidor reconstruye la key completa a partir de él. Nunca se acepta una
 * key armada por el cliente: eso permitiría apuntar a objetos de otras obras.
 */
const STAGED_UPLOAD_ID_RE = /^[0-9a-f]{32}$/;

export function newStagedUploadId(): string {
  return randomBytes(16).toString("hex");
}

export function isValidStagedUploadId(value: unknown): value is string {
  return typeof value === "string" && STAGED_UPLOAD_ID_RE.test(value);
}

/**
 * Key sin PII, bajo el prefijo de la obra: aunque el id fuera adivinado, cae
 * dentro del árbol del entry cuya propiedad ya se validó.
 */
export function buildStagedUploadKey(input: {
  contestId: string;
  entryId: string;
  uploadId: string;
}): string {
  if (!input.contestId || !input.entryId) {
    throw new Error("contestId y entryId son obligatorios para la key de staging.");
  }
  if (!isValidStagedUploadId(input.uploadId)) {
    throw new Error("uploadId inválido para la key de staging.");
  }
  return `fotorank/contests/${input.contestId}/entries/${input.entryId}/staging/${input.uploadId}`;
}

/** Ventana para completar el PUT: una foto de 25 MB por red móvil lenta. */
export const STAGED_UPLOAD_URL_TTL_SECONDS = 900;
