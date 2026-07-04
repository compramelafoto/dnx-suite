/**
 * Cloudflare R2 Client Helper
 * 
 * Este módulo maneja la subida de archivos a Cloudflare R2 (S3 compatible).
 * 
 * IMPORTANTE: En Vercel (y otros entornos serverless), el filesystem es de solo lectura.
 * No se puede escribir en /public/uploads/ ni en ningún directorio del filesystem.
 * Por eso usamos R2 para almacenar archivos estáticos.
 * 
 * Variables de entorno requeridas:
 * - R2_ACCOUNT_ID: ID de cuenta de Cloudflare
 * - R2_ACCESS_KEY_ID: Access Key ID de R2
 * - R2_SECRET_ACCESS_KEY: Secret Access Key de R2
 * - R2_BUCKET_NAME: Nombre del bucket R2
 * - R2_ENDPOINT: Endpoint de R2 (ej: https://<accountid>.r2.cloudflarestorage.com)
 * - R2_PUBLIC_BASE_URL (opcional): URL pública base para construir URLs públicas
 */

import fs from "fs";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Inicializar cliente S3 para R2
let s3Client: S3Client | null = null;

/**
 * Obtiene el nombre del bucket desde las variables de entorno
 * Acepta tanto R2_BUCKET_NAME como R2_BUCKET para compatibilidad
 */
function getBucketName(): string {
  const bucketName = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET;
  if (!bucketName) {
    throw new Error(
      "R2_BUCKET_NAME o R2_BUCKET debe estar configurado en las variables de entorno"
    );
  }
  return bucketName;
}

function getS3Client(): S3Client {
  if (s3Client) {
    return s3Client;
  }

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT;
  const bucketName = getBucketName();

  if (!accountId || !accessKeyId || !secretAccessKey || !endpoint) {
    throw new Error(
      "R2 configuration missing. Required env vars: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_NAME (o R2_BUCKET)"
    );
  }

  s3Client = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return s3Client;
}

// Importar crypto para UUID
import crypto from "crypto";

/**
 * Genera una key única para un archivo en R2
 * Formato: <prefix>/uuid-sanitizedOriginalName
 * (Simplificado para cumplir con el requisito del usuario)
 */
export function generateR2Key(originalName: string, prefix: string = "uploads"): string {
  // Validación: evitar doble extensión (ej: ".jpg.jpg")
  // Si el nombre termina con algo como ".jpg.jpg", remover la extensión duplicada
  let normalizedName = originalName;
  const doubleExtMatch = normalizedName.match(/\.([a-z0-9]+)\.([a-z0-9]+)$/i);
  if (doubleExtMatch && doubleExtMatch[1] === doubleExtMatch[2]) {
    // Remover la extensión duplicada (ej: "archivo.jpg.jpg" -> "archivo.jpg")
    normalizedName = normalizedName.substring(0, normalizedName.lastIndexOf("."));
  }
  
  // Extraer extensión ANTES de sanitizar
  const hasExtension = normalizedName.includes(".");
  const ext = hasExtension 
    ? normalizedName.substring(normalizedName.lastIndexOf("."))
    : "";
  
  // Remover extensión del nombre base para sanitizar
  const nameWithoutExt = hasExtension
    ? normalizedName.substring(0, normalizedName.lastIndexOf("."))
    : normalizedName;
  
  // Sanitizar nombre del archivo (sin extensión)
  const sanitizedName = nameWithoutExt
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .replace(/_{2,}/g, "_")
    .substring(0, 100); // Limitar longitud
  
  const uuid = crypto.randomUUID();
  
  const cleanPrefix = prefix.replace(/\/+$/, "");
  // Construir key: <prefix>/uuid-sanitizedName.ext (ext solo si existía)
  // Validación final: nunca agregar extensión si ya está en sanitizedName
  const finalKey = sanitizedName.endsWith(ext) 
    ? `${cleanPrefix}/${uuid}-${sanitizedName}`
    : `${cleanPrefix}/${uuid}-${sanitizedName}${ext}`;
  
  return finalKey;
}

