import "server-only";
import { prisma } from "@repo/db";
import { invitationState, isTeamRole, type ActivityRole, type TeamRole } from "@repo/muestras";
import type { Usuario } from "@/lib/usuario";
import { esTokenConForma, hashDeToken } from "@/lib/curaduria/token";
import { puede, rolEnMuestra } from "./permisos";

type Quien = Pick<Usuario, "id" | "esSuperAdmin">;

/** Sólo el nombre (nunca el email) de una persona, para mostrar en el equipo. */
async function soloNombre(id: number): Promise<string | null> {
  const u = await prisma.user.findUnique({ where: { id }, select: { name: true } });
  return u?.name?.trim() || null;
}

export type Integrante = {
  id: string; email: string; nombre: string | null; role: TeamRole; status: string;
  invitedAt: Date; acceptedAt: Date | null; vencida: boolean; esVos: boolean;
};

/**
 * El equipo de una muestra para quien tiene `view`. Los que quedaron fuera del equipo los ve sólo
 * quien lo maneja (para volver a invitarlos). `null` si no puede verla.
 */
export async function equipoDeLaMuestra(activityId: string, usuario: Quien) {
  const r = await rolEnMuestra(activityId, usuario);
  if (!r || !puede(usuario, "view", r.role)) return null;
  const a = await prisma.culturalActivity.findUnique({ where: { id: activityId }, select: { id: true, title: true, type: true } });
  if (!a || a.type !== "MUESTRA") return null;
  const puedeGestionar = puede(usuario, "manageTeam", r.role);
  const ahora = new Date();
  const [filas, duenio] = await Promise.all([
    prisma.culturalActivityMember.findMany({
      where: { activityId, ...(puedeGestionar ? {} : { status: { not: "REVOKED" } }) },
      select: { id: true, email: true, userId: true, role: true, status: true, invitedAt: true, acceptedAt: true },
      orderBy: { invitedAt: "asc" },
      take: 100,
    }),
    soloNombre(r.ownerUserId),
  ]);
  const ids = [...new Set(filas.flatMap((f) => (f.status === "ACTIVE" && f.userId != null ? [f.userId] : [])))];
  const nombres = ids.length
    ? new Map((await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((u) => [u.id, u.name?.trim() || null]))
    : new Map<number, string | null>();
  const integrantes: Integrante[] = filas.flatMap((f) =>
    isTeamRole(f.role)
      ? [{
          id: f.id, email: f.email, nombre: f.userId != null && f.status === "ACTIVE" ? nombres.get(f.userId) ?? null : null,
          role: f.role, status: f.status, invitedAt: f.invitedAt, acceptedAt: f.acceptedAt,
          vencida: invitationState(f, ahora) === "EXPIRED", esVos: f.status === "ACTIVE" && f.userId === usuario.id,
        }]
      : [],
  );
  return {
    muestra: { id: a.id, title: a.title },
    rol: r.role as ActivityRole | null,
    puedeGestionar,
    duenio: { nombre: duenio },
    integrantes,
  };
}

/** Para la página de aceptar: qué muestra, qué rol y para qué email. Sin ids de usuario. */
export async function invitacionPorToken(token: string) {
  if (!esTokenConForma(token)) return null;
  const k = await prisma.culturalActivityMember.findUnique({
    where: { tokenHash: hashDeToken(token) },
    select: { email: true, role: true, status: true, invitedAt: true, invitedByUserId: true, activity: { select: { title: true } } },
  });
  if (!k || !isTeamRole(k.role)) return null;
  return {
    muestra: k.activity.title,
    rol: k.role,
    email: k.email,
    estado: invitationState(k, new Date()),
    invita: await soloNombre(k.invitedByUserId),
  };
}
