import "server-only";
import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";
import {
  buildSponsorLogoKey,
  extensionForSponsorLogo,
  validateSponsorLogo,
} from "./logo-rules";

/**
 * Sube el logo de un sponsor al bucket de Clickatón (`clickaton-media`).
 *
 * ── Por qué ese bucket y no el de FOTOFFICE ──
 *
 * La ficha del sponsor es una sola para toda la suite: el logo que carga SFPR es el que ve
 * Clickatón en su panel y en sus placas. El panel de Clickatón sólo sabe servir logos de su
 * bucket (`/api/media/<clave>`), así que se guarda ahí, con la misma forma de clave que usa
 * él (`apps/clickaton/lib/admin/partners/partner-logo-storage.ts`).
 *
 * ── Credenciales ──
 *
 * `CLICKATON_MEDIA_R2_*` si están; si no, las de R2 de FOTOFFICE apuntadas a
 * `clickaton-media`. Las dos cuentas de R2 son la misma: si el token de FOTOFFICE tiene
 * permiso sobre ese bucket, no hace falta configurar nada más. Si no lo tiene, R2 contesta
 * "Access Denied" y el panel lo explica.
 */

type R2Config = { bucket: string; endpoint: string; accessKeyId: string; secretAccessKey: string };

function leerConfig(env: Record<string, string | undefined> = process.env): R2Config | null {
  const endpoint = env.CLICKATON_MEDIA_R2_ENDPOINT || env.R2_ENDPOINT;
  const accessKeyId = env.CLICKATON_MEDIA_R2_ACCESS_KEY_ID || env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.CLICKATON_MEDIA_R2_SECRET_ACCESS_KEY || env.R2_SECRET_ACCESS_KEY;
  const bucket = env.CLICKATON_MEDIA_R2_BUCKET || "clickaton-media";
  if (!endpoint || !accessKeyId || !secretAccessKey) return null;
  return { bucket, endpoint, accessKeyId, secretAccessKey };
}

let cliente: { config: R2Config; s3: S3Client } | null = null;

function s3(): { config: R2Config; s3: S3Client } {
  if (cliente) return cliente;
  const config = leerConfig();
  if (!config) throw new Error("SPONSOR_LOGO_STORAGE_NOT_CONFIGURED");
  cliente = {
    config,
    s3: new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    }),
  };
  return cliente;
}

export type UploadedSponsorLogo = {
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  filename: string;
  width: number | null;
  height: number | null;
};

/** Valida, mide y sube. Lanza con un mensaje para mostrar si algo no está bien. */
export async function uploadSponsorLogo(file: File): Promise<UploadedSponsorLogo> {
  const validacion = validateSponsorLogo({ type: file.type, size: file.size });
  if (!validacion.ok) throw new Error(validacion.error);

  const mimeType = file.type.toLowerCase();
  const body = Buffer.from(await file.arrayBuffer());
  let width: number | null = null;
  let height: number | null = null;
  try {
    const meta = await sharp(body).metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;
  } catch {
    throw new Error("El archivo no es una imagen que se pueda leer.");
  }

  const { config, s3: client } = s3();
  const storageKey = buildSponsorLogoKey(extensionForSponsorLogo(mimeType), new Date(), randomUUID());
  try {
    await client.send(
      new PutObjectCommand({ Bucket: config.bucket, Key: storageKey, Body: body, ContentType: mimeType }),
    );
  } catch (error) {
    console.error("[fotoffice][sponsors] no se pudo subir el logo", {
      detalle: error instanceof Error ? error.message : String(error),
    });
    throw new Error(
      "No se pudo guardar el logo en el almacenamiento de DNX Partners. Falta configurar el acceso de FOTOFFICE a ese almacenamiento.",
    );
  }

  return {
    storageKey,
    mimeType,
    sizeBytes: body.length,
    filename: (file.name?.trim() || `logo.${extensionForSponsorLogo(mimeType)}`).slice(0, 255),
    width,
    height,
  };
}

/** Borra un logo recién subido que no se pudo registrar. Nunca lanza. */
export async function discardSponsorLogo(storageKey: string): Promise<void> {
  try {
    const { config, s3: client } = s3();
    await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: storageKey }));
  } catch {
    // Un archivo huérfano en el bucket no rompe nada; no vale la pena frenar por esto.
  }
}