/**
 * Obtiene la URL pública de un archivo en R2
 * 
 * IMPORTANTE: Esta función SIEMPRE devuelve una URL absoluta (https://...)
 * Nunca devuelve rutas relativas ni localhost.
 * 
 * @param keyOrUrl - Puede ser una key de R2 (ej: "uploads/uuid-foto.jpg") 
 *                   o una URL relativa/absoluta que se normalizará
 * @returns URL absoluta de R2 (https://...)
 */
export function getPublicUrl(keyOrUrl: string): string {
  // Si ya es una URL absoluta válida (https://...), validarla y retornarla
  if (keyOrUrl.startsWith("http://") || keyOrUrl.startsWith("https://")) {
    // Validación defensiva: nunca permitir localhost en producción
    if (keyOrUrl.includes("localhost") || keyOrUrl.includes("127.0.0.1")) {
      console.warn(`⚠️ URL con localhost detectada y rechazada: ${keyOrUrl}`);
      // Convertir a key y construir URL correcta
      const key = urlToR2Key(keyOrUrl);
      return getPublicUrl(key);
    }
    // Si es una URL absoluta válida de R2, retornarla
    return keyOrUrl;
  }

  // Si es una ruta relativa como "/uploads/..." o "uploads/...", extraer la key
  let key = keyOrUrl;
  if (key.startsWith("/uploads/") || key.startsWith("/")) {
    key = key.replace(/^\//, "");
    console.warn(`⚠️ Ruta relativa detectada y normalizada: "${keyOrUrl}" -> key: "${key}"`);
  }

  // Prioridad 1: R2_PUBLIC_URL (si está configurado)
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (publicUrl) {
    const finalUrl = `${publicUrl.replace(/\/$/, "")}/${key}`;
    // Validación final: nunca devolver localhost
    if (finalUrl.includes("localhost") || finalUrl.includes("127.0.0.1")) {
      throw new Error(`R2_PUBLIC_URL contiene localhost, no permitido en producción: ${publicUrl}`);
    }
    return finalUrl;
  }
  
  // Prioridad 2: R2_PUBLIC_BASE_URL (compatibilidad con nombre anterior)
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;
  if (publicBaseUrl) {
    const finalUrl = `${publicBaseUrl.replace(/\/$/, "")}/${key}`;
    // Validación final: nunca devolver localhost
    if (finalUrl.includes("localhost") || finalUrl.includes("127.0.0.1")) {
      throw new Error(`R2_PUBLIC_BASE_URL contiene localhost, no permitido en producción: ${publicBaseUrl}`);
    }
    return finalUrl;
  }

  // Prioridad 2.5: NEXT_PUBLIC_R2_PUBLIC_URL (para uso en cliente/local)
  const publicUrlClient = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (publicUrlClient) {
    const finalUrl = `${publicUrlClient.replace(/\/$/, "")}/${key}`;
    if (finalUrl.includes("localhost") || finalUrl.includes("127.0.0.1")) {
      throw new Error(
        `NEXT_PUBLIC_R2_PUBLIC_URL contiene localhost, no permitido en producción: ${publicUrlClient}`
      );
    }
    return finalUrl;
  }

  // Prioridad 2.6: NEXT_PUBLIC_R2_PUBLIC_BASE_URL (compatibilidad cliente)
  const publicBaseUrlClient = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL;
  if (publicBaseUrlClient) {
    const finalUrl = `${publicBaseUrlClient.replace(/\/$/, "")}/${key}`;
    if (finalUrl.includes("localhost") || finalUrl.includes("127.0.0.1")) {
      throw new Error(
        `NEXT_PUBLIC_R2_PUBLIC_BASE_URL contiene localhost, no permitido en producción: ${publicBaseUrlClient}`
      );
    }
    return finalUrl;
  }
  
  // Prioridad 3: Construir desde endpoint y bucket
  const endpoint = process.env.R2_ENDPOINT;
  const bucketName = getBucketName();
  
  if (!endpoint) {
    throw new Error("R2_ENDPOINT required for public URLs (o configura R2_PUBLIC_URL o R2_PUBLIC_BASE_URL)");
  }
  
  // Construir URL pública (asumiendo que R2 está configurado como público)
  // Nota: Esto puede requerir configuración adicional en Cloudflare R2
  const finalUrl = `${endpoint}/${bucketName}/${key}`;
  
  // Validación final: nunca devolver localhost
  if (finalUrl.includes("localhost") || finalUrl.includes("127.0.0.1")) {
    throw new Error(`R2_ENDPOINT contiene localhost, no permitido en producción: ${endpoint}`);
  }
  
  return finalUrl;
}

/**
 * Alias para getPublicUrl - función helper única para construir URLs públicas de R2
 * 
 * Esta es la función que debe usarse en todo el proyecto para construir URLs públicas.
 * Acepta keys o URLs y siempre devuelve una URL absoluta válida.
 */
export function getR2PublicUrl(keyOrUrl: string): string {
  return getPublicUrl(keyOrUrl);
}

async function readResponseBody(body: unknown): Promise<string | null> {
  if (!body) {
    return null;
  }

  if (typeof body === "string") {
    return body;
  }

  if (body instanceof Uint8Array || Buffer.isBuffer(body)) {
    return Buffer.from(body).toString("utf-8");
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      chunks.push(bufferChunk);
    }
    return Buffer.concat(chunks).toString("utf-8");
  } catch (innerError) {
    console.warn("[ZIP] no se pudo leer el body del response", innerError);
    return null;
  }
}

