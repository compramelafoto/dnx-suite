import "server-only";
import { prisma } from "@repo/db";
import { esSlugDnx } from "@/lib/slug-dnx";
import { TIPOS_DE_CITA_INICIALES } from "./constantes";

type Tipo = { name: string; color: string };

/** Los que faltan, comparando sin mayúsculas ni espacios de más. */
export function tiposFaltantes(existentes: readonly string[], deseados: readonly Tipo[] = TIPOS_DE_CITA_INICIALES): Tipo[] {
  const clave = (s: string) => s.trim().toLocaleLowerCase("es-AR");
  const hay = new Set(existentes.map(clave));
  return deseados.filter((d) => !hay.has(clave(d.name))).map((d) => ({ name: d.name, color: d.color }));
}

/**
 * Siembra los tipos de cita, sólo para DNX y sólo los que faltan (un tipo dado de baja no se
 * reactiva ni se duplica). Idempotente: el único (workspaceId, name) frena una corrida simultánea
 * (`skipDuplicates`). Devuelve cuántos creó. Se llama al abrir las pantallas de Agenda.
 */
export async function asegurarTiposCitaDnx(workspaceId: string, slug: string | null | undefined): Promise<number> {
  if (!esSlugDnx(slug)) return 0;
  const existentes = await prisma.fotofficeCitaTipo.findMany({ where: { workspaceId }, select: { name: true, order: true } });
  const faltan = tiposFaltantes(existentes.map((t) => t.name as string));
  if (faltan.length === 0) return 0;
  const desde = existentes.reduce((m, t) => Math.max(m, t.order as number), -1) + 1;
  const r = await prisma.fotofficeCitaTipo.createMany({
    data: faltan.map((t, i) => ({ workspaceId, name: t.name, color: t.color, order: desde + i })),
    skipDuplicates: true,
  });
  return r.count;
}
