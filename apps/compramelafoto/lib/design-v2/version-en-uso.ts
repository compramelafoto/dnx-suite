import "server-only";
import type { Prisma } from "@prisma/client";
import { readPrivateCopy } from "@repo/template-editor-core";
import type {
  TemplateV2VersionSaveDecision,
  TemplateV2VersionSaveInput,
  TemplateV2VersionSavedEvent,
} from "@repo/template-editor-core/services";
import { prisma } from "@/lib/prisma";
import { invalidarAutorizacionDeLaFamilia } from "./autorizacion-familia";

/**
 * Qué hace el editor al guardar una versión de plantilla en ComprameLaFoto.
 *
 * - Si algún diseño armado usa esa versión, no se pisa: se congela y los cambios van a una
 *   versión nueva. Los diseños siguen igual hasta que el fotógrafo elige pasarlos (ver
 *   `versiones-de-plantilla.ts`).
 * - Si es la copia propia de un diseño (se retoca el armado de un solo librito), se guarda encima,
 *   salvo que el librito ya se haya mandado a imprimir.
 *
 * Sin dependencias de `@/lib/template-v2/server`: lo registra ese mismo archivo.
 */

const COPIA_DE_DISENO = "design-project";

function enProduccion(d: { sentToPrintAt: Date | null; printedAt: Date | null; deliveredAt: Date | null }): boolean {
  return d.sentToPrintAt != null || d.printedAt != null || d.deliveredAt != null;
}

function idDeLaCopia(meta: unknown): number | null {
  const copia = readPrivateCopy(meta);
  if (!copia || copia.kind !== COPIA_DE_DISENO) return null;
  const id = Number(copia.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function decidirGuardadoDeVersion(input: TemplateV2VersionSaveInput): Promise<TemplateV2VersionSaveDecision> {
  const designId = idDeLaCopia(input.metaJson);
  if (designId != null) {
    const d = await prisma.designProject.findUnique({
      where: { id: designId },
      select: { templateV2VersionId: true, sentToPrintAt: true, printedAt: true, deliveredAt: true },
    });
    if (!d || d.templateV2VersionId !== input.versionId) {
      return { mode: "read-only", message: "Esta copia ya no es la del diseño. Volvé a abrirlo desde la revisión." };
    }
    if (enProduccion(d)) {
      return { mode: "read-only", message: "Este librito ya se mandó a imprimir: su diseño ya no se puede cambiar." };
    }
    return { mode: "in-place" };
  }

  const enUso = await prisma.designProject.findFirst({
    where: { templateV2VersionId: input.versionId },
    select: { id: true },
  });
  return enUso ? { mode: "fork" } : { mode: "in-place" };
}

/**
 * Tras retocar a mano el armado de un diseño: si estaba aprobado, vuelve a revisión (el archivo
 * entregado ya no coincide), y la autorización de la familia, si la había, deja de valer.
 */
export async function alGuardarVersion(event: TemplateV2VersionSavedEvent): Promise<void> {
  const designId = idDeLaCopia(event.metaJson);
  if (designId == null) return;
  await prisma.$transaction(async (tx) => {
    const d = await tx.designProject.findUnique({
      where: { id: designId },
      select: {
        status: true,
        orderItemId: true,
        templateV2VersionId: true,
        currentRevision: { select: { id: true, dataJson: true } },
      },
    });
    if (!d || d.templateV2VersionId !== event.versionId) return;
    const aprobado = d.status === "EXPORTED" || d.status === "APPROVED_FOR_EXPORT" || d.status === "APPROVED";
    const nota = "Se retocó a mano el armado de este diseño.";
    if (d.currentRevision) {
      const data = d.currentRevision.dataJson as Record<string, unknown> | null;
      if (data && typeof data === "object" && (data.export != null || data.exportError != null)) {
        await tx.designRevision.update({
          where: { id: d.currentRevision.id },
          data: { dataJson: { ...data, export: null, exportError: null } as Prisma.InputJsonValue },
        });
      }
    }
    await tx.designProject.update({
      where: { id: designId },
      data: aprobado
        ? {
            status: "PENDING_PHOTOGRAPHER_APPROVAL",
            approvedAt: null,
            approvedByUserId: null,
            reviewReason: "EDITADO_A_MANO",
            reviewNote: `${nota} Estaba aprobado: volvé a revisarlo.`,
          }
        : { updatedAt: new Date() },
    });
    if (aprobado && d.orderItemId) {
      await tx.preCompraOrderItem.updateMany({
        where: { id: d.orderItemId, status: { in: ["EXPORTED", "APPROVED"] } },
        data: { status: "DESIGN_SUBMITTED" },
      });
    }
    await invalidarAutorizacionDeLaFamilia(tx, designId, nota);
  });
}