/**
 * Normaliza una previewUrl para asegurar que sea una URL absoluta de R2
 * 
 * Esta función es útil para normalizar previewUrl que pueden venir de la DB
 * con valores antiguos (rutas relativas) o para asegurar consistencia.
 * 
 * @param previewUrl - URL que puede ser relativa o absoluta
 * @param originalKey - Key original de la foto (opcional, se usa si previewUrl es inválida)
 * @returns URL absoluta de R2 (https://...)
 */
export function normalizePreviewUrl(previewUrl: string | null | undefined, originalKey?: string | null): string | null {
  // Normalizar previewUrl: tratar strings vacíos como null
  const normalizedPreviewUrl = previewUrl && previewUrl.trim() ? previewUrl.trim() : null;
  
  // Si previewUrl es null/undefined/vacío pero tenemos originalKey, construir desde originalKey
  if (!normalizedPreviewUrl && originalKey) {
    // Construir previewKey desde originalKey
    // originalKey es "uploads/uuid-original_xxx.jpg"
    // previewKey sería "uploads/uuid-preview_xxx.jpg"
    const previewKey = originalKey.replace(/original_/, "preview_");
    try {
      return getR2PublicUrl(previewKey);
    } catch (err) {
      console.error(`⚠️ Error construyendo URL desde previewKey "${previewKey}":`, err);
      return null;
    }
  }

  if (!normalizedPreviewUrl && !originalKey) {
    return null;
  }

  if (!normalizedPreviewUrl) {
    return null;
  }

  // Si ya es una URL absoluta válida, validarla y retornarla
  if (normalizedPreviewUrl.startsWith("http://") || normalizedPreviewUrl.startsWith("https://")) {
    // Validación defensiva: nunca permitir localhost
    if (normalizedPreviewUrl.includes("localhost") || normalizedPreviewUrl.includes("127.0.0.1")) {
      console.warn(`⚠️ previewUrl con localhost detectada: ${normalizedPreviewUrl}`);
      // Si tenemos originalKey, construir desde ahí
      if (originalKey) {
        const previewKey = originalKey.replace(/original_/, "preview_");
        try {
          return getR2PublicUrl(previewKey);
        } catch (err) {
          console.error(`⚠️ Error construyendo URL desde previewKey después de detectar localhost:`, err);
          return null;
        }
      }
      // Si no, intentar extraer key de la URL
      try {
        const key = urlToR2Key(normalizedPreviewUrl);
        return getR2PublicUrl(key);
      } catch (err) {
        console.error(`⚠️ Error extrayendo key de URL con localhost:`, err);
        return null;
      }
    }
    return normalizedPreviewUrl;
  }

  // Si es una ruta relativa, normalizarla
  if (normalizedPreviewUrl.startsWith("/uploads/") || normalizedPreviewUrl.startsWith("uploads/")) {
    console.warn(`⚠️ previewUrl relativa detectada y normalizada: "${normalizedPreviewUrl}"`);
    try {
      return getR2PublicUrl(normalizedPreviewUrl);
    } catch (err) {
      console.error(`⚠️ Error construyendo URL desde ruta relativa:`, err);
      // Si tenemos originalKey, intentar construir desde ahí
      if (originalKey) {
        const previewKey = originalKey.replace(/original_/, "preview_");
        try {
          return getR2PublicUrl(previewKey);
        } catch (err2) {
          console.error(`⚠️ Error construyendo URL desde previewKey después de fallar con ruta relativa:`, err2);
          return null;
        }
      }
      return null;
    }
  }

  // Si no reconocemos el formato, intentar construir desde originalKey si está disponible
  if (originalKey) {
    console.warn(`⚠️ previewUrl con formato desconocido: "${normalizedPreviewUrl}", construyendo desde originalKey`);
    const previewKey = originalKey.replace(/original_/, "preview_");
    try {
      return getR2PublicUrl(previewKey);
    } catch (err) {
      console.error(`⚠️ Error construyendo URL desde previewKey con formato desconocido:`, err);
      return null;
    }
  }

  // Último recurso: tratar como key
  try {
    return getR2PublicUrl(normalizedPreviewUrl);
  } catch (err) {
    console.error(`⚠️ Error tratando previewUrl como key:`, err);
    return null;
  }
}

