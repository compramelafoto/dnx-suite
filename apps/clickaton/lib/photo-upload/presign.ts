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

export function presignPutUrl(input: {
  endpoint: string;
  bucket: string;
  key: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresInSeconds: number;
  now?: Date;
}): string {
  const { amzDate, dateStamp } = amzDates(input.now ?? new Date());
  const url = new URL(input.endpoint);
  // Estilo virtual-host: el bucket viaja en el nombre del servidor, igual que
  // lo arma el SDK oficial y que ya usa FotoRank contra este mismo proveedor.
  const host = `${input.bucket}.${url.host}`;
  const canonicalUri = `/${encodeKey(input.key)}`;

  const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;

  // Sólo se firma `host`. El navegador puede mandar otras cabeceras —el tipo de
  // archivo, por ejemplo— sin invalidar la firma, y el tipo real lo determina
  // el servidor leyendo los bytes, no lo que el cliente declare.
  const query = new URLSearchParams({
    "X-Amz-Algorithm": ALGORITHM,
    "X-Amz-Content-Sha256": "UNSIGNED-PAYLOAD",
    "X-Amz-Credential": `${input.accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(input.expiresInSeconds),
    "X-Amz-SignedHeaders": "host",
    // El SDK oficial lo agrega y lo firma; se replica para que la URL sea
    // exactamente la que el proveedor ya acepta del resto de la suite.
    "x-id": "PutObject",
  });
  // La consulta canónica va ordenada por nombre de parámetro.
  query.sort();

  const canonicalRequest = [
    "PUT",
    canonicalUri,
    query.toString(),
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

  return `${url.protocol}//${host}${canonicalUri}?${query.toString()}&X-Amz-Signature=${signature}`;
}
