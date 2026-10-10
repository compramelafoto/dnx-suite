import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { activityRole, can, rolesWith, type ActivityRole, type Capability, type TeamRole } from "@repo/muestras";
import { getUsuario, type Usuario } from "@/lib/usuario";

/**
 * El único lugar de la app que sabe quién es el dueño de una muestra (spec D2). Toda consulta o
 * acción sobre una muestra pide permiso acá: `dondePuede` mete el permiso en el `where` (una sola
 * consulta, sin "leer y después mirar"); `rolEnMuestra` lo lee cuando hace falta el rol para una
 * regla de estado (`canEdit`, `canPerform`).
 */
type Quien = Pick<Usuario, "id" | "esSuperAdmin">;

export async function rolEnMuestra(activityId: string, usuario: Quien): Promise<{ ownerUserId: number; role: ActivityRole | null } | null> {
  const a = await prisma.culturalActivity.findUnique({
    where: { id: activityId },
    select: { proposedByUserId: true, members: { where: { userId: usuario.id, status: "ACTIVE" }, select: { userId: true, role: true, status: true } } },
  });
  if (!a) return null;
  return { ownerUserId: a.proposedByUserId, role: activityRole(a, usuario.id) };
}

export const puede = (usuario: Quien, cap: Capability, role: ActivityRole | null) => can(cap, { role, isSuperAdmin: usuario.esSuperAdmin });

/** Para lo que sólo hace el dueño (convocatoria): no hace falta leer el equipo. */
export const puedeConDueno = (usuario: Quien, cap: Capability, ownerUserId: number) =>
  can(cap, { role: ownerUserId === usuario.id ? "OWNER" : null, isSuperAdmin: usuario.esSuperAdmin });

/**
 * Filtro de Prisma: "muestras donde esta persona tiene `cap`". `{ listado: true }` para los
 * listados del panel, donde el super admin ve sólo lo suyo (como hasta la etapa 4). Para sumarlo a
 * otras condiciones, `conPermiso` (o como filtro de relación, `activity: dondePuede(...)`).
 */
export function dondePuede(usuario: Quien, cap: Capability, { listado = false }: { listado?: boolean } = {}): Prisma.CulturalActivityWhereInput {
  if (usuario.esSuperAdmin && !listado) return {};
  const roles = rolesWith(cap);
  const o: Prisma.CulturalActivityWhereInput[] = [];
  if (roles.includes("OWNER")) o.push({ proposedByUserId: usuario.id });
  const equipo = roles.filter((r): r is TeamRole => r !== "OWNER");
  if (equipo.length) o.push({ members: { some: { userId: usuario.id, status: "ACTIVE", role: { in: equipo } } } });
  return { OR: o };
}

/**
 * `base` y además el permiso, siempre combinados con `AND` (nunca con spread): así ningún `where`
 * pisa un `OR`/`AND` propio con el del permiso, ni al revés.
 */
export function conPermiso(
  base: Prisma.CulturalActivityWhereInput, usuario: Quien, cap: Capability, opciones: { listado?: boolean } = {},
): Prisma.CulturalActivityWhereInput {
  return { AND: [base, dondePuede(usuario, cap, opciones)] };
}

/** Las visitas y escaneos del equipo no cuentan (D10). Sin cookie de sesión no toca la base. */
export async function esDelEquipo(activityId: string): Promise<boolean> {
  const u = await getUsuario();
  if (!u) return false;
  if (u.esSuperAdmin) return true;
  return (await prisma.culturalActivity.count({ where: conPermiso({ id: activityId }, u, "view") })) > 0;
}