/**
 * Sube un archivo a R2. Acepta un path (imagen/ZIP temporal) o un buffer.
 */
export async function uploadToR2(
  source: string | Buffer,
  key: string,
  contentType: string,
  metadata?: Record<string, string>,
  signal?: AbortSignal
): Promise<{ key: string; url: string }> {
  const client = getS3Client();
  const bucketName = getBucketName();
  const maxAttempts = 3;
  const backoffs = [500, 1500, 3500];
  const isPath = typeof source === "string";
  const bufferBody = isPath ? undefined : (source as Buffer);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let stream: fs.ReadStream | undefined;
    const body = isPath
      ? (() => {
          stream = fs.createReadStream(source as string);
          return stream;
        })()
      : bufferBody;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: metadata,
    });
    try {
      console.log(`[ZIP] upload attempt ${attempt}/${maxAttempts} for key=${key}`);
      await client.send(command, { abortSignal: signal });
      console.log(`[ZIP] upload attempt ${attempt} succeeded for key=${key}`);
      const url = getPublicUrl(key);
      return { key, url };
    } catch (error: any) {
      if (stream) {
        stream.destroy();
      }
      const code = typeof error?.code === "string" ? error.code : "";
      const responseBody = await readResponseBody(error?.$response?.body);
      const shouldRetry =
        attempt < maxAttempts &&
        (error?.name === "AbortError" ||
          /(ERR_SSL|ECONNRESET|ETIMEDOUT)/.test(code));
      console.error(`[ZIP] upload attempt ${attempt} failed`, {
        key,
        contentType,
        attempt,
        errorMessage: error?.message,
        errorCode: code,
      });
      if (responseBody) {
        console.error(`[ZIP] R2 response body: ${responseBody}`);
      }
      if (!shouldRetry) {
        throw error;
      }
      const delay = backoffs[attempt - 1] ?? 3500;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("uploadToR2: max upload attempts reached");
}

/**
 * Obtiene una URL firmada temporal para un archivo privado
 */
export async function getSignedUrlForFile(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getS3Client();
  const bucketName = getBucketName();

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return await getSignedUrl(client, command, { expiresIn });
}

