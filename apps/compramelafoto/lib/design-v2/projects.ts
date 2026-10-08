import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  generateR2Key,
  getR2PublicUrl,
  normalizePreviewUrl,
  readFromR2,
  uploadToR2,
} from "@/lib/r2-client";
import {
  applyDesignV2Edit,
  buildInitialDesignData,
  parseDesignV2Data,
  type DesignV2Data,
  type DesignV2Edit,
} from "./design-data";
import { renderDesignV2 } from "./render";
import { loadDesignTemplateVersion, type DesignTemplateVersion } from "./template";

/**
 * Diseños armados con el diseñador nuevo: crearlos, corregirlos, aprobarlos y pedir cambios.
 *
 * Un diseño es un `DesignProject` con una sola revisión viva (`currentRevision`) cuyo `dataJson`
 * es un `DesignV2Data`. Los estados son los del modelo:
 *
 * - `PENDING_PHOTOGRAPHER_APPROVAL`: armado, esperando que el fotógrafo lo revise.
 * - `NEEDS_ADJUSTMENT`: el fotógrafo le pidió cambios al cliente; puede seguir corrigiéndolo.
 * - `APPROVED_FOR_EXPORT`: aprobado pero el archivo no se pudo generar (se reintenta).
 * - `EXPORTED`: aprobado y con PDF + JPG listos para el cliente.
 */

type Db = PrismaClient | Prisma.TransactionClient;

export type DesignActor = { id: number; role: string };

export const DESIGN_EDITABLE_STATUSES = ["PENDING_PHOTOGRAPHER_APPROVAL", "NEEDS_ADJUSTMENT", "APPROVED_FOR_EXPORT", "EXPORTED"] as const;

export class DesignProjectError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------------------------------

/** La foto que se ve en pantalla (la vista previa del álbum). */
export function designPhotoDisplayUrl(photo: { previewUrl: string | null; originalKey: string | null }): string | null {
  return normalizePreviewUrl(photo.previewUrl, photo.originalKey);
}

/**
 * Los bytes de una foto para imprimir: el original; si el original ya no está (limpieza de
 * álbumes viejos), la vista previa.
 */
export async function loadDesignPhotoBytes(photoId: number): Promise<Uint8Array | null> {
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    select: { originalKey: true, previewUrl: true, storageDeletedAt: true },
  });
  if (!photo) return null;
  if (photo.originalKey && !photo.storageDeletedAt) {
    try {
      return new Uint8Array(await readFromR2(photo.originalKey));
    } catch {
      // cae a la vista previa
    }
  }
  const url = designPhotoDisplayUrl(photo);
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Crear
// ---------------------------------------------------------------------------------------------

export type CreateDesignInput = {
  template: DesignTemplateVersion;
  photoIds: number[];
  values: Record<string, string>;
  photographerUserId: number;
  albumId: number;
  albumOrderId?: number | null;
  albumPackDraftId?: string | null;
  orderItemId?: number | null;
};

/**
 * Crea el diseño con el armado automático, listo para que el fotógrafo lo revise.
 *
 * Idempotente por pack (`albumPackDraftId`) y por ítem de preventa (`orderItemId`): si el pago
 * se confirma dos veces (webhook + regreso del cliente), el diseño se crea una sola vez.
 */
export async function createDesignV2Project(db: Db, input: CreateDesignInput): Promise<{ id: number; created: boolean }> {
  const existing = input.albumPackDraftId
    ? await db.designProject.findUnique({ where: { albumPackDraftId: input.albumPackDraftId }, select: { id: true } })
    : input.orderItemId
      ? await db.designProject.findUnique({ where: { orderItemId: input.orderItemId }, select: { id: true } })
      : null;
  if (existing) return { id: existing.id, created: false };

  const data = buildInitialDesignData({
    templateV2Id: input.template.templateId,
    templateV2VersionId: input.template.versionId,
    slots: input.template.slots,
    photoIds: input.photoIds,
    values: input.values,
  });

  const project = await db.designProject.create({
    data: {
      status: "PENDING_PHOTOGRAPHER_APPROVAL",
      templateV2Id: input.template.templateId,
      templateV2VersionId: input.template.versionId,
      photographerUserId: input.photographerUserId,
      albumId: input.albumId,
      albumOrderId: input.albumOrderId ?? null,
      albumPackDraftId: input.albumPackDraftId ?? null,
      orderItemId: input.orderItemId ?? null,
    },
    select: { id: true },
  });
  const revision = await db.designRevision.create({
    data: { designProjectId: project.id, createdBy: "CLIENT", dataJson: data as unknown as Prisma.InputJsonValue },
    select: { id: true },
  });
  await db.designProject.update({ where: { id: project.id }, data: { currentRevisionId: revision.id } });
  return { id: project.id, created: true };
}

