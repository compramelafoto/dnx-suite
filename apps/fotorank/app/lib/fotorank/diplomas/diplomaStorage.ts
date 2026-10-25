/**
 * Almacenamiento de los PDF/PNG emitidos (sólo servidor).
 *
 * Van al almacenamiento privado de FotoRank (R2 en producción, disco en desarrollo), igual que
 * las obras. Antes se escribían en `public/uploads/diplomas`: en Vercel ese disco es de sólo
 * lectura y la emisión sólo funcionaba corriendo la app en una computadora.
 *
 * La descarga sale siempre por `/api/diplomas/[issuedId]/file`, que controla la organización:
 * `pdfUrl` y `pngUrl` guardan esa dirección, no la del archivo.
 */
import { getPrivateContestStorageProvider, readPrivateObject } from "../storage/provider";

export type DiplomaFileKind = "pdf" | "png";

const CONTENT_TYPE: Record<DiplomaFileKind, string> = {
  pdf: "application/pdf",
  png: "image/png",
};

function seguro(id: string, porDefecto: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || porDefecto;
}

export function diplomaFileKey(contestId: string, issuedId: string, kind: DiplomaFileKind): string {
  return `fotorank/contests/${seguro(contestId, "contest")}/diplomas/${seguro(issuedId, "id")}.${kind}`;
}

export function diplomaDownloadUrl(issuedId: string, kind: DiplomaFileKind): string {
  return `/api/diplomas/${encodeURIComponent(issuedId)}/file?format=${kind}`;
}

export async function saveDiplomaFile(
  contestId: string,
  issuedId: string,
  kind: DiplomaFileKind,
  bytes: Uint8Array,
): Promise<{ publicUrl: string; bytes: number }> {
  await getPrivateContestStorageProvider().putObject(
    diplomaFileKey(contestId, issuedId, kind),
    bytes,
    CONTENT_TYPE[kind],
  );
  return { publicUrl: diplomaDownloadUrl(issuedId, kind), bytes: bytes.byteLength };
}

export async function readDiplomaFile(
  contestId: string,
  issuedId: string,
  kind: DiplomaFileKind,
): Promise<Uint8Array | null> {
  try {
    return await readPrivateObject(diplomaFileKey(contestId, issuedId, kind));
  } catch {
    return null;
  }
}