/**
 * Obtiene una URL firmada para subir (PUT) a R2.
 */
export async function getSignedPutUrl(
  key: string,
  contentType: string,
  expiresIn: number = 900
): Promise<string> {
  const client = getS3Client();
  const bucketName = getBucketName();

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  });

  return await getSignedUrl(client, command, { expiresIn });
}

/**
 * Lee un archivo desde R2 y devuelve su contenido como Buffer
 */
export async function readFromR2(key: string): Promise<Buffer> {
  const client = getS3Client();
  const bucketName = getBucketName();

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  const response = await client.send(command);
  
  if (!response.Body) {
    throw new Error(`Archivo vacío o no encontrado: ${key}`);
  }

  // Convertir el stream a Buffer
  const chunks: Uint8Array[] = [];
  const stream = response.Body as any;
  
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  
  return Buffer.concat(chunks);
}

/**
 * Verifica si un archivo existe en R2
 */
export async function fileExistsInR2(key: string): Promise<boolean> {
  const client = getS3Client();
  const bucketName = getBucketName();

  try {
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    
    await client.send(command);
    return true;
  } catch (error: any) {
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Obtiene metadata básica de un objeto en R2.
 */
export async function getR2ObjectMetadata(
  key: string
): Promise<{ size: number; contentType?: string | null }> {
  const client = getS3Client();
  const bucketName = getBucketName();

  const command = new HeadObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  const response = await client.send(command);
  return {
    size: Number(response.ContentLength ?? 0),
    contentType: response.ContentType ?? null,
  };
}

/**
 * Elimina un archivo de R2
 */
export async function deleteFromR2(key: string): Promise<void> {
  const client = getS3Client();
  const bucketName = getBucketName();

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  await client.send(command);
}

/**
 * Lista objetos en R2 bajo un prefijo, con Key y LastModified.
 * Pagina hasta maxObjects o maxMs.
 */
export async function listObjectsByPrefix(
  prefix: string,
  opts?: { maxObjects?: number; maxMs?: number }
): Promise<Array<{ Key: string; LastModified?: Date }>> {
  const maxObjects = opts?.maxObjects ?? 10_000;
  const maxMs = opts?.maxMs ?? 30_000;
  const start = Date.now();
  const results: Array<{ Key: string; LastModified?: Date }> = [];
  let continuationToken: string | undefined;

  const client = getS3Client();
  const bucketName = getBucketName();

  do {
    if (Date.now() - start > maxMs) break;

    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
      MaxKeys: 1000,
      ContinuationToken: continuationToken,
    });
    const resp = await client.send(command);
    const contents = resp.Contents ?? [];
    for (const obj of contents) {
      if (obj.Key) {
        results.push({ Key: obj.Key, LastModified: obj.LastModified });
      }
      if (results.length >= maxObjects) break;
    }
    continuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
  } while (continuationToken && results.length < maxObjects);

  return results;
}

/** Objeto listado con detalles (Key, Size, LastModified). */
export type R2ListedObject = {
  Key: string;
  Size: number;
  LastModified?: Date;
  isPrefix?: boolean; // true si es "directorio" (delimiter)
};

/**
 * Lista objetos en R2 bajo un prefijo con Size para el panel admin.
 * Usa delimitador "/" para agrupar como carpetas.
 */
