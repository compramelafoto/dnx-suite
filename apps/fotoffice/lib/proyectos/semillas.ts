import "server-only";
import { prisma } from "@repo/db";
import { esSlugDnx } from "@/lib/slug-dnx";

/**
 * Los 16 roles de participante de DNX Estudio, con los nombres exactos de la configuración real
 * (docs/alboom/09-configuracion-real-dnx.md, «Participantes»).
 */
export const ROLES_PROYECTO_DNX: readonly string[] = [
  "Fotógrafo Principal",
  "Fotógrafo Secundario",
  "Asistente de Fotógrafo",
  "Filmaker",
  "Maquilladora de Glitter",
  "Maquilladora en Sesión de Fotos",
  "Cliente",
  "Otro",
  "Salón",
  "DJ",
  "Catering",
  "Mesa Dulce",
  "Alquiler de Pantalla",
  "Músicos",
  "Shows para fiesta",
  "Operador de Plataforma",
];

/** Los que faltan, comparando sin mayúsculas ni espacios de más. */
export function rolesFaltantes(existentes: readonly string[], deseados: readonly string[] = ROLES_PROYECTO_DNX): string[] {
  const clave = (s: string) => s.trim().toLocaleLowerCase("es-AR");
  const hay = new Set(existentes.map(clave));
  return deseados.filter((d) => !hay.has(clave(d)));
}

/**
 * Siembra los roles de participante, sólo para DNX y sólo los que faltan (un rol dado de baja
 * no se reactiva ni se duplica). Idempotente: el único (workspaceId, name) frena una corrida
 * simultánea (`skipDuplicates`). Devuelve cuántos creó.
 */
export async function asegurarRolesProyectoDnx(workspaceId: string, slug: string | null | undefined): Promise<number> {
  if (!esSlugDnx(slug)) return 0;
  const existentes = await prisma.fotofficeProyectoRol.findMany({ where: { workspaceId }, select: { name: true, order: true } });
  const faltan = rolesFaltantes(existentes.map((r) => r.name as string));
  if (faltan.length === 0) return 0;
  const desde = existentes.reduce((m, r) => Math.max(m, r.order as number), -1) + 1;
  const r = await prisma.fotofficeProyectoRol.createMany({
    data: faltan.map((name, i) => ({ workspaceId, name, order: desde + i })),
    skipDuplicates: true,
  });
  return r.count;
}
