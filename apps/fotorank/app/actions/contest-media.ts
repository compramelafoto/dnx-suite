"use server";

/**
 * Acciones del administrador sobre las imágenes de un concurso.
 *
 * Toda acción resuelve el permiso desde el concurso, nunca desde datos que
 * mande el formulario. El id del concurso llega del cliente, sí — pero es lo
 * único, y con él se va a buscar a qué organización pertenece y si quien está
 * operando es miembro con rol suficiente.
 */

import { revalidatePath } from "next/cache";
import { getAuthUser } from "../lib/auth";
import {
  authorizeContestMediaWrite,
  buildPreviewDataUri,
  deleteContestMedia,
  isContestMediaKind,
  readSourceInfo,
  resolveContestMediaAccess,
  saveContestMedia,
  updateContestMediaMeta,
  validateImageDimensions,
  validateUploadBytes,
  aspectRatioWarning,
  type ContestMediaKind,
} from "../lib/fotorank/contest-media";

export type ContestMediaActionResult = {
  ok: boolean;
  message: string;
  /** Aviso que no impide guardar (por ejemplo, proporción distinta de 16:9). */
  warning?: string | null;
};

export type ContestMediaPreviewResult =
  | {
      ok: true;
      dataUri: string;
      width: number;
      height: number;
      sizeBytes: number;
      warning: string | null;
    }
  | { ok: false; message: string };

/**
 * Genera la vista previa antes de guardar.
 *
 * Se procesa en el servidor y no en el navegador a propósito: así lo que se ve
 * es el mismo recorte que va a producir sharp al guardar, no una aproximación
 * hecha con CSS que después no coincide.
 */
export async function previewContestMediaAction(
  formData: FormData,
): Promise<ContestMediaPreviewResult> {
  const contestId = String(formData.get("contestId") ?? "");
  const file = formData.get("file");

  const user = await getAuthUser();
  const access = await resolveContestMediaAccess(user, contestId);
  const denied = authorizeContestMediaWrite(access, user);
  if (denied) return { ok: false, message: denied.message };

  if (!(file instanceof File)) {
    return { ok: false, message: "Elegí un archivo de imagen." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  const sniff = validateUploadBytes({ bytes, declaredMime: file.type });
  if (!sniff.ok) return { ok: false, message: sniff.error.message };

  const info = await readSourceInfo(bytes);
  if (!info) return { ok: false, message: "No se pudo leer la imagen. Puede estar dañada." };

  const dims = validateImageDimensions(info);
  if (!dims.ok) return { ok: false, message: dims.error.message };

  const focalPointX = numberOr(formData.get("focalPointX"), 50);
  const focalPointY = numberOr(formData.get("focalPointY"), 50);

  return {
    ok: true,
    dataUri: await buildPreviewDataUri({ bytes, focalPointX, focalPointY }),
    width: info.width,
    height: info.height,
    sizeBytes: bytes.byteLength,
    warning: aspectRatioWarning(info.width, info.height),
  };
}

/** Sube una imagen nueva o reemplaza la vigente de ese tipo. */
export async function saveContestMediaAction(
  formData: FormData,
): Promise<ContestMediaActionResult> {
  const contestId = String(formData.get("contestId") ?? "");
  const kindRaw = String(formData.get("kind") ?? "");
  const file = formData.get("file");
  const altText = String(formData.get("altText") ?? "");

  const user = await getAuthUser();
  const access = await resolveContestMediaAccess(user, contestId);
  const denied = authorizeContestMediaWrite(access, user);
  if (denied) return { ok: false, message: denied.message };

  if (!isContestMediaKind(kindRaw)) {
    return { ok: false, message: "Tipo de imagen no reconocido." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Elegí un archivo de imagen." };
  }

  const result = await saveContestMedia({
    contestId,
    kind: kindRaw as ContestMediaKind,
    bytes: new Uint8Array(await file.arrayBuffer()),
    declaredMime: file.type,
    originalFileName: file.name,
    altText,
    focalPointX: numberOr(formData.get("focalPointX"), 50),
    focalPointY: numberOr(formData.get("focalPointY"), 50),
    actorUserId: user!.id,
  });

  if (!result.ok) return { ok: false, message: result.error.message };

  revalidateContest(contestId, access!.contestSlug);

  return {
    ok: true,
    message: "Imagen guardada.",
    warning: result.warning,
  };
}

/** Elimina la imagen vigente de un tipo. La confirmación la pide la interfaz. */
export async function deleteContestMediaAction(
  formData: FormData,
): Promise<ContestMediaActionResult> {
  const contestId = String(formData.get("contestId") ?? "");
  const kindRaw = String(formData.get("kind") ?? "");

  const user = await getAuthUser();
  const access = await resolveContestMediaAccess(user, contestId);
  const denied = authorizeContestMediaWrite(access, user);
  if (denied) return { ok: false, message: denied.message };

  if (!isContestMediaKind(kindRaw)) {
    return { ok: false, message: "Tipo de imagen no reconocido." };
  }

  const result = await deleteContestMedia({
    contestId,
    kind: kindRaw as ContestMediaKind,
    actorUserId: user!.id,
  });

  revalidateContest(contestId, access!.contestSlug);

  return {
    ok: true,
    message: result.deleted ? "Imagen eliminada." : "No había ninguna imagen de ese tipo.",
  };
}

/** Corrige el texto alternativo o el encuadre sin volver a subir el archivo. */
export async function updateContestMediaMetaAction(
  formData: FormData,
): Promise<ContestMediaActionResult> {
  const contestId = String(formData.get("contestId") ?? "");
  const assetId = String(formData.get("assetId") ?? "");

  const user = await getAuthUser();
  const access = await resolveContestMediaAccess(user, contestId);
  const denied = authorizeContestMediaWrite(access, user);
  if (denied) return { ok: false, message: denied.message };

  const altRaw = formData.get("altText");
  const result = await updateContestMediaMeta({
    contestId,
    assetId,
    ...(typeof altRaw === "string" ? { altText: altRaw } : {}),
    ...(formData.has("focalPointX")
      ? { focalPointX: numberOr(formData.get("focalPointX"), 50) }
      : {}),
    ...(formData.has("focalPointY")
      ? { focalPointY: numberOr(formData.get("focalPointY"), 50) }
      : {}),
  });

  if (!result.ok) return { ok: false, message: result.error.message };

  revalidateContest(contestId, access!.contestSlug);
  return { ok: true, message: "Cambios guardados." };
}

/**
 * Refresca lo que muestra la imagen: el panel, la página pública del concurso y
 * la home, donde aparece la tarjeta del listado.
 */
function revalidateContest(contestId: string, slug: string) {
  revalidatePath(`/dashboard/concursos/${contestId}/imagenes`);
  revalidatePath(`/concursos/${slug}`);
  revalidatePath("/");
}

function numberOr(value: FormDataEntryValue | null, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
