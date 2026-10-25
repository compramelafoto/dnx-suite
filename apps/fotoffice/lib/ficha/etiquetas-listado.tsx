import "server-only";
import { prisma } from "@repo/db";
import type { ContextoListado, Opcion, ResultadoLote } from "@/lib/listado/tipos";
import { buscarEtiquetas, ponerEtiqueta, quitarEtiqueta, type CtxEtiquetas } from "./etiquetas";
import type { PersonaRef } from "./persona";
import { claseDeColorEtiqueta } from "./formato";

/** Lo que los dos listados comparten para filtrar, mostrar y aplicar etiquetas en lote. */
const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

/** Para el `select` de cada fila: las asignaciones con su etiqueta, en el orden en que se pusieron. */
export const SELECT_ETIQUETAS = {
  orderBy: { createdAt: "asc" },
  take: 20,
  select: { tag: { select: { id: true, name: true, color: true } } },
} as const;

export type EtiquetaChip = { id: string; name: string; color: string };
type Asignacion = { tag: EtiquetaChip };

/** Junta las etiquetas de varias listas sin repetir (socio con cliente vinculado). */
export function unirEtiquetasDeFila(...listas: (Asignacion[] | null | undefined)[]): EtiquetaChip[] {
  const vistas = new Map<string, EtiquetaChip>();
  for (const l of listas) for (const a of l ?? []) if (!vistas.has(a.tag.id)) vistas.set(a.tag.id, a.tag);
  return [...vistas.values()];
}

export function ChipsEtiquetas({ etiquetas }: { etiquetas: EtiquetaChip[] }) {
  if (etiquetas.length === 0) return <span className="text-[var(--fo-muted)]">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {etiquetas.map((t) => (
        <span key={t.id} className={`rounded-full px-2 py-0.5 text-xs ${claseDeColorEtiqueta(t.color)}`}>
          {t.name}
        </span>
      ))}
    </span>
  );
}

export async function validarEtiquetaDelFiltro(ctx: ContextoListado, id: string): Promise<string | null> {
  if (!ID_VALIDO.test(id)) return null;
  const t = await prisma.fotofficeTag.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { name: true } });
  return t?.name ?? null;
}

export async function buscarEtiquetasDelFiltro(ctx: ContextoListado, texto: string): Promise<Opcion[]> {
  const tags = await buscarEtiquetas(ctx.workspaceId, texto, 20);
  return tags.map((t) => ({ valor: t.id, etiqueta: t.name }));
}

/** "Agregar X" / "Quitar X" por cada etiqueta del workspace. */
export async function opcionesDeEtiquetaEnLote(ctx: ContextoListado): Promise<Opcion[]> {
  const tags = await prisma.fotofficeTag.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { nameKey: "asc" },
    take: 500,
    select: { id: true, name: true },
  });
  return tags.flatMap((t) => [
    { valor: `+${t.id}`, etiqueta: `Agregar ${t.name}` },
    { valor: `-${t.id}`, etiqueta: `Quitar ${t.name}` },
  ]);
}

/** El motor ya validó la opción; se revalida acá porque esto escribe. */
async function leerParametro(ctx: ContextoListado, parametro: string | null): Promise<{ agregar: boolean; tagId: string } | null> {
  if (!parametro || (parametro[0] !== "+" && parametro[0] !== "-")) return null;
  const tagId = parametro.slice(1);
  if (!ID_VALIDO.test(tagId)) return null;
  const tag = await prisma.fotofficeTag.findFirst({ where: { id: tagId, workspaceId: ctx.workspaceId }, select: { id: true } });
  return tag ? { agregar: parametro[0] === "+", tagId: tag.id } : null;
}

export type PersonaDeFila = { id: string; persona: PersonaRef };

/**
 * Aplica la etiqueta fila por fila. `cargar` devuelve la persona (con su dueño ya resuelto) de cada id
 * del workspace; los que no aparecen cuentan como no encontrados. Un error en una fila no corta el lote.
 */
export async function aplicarEtiquetaEnLote(
  ctx: ContextoListado,
  ids: string[],
  parametro: string | null,
  cargar: (ids: string[]) => Promise<PersonaDeFila[]>,
): Promise<ResultadoLote> {
  const p = await leerParametro(ctx, parametro);
  if (!p) return { aplicados: 0, fallidos: ids.map((id) => ({ id, error: "etiqueta no válida" })), detalle: [] };
  const personas = new Map((await cargar(ids)).map((f) => [f.id, f.persona]));
  const cx: CtxEtiquetas = { workspaceId: ctx.workspaceId, userId: ctx.userId, userLabel: ctx.userLabel.trim() || `Usuario ${ctx.userId}`, role: ctx.role };
  const r: ResultadoLote = { aplicados: 0, fallidos: [], detalle: [] };
  for (const id of ids) {
    const persona = personas.get(id);
    if (!persona) {
      r.fallidos.push({ id, error: "no encontrado" });
      continue;
    }
    try {
      const res = p.agregar ? await ponerEtiqueta(cx, persona, { tagId: p.tagId }) : await quitarEtiqueta(cx, persona, p.tagId);
      if (!res.ok) {
        r.fallidos.push({ id, error: res.error });
        continue;
      }
      r.aplicados += 1;
      r.detalle.push({ id, etiqueta: p.tagId, operacion: p.agregar ? "agregar" : "quitar" });
    } catch (e) {
      console.error("[listado] etiqueta en lote falló", { id, error: e instanceof Error ? e.name : "desconocido" });
      r.fallidos.push({ id, error: "error inesperado" });
    }
  }
  return r;
}

/** Separa lo que no existe en el workspace. */
export function elegiblesPorExistencia(ids: string[], existentes: string[]) {
  const hay = new Set(existentes);
  return {
    elegibles: ids.filter((id) => hay.has(id)),
    excluidos: ids.filter((id) => !hay.has(id)).map((id) => ({ id, motivo: "no encontrado" })),
  };
}
