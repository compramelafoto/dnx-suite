import "server-only";
import { S3Client } from "@aws-sdk/client-s3";

/**
 * Cliente del bucket de Subí la Foto (Cloudflare R2, hablado por S3).
 *
 * El bucket es propio y tiene borrado automático a los 30 días. No se comparte con
 * CompraMeLaFoto: las políticas de retención son distintas y un borrado masivo apuntando
 * al bucket equivocado no se deshace.
 */

let cliente: S3Client | null = null;

export function bucket(): string {
  const nombre = process.env.R2_BUCKET;
  if (!nombre) throw new Error("Falta R2_BUCKET.");
  return nombre;
}

export function almacenamiento(): S3Client {
  if (cliente) return cliente;

  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("Falta la configuración de R2.");
  }

  cliente = new S3Client({
    region: process.env.R2_REGION || "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  return cliente;
}
