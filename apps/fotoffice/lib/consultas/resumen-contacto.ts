import "server-only";
import { listarAdjuntos } from "@/lib/ficha/adjuntos";
import { etiquetasDePersona } from "@/lib/ficha/etiquetas";
import { listarNotas } from "@/lib/ficha/notas";
import { resolverPersonaPorCliente } from "@/lib/ficha/persona";

/** Notas que se muestran en la ficha de la consulta: las fijadas y las más recientes. */
const NOTAS_EN_CONSULTA = 5;

export type ResumenContacto = {
  notas: { id: string; texto: string; categoria: string | null; fijada: boolean; autor: string; fecha: string }[];
  etiquetas: { id: string; nombre: string; color: string }[];
  adjuntos: { id: string; nombre: string; fecha: string }[];
  /** Hay más notas que las que se muestran. */
  masNotas: boolean;
};

/**
 * Notas, etiquetas y adjuntos del contacto de una consulta, SÓLO PARA LEER (spec §3.2,
 * decisión): se editan en la ficha del contacto. Quien llama ya verificó "Ver" en Clientes (los
 * datos del contacto son de ese módulo) y que el contacto es del workspace de la sesión; acá se
 * vuelve a resolver la persona dentro del workspace. Los adjuntos van sin clave ni enlace: se
 * descargan desde la ficha del contacto, con sus permisos.
 */
export async function resumenDelContacto(
  ctx: { workspaceId: string; userId: number; userLabel: string; role: string | null },
  clientId: string,
): Promise<ResumenContacto | null> {
  const persona = await resolverPersonaPorCliente(ctx.workspaceId, clientId);
  if (!persona) return null;
  const [notas, etiquetas, adjuntos] = await Promise.all([
    listarNotas(ctx.workspaceId, persona, { take: NOTAS_EN_CONSULTA + 1 }),
    etiquetasDePersona(ctx.workspaceId, persona),
    listarAdjuntos({ ...ctx, persona }),
  ]);
  return {
    notas: notas.slice(0, NOTAS_EN_CONSULTA).map((n) => ({
      id: n.id,
      texto: n.body,
      categoria: n.category?.name ?? null,
      fijada: n.pinned,
      autor: n.authorLabel ?? "",
      fecha: n.createdAt.toISOString(),
    })),
    masNotas: notas.length > NOTAS_EN_CONSULTA,
    etiquetas: etiquetas.map((e) => ({ id: e.id, nombre: e.name, color: e.color })),
    adjuntos: adjuntos.map((a) => ({ id: a.id, nombre: a.fileName, fecha: a.createdAt.toISOString() })),
  };
}
