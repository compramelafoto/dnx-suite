import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { whereCorte, type Proveedor } from "../linea-de-tiempo";
import { wherePersona } from "../persona";
import { filas, tamanoLegible } from "./comun";

const PREFIJO = "adjuntos:";

/** Archivos subidos y vigentes. Sin `storageKey` en el select, a propósito (igual que `listarAdjuntos`). */
export const proveedorAdjuntos: Proveedor = {
  clave: "adjuntos",
  tipo: "adjuntos",
  async traer(ctx, persona, antesDe, take, opciones) {
    const filasAdj = await prisma.fotofficeAttachment.findMany({
      where: {
        ...wherePersona(ctx.workspaceId, persona),
        status: "LISTO",
        AND: [whereCorte("createdAt", PREFIJO, antesDe, opciones?.idTope) as Prisma.FotofficeAttachmentWhereInput],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: filas(take),
      select: { id: true, fileName: true, sizeBytes: true, uploadedByLabel: true, createdAt: true },
    });
    return filasAdj.map((a) => ({
      id: `${PREFIJO}${a.id}`,
      tipo: "adjuntos" as const,
      fecha: a.createdAt,
      actor: a.uploadedByLabel || null,
      titulo: `Adjunto: ${a.fileName}`,
      detalle: tamanoLegible(a.sizeBytes),
    }));
  },
};
