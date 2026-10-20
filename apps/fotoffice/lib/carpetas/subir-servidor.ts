import "server-only";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  PutObjectCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { bucketR2Privado, clienteR2Privado } from "@/lib/ficha/adjuntos-r2";
import { enBloques } from "@/lib/galerias/zip";

const PERMITIDAS = ["trabajos/", "impresiones-mini/"];
function exigirClave(clave: string) {
  if (!PERMITIDAS.some((p) => clave.startsWith(p)) || clave.includes("..")) throw new Error(`Clave no permitida: ${clave}`);
}

/** Sube un objeto chico desde el servidor (miniaturas, archivos armados acá). */
export async function subirBuffer(clave: string, cuerpo: Buffer, tipo: string): Promise<void> {
  exigirClave(clave);
  await clienteR2Privado().send(new PutObjectCommand({ Bucket: bucketR2Privado(), Key: clave, Body: cuerpo, ContentType: tipo }));
}

/** Sube un flujo en partes de 8 MB (mínimo de S3/R2: 5 MB salvo la última). Devuelve los bytes subidos. */
export async function subirFlujo(clave: string, flujo: AsyncIterable<Buffer>, tipo: string): Promise<number> {
  exigirClave(clave);
  const s3 = clienteR2Privado();
  const Bucket = bucketR2Privado();
  const { UploadId } = await s3.send(new CreateMultipartUploadCommand({ Bucket, Key: clave, ContentType: tipo }));
  const partes: { ETag: string; PartNumber: number }[] = [];
  let bytes = 0;
  try {
    let n = 1;
    for await (const bloque of enBloques(flujo, 8 * 1024 * 1024)) {
      const r = await s3.send(new UploadPartCommand({ Bucket, Key: clave, UploadId, PartNumber: n, Body: bloque }));
      partes.push({ ETag: r.ETag!, PartNumber: n });
      bytes += bloque.length;
      n++;
    }
    await s3.send(new CompleteMultipartUploadCommand({ Bucket, Key: clave, UploadId, MultipartUpload: { Parts: partes } }));
    return bytes;
  } catch (e) {
    await s3.send(new AbortMultipartUploadCommand({ Bucket, Key: clave, UploadId })).catch(() => {});
    throw e;
  }
}