// ---------------------------------------------------------------------------------------------
// Leer
// ---------------------------------------------------------------------------------------------

const PROJECT_SELECT = {
  id: true,
  status: true,
  templateV2Id: true,
  templateV2VersionId: true,
  photographerUserId: true,
  albumId: true,
  albumOrderId: true,
  orderItemId: true,
  reviewNote: true,
  approvedAt: true,
  createdAt: true,
  updatedAt: true,
  currentRevision: { select: { id: true, dataJson: true } },
} satisfies Prisma.DesignProjectSelect;

export type LoadedDesignProject = {
  project: Prisma.DesignProjectGetPayload<{ select: typeof PROJECT_SELECT }>;
  data: DesignV2Data;
  revisionId: number;
};

function canReview(actor: DesignActor, photographerUserId: number | null): boolean {
  return actor.role === "ADMIN" || (photographerUserId != null && photographerUserId === actor.id);
}

export async function loadDesignProjectForActor(id: number, actor: DesignActor): Promise<LoadedDesignProject> {
  const project = await prisma.designProject.findUnique({ where: { id }, select: PROJECT_SELECT });
  if (!project || !project.templateV2Id) throw new DesignProjectError("No encontramos ese diseño.", 404);
  if (!canReview(actor, project.photographerUserId)) throw new DesignProjectError("No encontramos ese diseño.", 404);
  const data = parseDesignV2Data(project.currentRevision?.dataJson);
  if (!data || !project.currentRevision) throw new DesignProjectError("El diseño está incompleto.", 422);
  return { project, data, revisionId: project.currentRevision.id };
}

export async function loadTemplateForDesign(data: DesignV2Data): Promise<DesignTemplateVersion> {
  const template = await loadDesignTemplateVersion({
    templateId: data.templateV2Id,
    versionId: data.templateV2VersionId,
  });
  if (!template) throw new DesignProjectError("La plantilla de este diseño ya no existe.", 410);
  return template;
}

// ---------------------------------------------------------------------------------------------
// Corregir
// ---------------------------------------------------------------------------------------------

export async function saveDesignEdits(id: number, actor: DesignActor, edits: DesignV2Edit[]): Promise<DesignV2Data> {
  const loaded = await loadDesignProjectForActor(id, actor);
  let data = loaded.data;
  for (const edit of edits) {
    const resolved = edit.kind === "reset" ? { ...edit, slots: (await loadTemplateForDesign(data)).slots } : edit;
    const result = applyDesignV2Edit(data, resolved);
    if (!result.ok) throw new DesignProjectError(result.error, 422);
    data = result.data;
  }
  await prisma.$transaction([
    prisma.designRevision.update({
      where: { id: loaded.revisionId },
      data: { createdBy: "PHOTOGRAPHER", dataJson: data as unknown as Prisma.InputJsonValue },
    }),
    // Un diseño aprobado que se toca vuelve a revisión: el archivo entregado ya no coincide.
    prisma.designProject.update({
      where: { id },
      data:
        loaded.project.status === "EXPORTED" || loaded.project.status === "APPROVED_FOR_EXPORT"
          ? { status: "PENDING_PHOTOGRAPHER_APPROVAL", approvedAt: null, approvedByUserId: null }
          : { updatedAt: new Date() },
    }),
  ]);
  return data;
}

// ---------------------------------------------------------------------------------------------
// Aprobar
// ---------------------------------------------------------------------------------------------