export async function listR2ObjectsWithDetails(
  prefix: string,
  opts?: { maxObjects?: number; maxMs?: number; delimiter?: string }
): Promise<{ objects: R2ListedObject[]; prefixes: string[]; isTruncated: boolean }> {
  const maxObjects = opts?.maxObjects ?? 1000;
  const maxMs = opts?.maxMs ?? 15_000;
  const delimiter = opts?.delimiter ?? "/";
  const start = Date.now();
  const objects: R2ListedObject[] = [];
  const allPrefixes = new Set<string>();
  let continuationToken: string | undefined;
  let isTruncated = false;

  const client = getS3Client();
  const bucketName = getBucketName();

  do {
    if (Date.now() - start > maxMs) break;

    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
      Delimiter: delimiter,
      MaxKeys: 1000,
      ContinuationToken: continuationToken,
    });
    const resp = await client.send(command);

    // Subcarpetas (CommonPrefixes)
    const prefixes = resp.CommonPrefixes ?? [];
    for (const p of prefixes) {
      if (p.Prefix) allPrefixes.add(p.Prefix);
    }

    // Objetos en la carpeta actual
    const contents = resp.Contents ?? [];
    for (const obj of contents) {
      if (obj.Key && objects.length < maxObjects) {
        objects.push({
          Key: obj.Key,
          Size: obj.Size ?? 0,
          LastModified: obj.LastModified,
          isPrefix: false,
        });
      }
    }

    isTruncated = resp.IsTruncated ?? false;
    continuationToken = resp.NextContinuationToken;
  } while (isTruncated && continuationToken && objects.length < maxObjects);

  return {
    objects,
    prefixes: Array.from(allPrefixes).sort(),
    isTruncated,
  };
}

/**
 * Obtiene estadísticas aproximadas del bucket R2 (objetos y tamaño).
 * Pagina hasta maxObjects o 30 segundos para evitar timeouts.
 */
export async function getR2BucketStats(opts?: { maxObjects?: number; maxMs?: number }): Promise<{
  objectCount: number;
  totalBytes: number;
  isTruncated: boolean;
  error?: string;
}> {
  const maxObjects = opts?.maxObjects ?? 50_000;
  const maxMs = opts?.maxMs ?? 25_000;
  const start = Date.now();
  let objectCount = 0;
  let totalBytes = 0;
  let continuationToken: string | undefined;
  let isTruncated = false;

  try {
    const client = getS3Client();
    const bucketName = getBucketName();

    do {
      if (Date.now() - start > maxMs) break;

      const command = new ListObjectsV2Command({
        Bucket: bucketName,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      });
      const resp = await client.send(command);
      const contents = resp.Contents ?? [];
      for (const obj of contents) {
        objectCount += 1;
        totalBytes += obj.Size ?? 0;
      }
      isTruncated = resp.IsTruncated ?? false;
      continuationToken = resp.NextContinuationToken;

      if (objectCount >= maxObjects) break;
    } while (isTruncated && continuationToken);

    return { objectCount, totalBytes, isTruncated };
  } catch (err: unknown) {
    return {
      objectCount,
      totalBytes,
      isTruncated,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Elimina múltiples archivos de R2
 */
export async function deleteMultipleFromR2(keys: string[]): Promise<void> {
  const client = getS3Client();
  const bucketName = getBucketName();

  // R2/S3 no tiene delete múltiple nativo, así que hacemos llamadas paralelas
  await Promise.all(
    keys.map((key) =>
      deleteFromR2(key).catch((err) => {
        console.error(`Error eliminando ${key} de R2:`, err);
        // Continuar aunque falle alguno
      })
    )
  );
}

/**
 * Convierte una URL pública o ruta local a una key de R2
 * Útil para migración: si tenemos "/uploads/archivo.jpg", devuelve "uploads/archivo.jpg"
 * Si ya es una URL completa, intenta extraer la key
 */
export function urlToR2Key(urlOrPath: string): string {
  // Si es una URL completa, extraer la key
  if (urlOrPath.startsWith("http")) {
    try {
      const url = new URL(urlOrPath);
      // Remover el primer "/" si existe
      let pathname = url.pathname.replace(/^\//, "");
      // Si la URL incluye el bucket en el path, removerlo
      const bucketName = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET;
      if (bucketName && (pathname === bucketName || pathname.startsWith(`${bucketName}/`))) {
        pathname = pathname.replace(new RegExp(`^${bucketName}/?`), "");
      }
      return pathname;
    } catch {
      // Si falla el parsing, tratar como path
    }
  }
  
  // Si es una ruta local como "/uploads/archivo.jpg", remover el primer "/"
  return urlOrPath.replace(/^\//, "");
}
