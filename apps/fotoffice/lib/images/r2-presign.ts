import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  generateFotofficeR2Key,
  getFotofficeR2Bucket,
  getFotofficeR2Client,
  getFotofficeR2PublicUrl,
} from "./r2-client";
import { assertFotofficeDeletableR2Key } from "./r2-key-policy";
import { sniffImageFormat } from "./validation";

/**
 * Subida directa del navegador a R2, sin que el archivo pase por el servidor.
 *
 * ── Por qué existe ──
 *
 * Las funciones de Vercel rechazan cualquier pedido de más de 4,5 MB con
 * `413 FUNCTION_PAYLOAD_TOO_LARGE`. Para un logo alcanza; para la obra de un fotógrafo, no. Es el
 * mismo problema que el módulo de Cursos ya resolvió con los videos de las clases, y con la misma
 * forma: el servidor entrega un permiso de escritura de un solo uso y el navegador sube solo.
 *
 * ── El precio, y cómo se paga ──
 *
 * Con subida directa el servidor nunca ve los bytes, así que `validateImageFileBytes` —que mira la
 * firma binaria del archivo— no puede correr antes. Esa validación no desaparece: se recupera
 * DESPUÉS, contra el objeto ya subido, en `verifyUploadedImage`. Sin ese segundo paso la subida
 * directa es un agujero por donde entra cualquier cosa con nombre de foto.
 */

/** Los únicos tipos que el servidor sabe verificar por firma binaria después de la subida. */
const TIPOS_VERIFICABLES = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * Un minuto para EMPEZAR la subida — no es el tiempo que puede durar. Un permiso de escritura que
 * no vence es un permiso de escritura regalado.
 */
const VENCIMIENTO_SEGUNDOS = 60;

/** Alcanza para cualquiera de las tres firmas: la de WebP es la más larga y usa 12 bytes. */
const BYTES_DE_FIRMA = 16;

export async function createFotofficeUploadUrl(params: {
  prefix: string;
  originalFilename: string;
  contentType: string;
}): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
  if (!(TIPOS_VERIFICABLES as readonly string[]).includes(params.contentType)) {
    throw new Error("Sólo se admiten imágenes JPG, PNG o WebP.");
  }

  const key = generateFotofficeR2Key(params.originalFilename, params.prefix);
  // Antes de firmar nada: una key fuera del namespace de FotoOffice no se firma ni por error.
  assertFotofficeDeletableR2Key(key);

  const uploadUrl = await getSignedUrl(
    getFotofficeR2Client(),
    new PutObjectCommand({
      Bucket: getFotofficeR2Bucket(),
      Key: key,
      ContentType: params.contentType,
    }),
    { expiresIn: VENCIMIENTO_SEGUNDOS },
  );

  return { uploadUrl, key, publicUrl: getFotofficeR2PublicUrl(key) };
}

export type VerifyUploadedImageResult =
  | { ok: true; sizeBytes: number; contentType: string }
  | { ok: false; error: string };

/**
 * Qué se subió de verdad.
 *
 * El navegador miente: el `Content-Type` lo pone él y el tamaño puede no ser el que declaró. Acá se
 * lee el objeto ya subido —su tamaño real y sus primeros bytes— y se decide con eso, no con lo que
 * dijo el cliente.
 */
export async function verifyUploadedImage(params: {
  key: string;
  maxFileSizeBytes: number;
  acceptedFormats: readonly string[];
}): Promise<VerifyUploadedImageResult> {
  let key: string;
  try {
    key = assertFotofficeDeletableR2Key(params.key);
  } catch {
    return { ok: false, error: "No pudimos verificar el archivo subido." };
  }

  const client = getFotofficeR2Client();
  const bucket = getFotofficeR2Bucket();

  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  const sizeBytes = head.ContentLength ?? 0;
  if (sizeBytes <= 0) return { ok: false, error: "El archivo llegó vacío. Probá de nuevo." };
  if (sizeBytes > params.maxFileSizeBytes) {
    const maxMb = Math.round(params.maxFileSizeBytes / (1024 * 1024));
    return { ok: false, error: `La foto supera el máximo de ${maxMb} MB.` };
  }

  // Sólo los primeros bytes: alcanza para la firma binaria y no baja la foto entera.
  const primeros = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key, Range: `bytes=0-${BYTES_DE_FIRMA - 1}` }),
  );
  const bytes = await (
    primeros.Body as { transformToByteArray: () => Promise<Uint8Array> }
  ).transformToByteArray();

  const format = sniffImageFormat(bytes);
  if (!format || !params.acceptedFormats.includes(format)) {
    return { ok: false, error: "El archivo no es una imagen JPG, PNG o WebP válida." };
  }

  return { ok: true, sizeBytes, contentType: format };
}
