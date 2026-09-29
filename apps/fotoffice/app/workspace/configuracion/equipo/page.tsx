import { listTeam } from "@repo/db/fotoffice-team";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { puede } from "@/lib/access/policy";
import { etiquetaRol } from "@/lib/access/roles";
import { requireAuth } from "@/lib/auth";
import { requireOwnWorkspace } from "@/lib/entrada/require-own-workspace";
import { invitationState } from "@/lib/members/invitations";
import { getModuleDefinition } from "@/lib/modules/registry";
import { tipoPorId } from "@/lib/landing/tipos";
import { rolesOfrecidos } from "@/lib/team/rules";
import { EquipoClient, type EventoVista, type InvitacionVista, type MiembroVista } from "./equipo-client";

export const dynamic = "force-dynamic";

type Miembros = { userId: number; name: string | null; email: string }[];
type Evento = Awaited<ReturnType<typeof listTeam>>["events"][number];

function persona(userId: number | null | undefined, email: string | null | undefined, miembros: Miembros) {
  const m = userId != null ? miembros.find((x) => x.userId === userId) : undefined;
  return m?.name || m?.email || email || "alguien";
}

function labelModulo(key: string | null) {
  return (key && getModuleDefinition(key)?.label) || key || "un módulo";
}

/** El texto del historial, en español y sin tecnicismos. */
function textoEvento(e: Evento, miembros: Miembros): string {
  const objetivo = persona(e.targetUserId, e.targetEmail, miembros);
  switch (e.kind) {
    case "INVITED":
      return `invitó a ${e.targetEmail ?? "alguien"} como ${etiquetaRol(e.toRole)}`;
    case "INVITE_REVOKED":
      return `anuló la invitación de ${e.targetEmail ?? "alguien"}`;
    case "ACCEPTED":
      return `${objetivo} aceptó la invitación como ${etiquetaRol(e.toRole)}`;
    case "ROLE_CHANGED":
      return `cambió el rol de ${objetivo} de ${etiquetaRol(e.fromRole)} a ${etiquetaRol(e.toRole)}`;
    case "REMOVED":
      return `dio de baja a ${objetivo}`;
    case "MODULE_ON":
      return `encendió el módulo ${labelModulo(e.moduleKey)}`;
    case "MODULE_OFF":
      return `apagó el módulo ${labelModulo(e.moduleKey)}`;
    case "MODULE_REQUESTED":
      return `pidió activar ${labelModulo(e.moduleKey)}`;
    case "ORG_TYPE_SET":
      return `eligió el tipo ${tipoPorId(e.detail)?.label ?? e.detail ?? ""}`.trim();
    default:
      return "hizo un cambio";
  }
}

export default async function EquipoPage() {
  const user = await requireAuth();
  const ensured = await requireOwnWorkspace(user);
  const membership = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId: ensured.workspaceId } },
    select: { role: true },
  });
  const role = membership?.role ?? null;

  if (!role || !puede(role, "gestionarEquipo")) {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader title="Equipo" />
        <p className="text-sm text-[var(--fo-muted)]">
          Sólo el dueño o un administrador pueden ver y gestionar el equipo.
        </p>
      </div>
    );
  }

  const team = await listTeam(ensured.workspaceId);
  const ofrecidos = rolesOfrecidos(role, getModuleDefinition("projects")?.status === "AVAILABLE");
  const esDueno = role === "WORKSPACE_OWNER";

  // Quien ya no está en el equipo (o nunca estuvo) igual tiene que aparecer con su nombre.
  const conocidos = new Set(team.members.map((m) => m.userId));
  const faltantes = new Set<number>();
  for (const e of team.events) {
    for (const id of [e.actorUserId, e.targetUserId]) {
      if (id != null && !conocidos.has(id)) faltantes.add(id);
    }
  }
  const extra = faltantes.size
    ? await prisma.user.findMany({
        where: { id: { in: [...faltantes] } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const personas: Miembros = [
    ...team.members.map((m) => ({ userId: m.userId, name: m.name, email: m.email })),
    ...extra.map((u) => ({ userId: u.id, name: u.name, email: u.email })),
  ];

  const miembros: MiembroVista[] = team.members.map((m) => ({
    userId: m.userId,
    name: m.name,
    email: m.email,
    role: m.role,
    roleLabel: etiquetaRol(m.role),
    lastLogin: m.lastLoginAt ? m.lastLoginAt.toLocaleDateString("es-AR") : "Nunca",
    esUnoMismo: m.userId === user.id,
  }));
  // Una anulada que ya fue reemplazada por otra más nueva al mismo correo es ruido.
  const conMasNueva = (i: (typeof team.invitations)[number]) =>
    team.invitations.some(
      (o) => o.id !== i.id && o.email === i.email && o.expiresAt.getTime() > i.expiresAt.getTime(),
    );
  const invitaciones: InvitacionVista[] = team.invitations
    .filter((i) => !(i.revokedAt && !i.acceptedAt && conMasNueva(i)))
    .map((i) => ({
      id: i.id,
      email: i.email,
      roleLabel: etiquetaRol(i.role),
      estado: invitationState(i),
      vence: i.expiresAt.toLocaleDateString("es-AR"),
      falloEnvio: !!i.sendFailedAt && !i.sentAt,
    }))
    .filter((i) => i.estado !== "ACCEPTED");
  const eventos: EventoVista[] = team.events.map((e) => ({
    id: e.id,
    fecha: e.createdAt.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }),
    actor: e.actorUserId == null ? "El sistema" : persona(e.actorUserId, null, personas),
    texto: textoEvento(e, personas),
  }));

  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader
        title="Equipo"
        description="Invitá a quien trabaja con vos y elegí qué rol tiene cada persona."
      />
      <EquipoClient
        miembros={miembros}
        invitaciones={invitaciones}
        eventos={eventos}
        rolesInvitar={ofrecidos.map((r) => ({ value: r, label: etiquetaRol(r) }))}
        rolesCambiar={[...ofrecidos, ...(esDueno ? ["WORKSPACE_OWNER"] : [])].map((r) => ({
          value: r,
          label: etiquetaRol(r),
        }))}
      />
    </div>
  );
}
