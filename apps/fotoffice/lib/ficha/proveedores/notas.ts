import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { whereCorte, type Proveedor } from "../linea-de-tiempo";
import { wherePersona } from "../persona";
import { filas } from "./comun";

const PREFIJO = "notas:";

/**
 * Notas de la persona (de los dos lados si es cliente y socio). Las fijadas NO van: la
 * pantalla las muestra aparte, arriba, con `listarNotas`.
 */
export const proveedorNotas: Proveedor = {
  clave: "notas",
  tipo: "notas",
  async traer(ctx, persona, antesDe, take, opciones) {
    const filasNotas = await prisma.fotofficeNote.findMany({
      where: {
        ...wherePersona(ctx.workspaceId, persona),
        deletedAt: null,
        pinned: false,
        AND: [whereCorte("createdAt", PREFIJO, antesDe, opciones?.idTope) as Prisma.FotofficeNoteWhereInput],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: filas(take),
      select: { id: true, body: true, createdAt: true, editedAt: true, authorLabel: true, category: { select: { name: true } } },
    });
    return filasNotas.map((n) => ({
      id: `${PREFIJO}${n.id}`,
      tipo: "notas" as const,
      fecha: n.createdAt,
      actor: n.authorLabel || null,
      titulo: `Nota · ${n.category?.name ?? "Observaciones"}${n.editedAt ? " (editada)" : ""}`,
      detalle: n.body,
    }));
  },
};
