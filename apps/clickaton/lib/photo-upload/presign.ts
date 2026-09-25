/**
 * Firma de una URL de subida (SigV4, estilo query string).
 *
 * Se escribe a mano, con lo que ya trae Node, en vez de sumar
 * `@aws-sdk/s3-request-presigner`: esa dependencia reordena el lockfile del
 * monorepo y arrastra una segunda copia de `@smithy/types`, que rompe el
 * chequeo de tipos de CompraMeLaFoto. Una foto no vale contaminar la
 * resolución de dependencias de las otras plataformas.
 *
 * El algoritmo es el estándar de S3, que R2 implementa igual.
 */
import { createHash, createHmac } from "node:crypto";

const ALGORITHM = "AWS4-HMAC-SHA256";
const SERVICE = "s3";
/** R2 no tiene regiones: firma siempre contra "auto". */
const REGION = "auto";

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

/**
 * Cada segmento de la ruta se codifica por separado: las barras que separan
 * carpetas son estructura, no contenido, y no deben escaparse.
 */
function encodeKey(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/** `20260919T143000Z` y `20260919`, que es como los pide la firma. */
export function amzDates(now: Date): { amzDate: string; dateStamp: string } {
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
}

type EntradaDeFirma = {
  endpoint: string;
  bucket: string;
  key: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresInSeconds: number;
  now?: Date;
};

/** Codificación estricta de SigV4 (RFC 3986): los espacios son %20, no "+". */
function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function presignUrl(
  method: "GET" | "PUT",
  input: EntradaDeFirma,
  extra: Record<string, string>,
): string {
  const { amzDate, dateStamp } = amzDates(input.now ?? new Date());
  const url = new URL(input.endpoint);
  // Estilo path: el bucket va en la ruta, no en el nombre del servidor.
  //
  // El SDK de Amazon arma la variante virtual-host (`bucket.cuenta.r2...`) y
  // copiarla parecía lo prudente. No lo era: contra R2 esa dirección devuelve
  // 503 y la subida del navegador muere ahí, sin que el servidor se entere.
  // Verificado en producción el 2026-09-19, con la maratón en curso.
  const host = url.host;
  const canonicalUri = `${url.pathname.replace(/\/$/, "")}/${input.bucket}/${encodeKey(input.key)}`;

  const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;

  // Sólo se firma `host`. El navegador puede mandar otras cabeceras —el tipo de
  // archivo, por ejemplo— sin invalidar la firma, y el tipo real lo determina
  // el servidor leyendo los bytes, no lo que el cliente declare.
  const params: Record<string, string> = {
    "X-Amz-Algorithm": ALGORITHM,
    "X-Amz-Content-Sha256": "UNSIGNED-PAYLOAD",
    "X-Amz-Credential": `${input.accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(input.expiresInSeconds),
    "X-Amz-SignedHeaders": "host",
    ...extra,
  };
  // La consulta canónica va ordenada por nombre de parámetro.
  const query = Object.keys(params)
    .sort()
    .map((k) => `${encodeRfc3986(k)}=${encodeRfc3986(params[k]!)}`)
    .join("&");

  const canonicalRequest = [
    method,
    canonicalUri,
    query,
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    ALGORITHM,
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${input.secretAccessKey}`, dateStamp), REGION), SERVICE),
    "aws4_request",
  );
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign, "utf8")
    .digest("hex");

  return `${url.origin}${canonicalUri}?${query}&X-Amz-Signature=${signature}`;
}

export function presignPutUrl(input: EntradaDeFirma): string {
  // El SDK oficial agrega `x-id` y lo firma; se replica para que la URL sea
  // exactamente la que el proveedor ya acepta del resto de la suite.
  return presignUrl("PUT", input, { "x-id": "PutObject" });
}

/**
 * URL temporal para bajar un archivo privado directo del bucket.
 *
 * Los originales pesan más que el tope de respuesta de una función de Vercel
 * (4,5 MB), así que no pueden pasar por el servidor. El nombre de archivo va
 * firmado: R2 lo devuelve como `Content-Disposition` y el navegador descarga
 * en vez de abrir.
 */
/** Sólo ASCII: "Ana Pérez.jpg" → "Ana_Perez.jpg". */
export function nombreDeArchivoSeguro(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "_");
}

export function presignGetUrl(input: EntradaDeFirma & { downloadFileName?: string }): string {
  const extra: Record<string, string> = { "x-id": "GetObject" };
  if (input.downloadFileName) {
    extra["response-content-disposition"] =
      `attachment; filename="${nombreDeArchivoSeguro(input.downloadFileName)}"`;
  }
  return presignUrl("GET", input, extra);
}
