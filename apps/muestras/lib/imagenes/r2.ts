import "server-only";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { CLAVE_PDF } from "./clave-pdf";

/**
 * Bucket R2 de FOTOFFICE, bajo el prefijo `muestras/`. Mismas variables que
 * `apps/fotoffice/lib/images/r2-client.ts`.
 */
function config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET;
  const publicUrl = (process.env.R2_PUBLIC_URL || process.env.R2_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  const endpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  if (!accessKeyId || !secretAccessKey || !bucket || !publicUrl || !endpoint) {
    throw new Error("Falta configurar el almacenamiento de imágenes (R2).");
  }
  return { accessKeyId, secretAccessKey, bucket, publicUrl, endpoint };
}

let cliente: S3Client | null = null;

function s3(c: ReturnType<typeof config>): S3Client {
  cliente ??= new S3Client({
    region: "auto",
    endpoint: c.endpoint,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
  });
  return cliente;
}

export async function subirAR2(bytes: Buffer, clave: string, contentType: string): Promise<string> {
  const c = config();
  await s3(c).send(
    new PutObjectCommand({
      Bucket: c.bucket,
      Key: clave,
      Body: bytes,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return `${c.publicUrl}/${clave}`;
}

/**
 * Lee un objeto propio del bucket a partir de su URL pública. Lo usa la ruta anónima de la
 * curaduría: el curador recibe la imagen sin ver la URL, que lleva el id de quien la subió.
 * `null` si la URL no es nuestra, el objeto no existe o falta configurar el bucket.
 */
export async function leerDeR2(urlPublica: string): Promise<{ cuerpo: ReadableStream; contentType: string } | null> {
  try {
    // Dentro del try: sin configuración la imagen no está (404), no es un error del servidor.
    const c = config();
    const prefijo = `${c.publicUrl}/`;
    if (!urlPublica.startsWith(prefijo)) return null;
    const clave = urlPublica.slice(prefijo.length);
    if (!/^muestras\/[A-Za-z0-9._/-]+$/.test(clave) || clave.includes("..")) return null;
    const r = await s3(c).send(new GetObjectCommand({ Bucket: c.bucket, Key: clave }));
    if (!r.Body) return null;
    return { cuerpo: r.Body.transformToWebStream(), contentType: r.ContentType ?? "image/webp" };
  } catch (err) {
    console.error("[muestras] R2 lectura:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

/** El objeto entero en memoria (para pasarlo por sharp). `null` en los mismos casos que `leerDeR2`. */
export async function leerBytesDeR2(urlPublica: string): Promise<Buffer | null> {
  const r = await leerDeR2(urlPublica);
  if (!r) return null;
  try {
    return Buffer.from(await new Response(r.cuerpo).arrayBuffer());
  } catch (err) {
    console.error("[muestras] R2 lectura completa:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Sube un PDF de piezas para imprimir (etapa 4, D4): Vercel corta las respuestas de más de
 * 4,5 MB, así que los PDF pesados se bajan del bucket. La clave lleva la huella del contenido:
 * no se adivina y el mismo PDF pisa al mismo objeto.
 */
export async function subirPdfAR2(bytes: Uint8Array, clave: string, nombreArchivo: string): Promise<string> {
  if (!CLAVE_PDF.test(clave)) throw new Error("Clave de PDF inválida.");
  const c = config();
  await s3(c).send(
    new PutObjectCommand({
      Bucket: c.bucket,
      Key: clave,
      Body: bytes,
      ContentType: "application/pdf",
      ContentDisposition: `attachment; filename="${nombreArchivo.replace(/[^A-Za-z0-9._-]/g, "-")}"`,
      CacheControl: "public, max-age=86400",
    }),
  );
  return `${c.publicUrl}/${clave}`;
}
