import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { getEnabledModuleKeysForWorkspace } from "@/lib/modules/gating";
import { rolesOfrecidos } from "@/lib/team/rules";
import { armarInvitaciones, armarMiembros, describirRoles, resumenAccesoEquipo } from "@/lib/team/vista";
import { aplicarVocabulario } from "@/lib/vocabulario/plantilla";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { EquipoClient } from "./equipo-client";

export const dynamic = "force-dynamic";

/**
 * Equipo: las personas que trabajan en el espacio (dueño, administradores y Equipo) y las
 * invitaciones pendientes. Es para todos los espacios: un estudio invita a sus empleados, y una
 * institución puede sumar personal que no es socio. No compite con Comisión directiva: acá se
 * decide QUIÉN entra y con qué rol general; los roles por módulo de la comisión (que sólo se
 * asignan a socios) siguen allá, y a quien los tiene se lo administra desde allá.
 */
export default async function EquipoPage() {
  const { user, workspace, role } = await requireActiveWorkspaceRole();
  if (!role || !puede(role, "gestionarEquipo")) redirect("/workspace/configuracion");

  const now = new Date();
  const [memberships, asignaciones, invitaciones, enabled, vocab] = await Promise.all([
    prisma.workspaceMembership.findMany({
      where: { workspaceId: workspace.id },
      select: { role: true, createdAt: true, user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.workspaceRoleAssignment.findMany({
      where: { workspaceId: workspace.id },
      select: { userId: true, member: { select: { userId: true } } },
    }),
    prisma.workspaceInvitation.findMany({
      where: { workspaceId: workspace.id, acceptedAt: null, revokedAt: null },
      select: { id: true, email: true, role: true, createdAt: true, expiresAt: true, sentAt: true, sendFailedAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    getEnabledModuleKeysForWorkspace(workspace.id),
    loadPersonVocabulary(workspace.id),
  ]);

  const conRoles = new Set<number>();
  for (const a of asignaciones) {
    if (a.userId != null) conRoles.add(a.userId);
    if (a.member?.userId != null) conRoles.add(a.member.userId);
  }

  const miembros = armarMiembros(
    memberships.map((m) => ({ ...m, tieneRolesComision: conRoles.has(m.user.id) })),
    user.id,
  );
  const resumen = resumenAccesoEquipo(enabled, (l) => aplicarVocabulario(l, vocab));
  // Colaborador no se ofrece (ver `COLABORADOR_DISPONIBLE` en ./actions).
  const roles = describirRoles(rolesOfrecidos(role, false), resumen);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Equipo"
        description="Las personas que trabajan con vos en este espacio. Invitá a alguien por correo: entra con su propia cuenta y ve sólo lo que le permite su rol."
      />
      <EquipoClient miembros={miembros} invitaciones={armarInvitaciones(invitaciones, now)} roles={roles} />
    </div>
  );
}
