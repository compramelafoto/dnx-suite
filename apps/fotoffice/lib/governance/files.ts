import "server-only";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  deleteFotofficeR2Object,
  generateFotofficeR2Key,
  getFotofficeR2Bucket,
  getFotofficeR2Client,
} from "@/lib/images/r2-client";
import { assertFotofficeDeletableR2Key, FOTOFFICE_R2_PREFIXES } from "@/lib/images/r2-key-policy";
import { GOVERNANCE_DOWNLOAD_SECONDS, GOVERNANCE_MAX_FILE_BYTES } from "./constants";
import { safeContentType, safeFilename } from "./file-names";

/**
 * Archivos de los proyectos: presupuestos, fotos, planillas, PDF, lo que haga falta (diseño §6).
 *
 * Mismo camino que el portfolio: el servidor firma un permiso de escritura de un minuto, el
 * navegador sube directo al bucket (las funciones de Vercel no aceptan más de 4,5 MB) y después el
 * servidor mira el objeto ya escrito antes de registrarlo. A diferencia de las fotos, acá se acepta
 * cualquier tipo: lo que se controla es el tamaño, el lugar y quién lo descarga.
 *
 * Los archivos son privados. La dirección pública del bucket no se guarda ni se muestra nunca:
 * cada descarga pasa por `/api/gobierno/archivos/<id>`, que verifica permiso y firma por minutos.
 */

/** Todo archivo de un proyecto vive bajo su institución y su proyecto. */
export function projectFilesPrefix(workspaceId: string, projectId: string): string {
  return `${FOTOFFICE_R2_PREFIXES.governanceFile}/${workspaceId}/${projectId}/`;
}

export async function createGovernanceUploadUrl(params: {
  workspaceId: string;
  projectId: string;
  filename: string;
  contentType: string;
}): Promise<{ uploadUrl: string; key: string; contentType: string }> {
  const contentType = safeContentType(params.contentType);
  // La key sólo lleva la extensión: el nombre original se guarda en la base, no en el bucket.
  const ext = /\.[a-z0-9]{1,10}$/i.exec(safeFilename(params.filename))?.[0]?.toLowerCase() ?? "";
  const key = generateFotofficeR2Key(`archivo${ext}`, projectFilesPrefix(params.workspaceId, params.projectId));
  assertFotofficeDeletableR2Key(key);
  const uploadUrl = await getSignedUrl(
    getFotofficeR2Client(),
    new PutObjectCommand({ Bucket: getFotofficeR2Bucket(), Key: key, ContentType: contentType }),
    { expiresIn: 60 },
  );
  return { uploadUrl, key, contentType };
}

export type VerifiedUpload = { ok: true; sizeBytes: number; contentType: string } | { ok: false; error: string };

/**
 * Qué se subió de verdad. El tamaño que declara el navegador no vale: se lee el objeto.
 * Un archivo de más de 25 MB se borra en el acto, para que no quede ocupando lugar sin registro.
 */
export async function verifyGovernanceUpload(key: string, workspaceId: string, projectId: string): Promise<VerifiedUpload> {
  if (!key.startsWith(projectFilesPrefix(workspaceId, projectId))) {
    return { ok: false, error: "Ese archivo no es de este proyecto." };
  }
  let safeKey: string;
  try {
    safeKey = assertFotofficeDeletableR2Key(key);
  } catch {
    return { ok: false, error: "No pudimos verificar el archivo subido." };
  }
  try {
    const head = await getFotofficeR2Client().send(
      new HeadObjectCommand({ Bucket: getFotofficeR2Bucket(), Key: safeKey }),
    );
    const sizeBytes = head.ContentLength ?? 0;
    if (sizeBytes <= 0) return { ok: false, error: "El archivo llegó vacío. Probá de nuevo." };
    if (sizeBytes > GOVERNANCE_MAX_FILE_BYTES) {
      await deleteFotofficeR2Object(safeKey).catch(() => null);
      return { ok: false, error: "El archivo supera el máximo de 25 MB." };
    }
    return { ok: true, sizeBytes, contentType: head.ContentType || "application/octet-stream" };
  } catch {
    return { ok: false, error: "No encontramos el archivo subido. Probá de nuevo." };
  }
}

/** Enlace de descarga de pocos minutos, con el nombre original del archivo. */
export async function signedDownloadUrl(key: string, filename: string): Promise<string> {
  const nombre = safeFilename(filename);
  return getSignedUrl(
    getFotofficeR2Client(),
    new GetObjectCommand({
      Bucket: getFotofficeR2Bucket(),
      Key: assertFotofficeDeletableR2Key(key),
      ResponseContentDisposition: `attachment; filename="${nombre.replace(/[^\x20-\x7E]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
    }),
    { expiresIn: GOVERNANCE_DOWNLOAD_SECONDS },
  );
}