async function uploadExport(projectId: number, bytes: Uint8Array, name: string, contentType: string): Promise<string> {
  const key = generateR2Key(name, `design-exports/${projectId}`);
  await uploadToR2(Buffer.from(bytes), key, contentType, { type: "design_v2_export", designProjectId: String(projectId) });
  return getR2PublicUrl(key);
}

/**
 * Aprueba el diseño y genera los archivos finales (PDF con todas las caras + un JPG por cara).
 *
 * Si la generación falla, el diseño queda aprobado (`APPROVED_FOR_EXPORT`) con el error a la
 * vista, y se puede reintentar sin volver a revisar.
 */
export async function approveDesignProject(
  id: number,
  actor: DesignActor,
  note?: string | null,
): Promise<{ status: "EXPORTED" | "APPROVED_FOR_EXPORT"; data: DesignV2Data; error?: string }> {
  const loaded = await loadDesignProjectForActor(id, actor);
  const template = await loadTemplateForDesign(loaded.data);

  await prisma.designProject.update({
    where: { id },
    data: {
      status: "APPROVED_FOR_EXPORT",
      approvedAt: new Date(),
      approvedByUserId: actor.id,
      reviewNote: note?.trim() ? note.trim().slice(0, 1000) : loaded.project.reviewNote,
    },
  });

  const fail = async (error: string) => {
    const data = { ...loaded.data, exportError: error.slice(0, 1000) };
    await prisma.designRevision.update({
      where: { id: loaded.revisionId },
      data: { dataJson: data as unknown as Prisma.InputJsonValue },
    });
    return { status: "APPROVED_FOR_EXPORT" as const, data, error: data.exportError };
  };

  let pdfUrl: string | null = null;
  const jpgUrls: string[] = [];
  try {
    const rendered = await renderDesignV2({
      template,
      data: loaded.data,
      loadPhoto: loadDesignPhotoBytes,
      formats: { pdf: true, jpg: true },
      fileBaseName: `diseno-${id}`,
    });
    if (!rendered.ok) return await fail(rendered.errors.join(" · "));

    pdfUrl = rendered.pdf ? await uploadExport(id, rendered.pdf, `diseno-${id}.pdf`, "application/pdf") : null;
    for (const [i, jpg] of rendered.jpgs.entries()) {
      jpgUrls.push(await uploadExport(id, jpg, `diseno-${id}-cara-${i + 1}.jpg`, "image/jpeg"));
    }
  } catch (err) {
    // Una caída al dibujar o al subir deja el diseño aprobado y con el error a la vista: el
    // fotógrafo reintenta sin volver a revisar.
    console.error("[design_v2] exportación falló", { designProjectId: id, err });
    return await fail(`No se pudieron guardar los archivos (${err instanceof Error ? err.message.replace(/\.$/, "") : "error"})`);
  }

  const data: DesignV2Data = {
    ...loaded.data,
    export: { pdfUrl, jpgUrls, generatedAt: new Date().toISOString() },
    exportError: null,
  };
  await prisma.$transaction([
    prisma.designRevision.update({
      where: { id: loaded.revisionId },
      data: { dataJson: data as unknown as Prisma.InputJsonValue, exportedJpgUrl: jpgUrls[0] ?? null },
    }),
    prisma.designProject.update({ where: { id }, data: { status: "EXPORTED" } }),
  ]);

  if (loaded.project.orderItemId) {
    await prisma.preCompraOrderItem.updateMany({
      where: { id: loaded.project.orderItemId },
      data: { status: "EXPORTED" },
    });
  }

  return { status: "EXPORTED", data };
}

// ---------------------------------------------------------------------------------------------
// Pedir cambios
// ---------------------------------------------------------------------------------------------

export async function markDesignNeedsChanges(id: number, actor: DesignActor, note: string): Promise<void> {
  const loaded = await loadDesignProjectForActor(id, actor);
  const text = note.trim();
  if (!text) throw new DesignProjectError("Escribí qué necesitás que cambie el cliente.", 422);
  await prisma.designProject.update({
    where: { id: loaded.project.id },
    data: {
      status: "NEEDS_ADJUSTMENT",
      rejectedAt: new Date(),
      rejectedByUserId: actor.id,
      reviewReason: "PEDIDO_AL_CLIENTE",
      reviewNote: text.slice(0, 2000),
    },
  });
}
