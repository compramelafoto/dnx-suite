import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { aplicarVocabulario } from "@/lib/vocabulario/plantilla";
import { whereCorte, type Proveedor, type TipoEvento } from "../linea-de-tiempo";
import { wherePersona } from "../persona";
import { filas, texto } from "./comun";

const PREFIJO = "eventos-persona:";

/**
 * Qué hechos de `FotofficePersonEvent` entran y como qué tipo. `ADJUNTO_SUBIDO` no: la
 * subida ya la muestra el proveedor de adjuntos con el nombre y el tamaño vigentes, y
 * mostrarla dos veces confunde.
 */
const TIPO_POR_KIND: Record<string, TipoEvento> = {
  ETIQUETA_PUESTA: "cambios",
  ETIQUETA_QUITADA: "cambios",
  RELACION_CREADA: "cambios",
  RELACION_BORRADA: "cambios",
  SOCIO_VINCULADO: "cambios",
  SOCIO_DESVINCULADO: "cambios",
  NOTA_BORRADA: "notas",
  ADJUNTO_BORRADO: "adjuntos",
  ADJUNTO_RESTAURADO: "adjuntos",
};

function kindsDe(tipo: TipoEvento | null | undefined): string[] {
  return Object.keys(TIPO_POR_KIND).filter((k) => !tipo || TIPO_POR_KIND[k] === tipo);
}

function titulo(kind: string, detalle: unknown, persona: string): string {
  const nombre = texto(detalle, "nombre");
  const etiqueta = texto(detalle, "etiqueta");
  const otra = texto(detalle, "otra");
  switch (kind) {
    case "ETIQUETA_PUESTA":
      return nombre ? `Etiqueta puesta: ${nombre}` : "Etiqueta puesta";
    case "ETIQUETA_QUITADA":
      return nombre ? `Etiqueta quitada: ${nombre}` : "Etiqueta quitada";
    case "RELACION_CREADA":
      return `Persona relacionada${etiqueta ? ` (${etiqueta})` : ""}${otra ? `: ${otra}` : ""}`;
    case "RELACION_BORRADA":
      return `Relación quitada${etiqueta ? `: ${etiqueta}` : ""}`;
    case "SOCIO_VINCULADO":
      return `Vinculado con su ficha de ${persona}`;
    case "SOCIO_DESVINCULADO":
      return `Desvinculado de su ficha de ${persona}`;
    case "NOTA_BORRADA":
      return "Nota borrada";
    case "ADJUNTO_BORRADO":
      return nombre ? `Adjunto borrado: ${nombre}` : "Adjunto borrado";
    case "ADJUNTO_RESTAURADO":
      return nombre ? `Adjunto restaurado: ${nombre}` : "Adjunto restaurado";
    default:
      return kind;
  }
}

export const proveedorEventosPersona: Proveedor = {
  clave: "eventos-persona",
  tipo: ["cambios", "notas", "adjuntos"],
  async traer(ctx, persona, antesDe, take, opciones) {
    const kinds = kindsDe(opciones?.tipo);
    if (kinds.length === 0) return [];
    const eventos = await prisma.fotofficePersonEvent.findMany({
      where: {
        ...wherePersona(ctx.workspaceId, persona),
        kind: { in: kinds },
        AND: [whereCorte("createdAt", PREFIJO, antesDe, opciones?.idTope) as Prisma.FotofficePersonEventWhereInput],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: filas(take),
      select: { id: true, kind: true, detail: true, actorLabel: true, createdAt: true },
    });
    const necesitaVocabulario = eventos.some((e) => e.kind.startsWith("SOCIO_"));
    const personaTexto = necesitaVocabulario
      ? aplicarVocabulario("{persona}", await loadPersonVocabulary(ctx.workspaceId))
      : "socio";
    return eventos.map((e) => ({
      id: `${PREFIJO}${e.id}`,
      tipo: TIPO_POR_KIND[e.kind] ?? "cambios",
      fecha: e.createdAt,
      actor: e.actorLabel || null,
      titulo: titulo(e.kind, e.detail, personaTexto),
    }));
  },
};
