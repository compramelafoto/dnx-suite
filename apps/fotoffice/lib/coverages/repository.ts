import "server-only";
import { prisma } from "@repo/db";
import type { ParsedCollaboratorProfile } from "./colaboradores";
import { DEFAULT_COVERAGE_SETTINGS, type CoverageSettingsShape } from "./settings";
import { whereForFilter } from "./inbox-filters";
import { PUBLIC_FORM_WINDOW_MINUTES } from "./rate-limit";
import { REQUEST_LIVE_STATUSES } from "./states";
import { hashTrackingToken } from "./tracking-token";

/**
 * Todas las consultas del módulo, en un solo lugar.
 *
 * **Regla sin excepciones: cada consulta lleva `workspaceId`.** No alcanza con que la pantalla
 * ya lo haya resuelto; una consulta sin él acá es una fuga esperando a que alguien la use
 * desde otra pantalla. `lib/coverages/aislamiento.test.ts` lo verifica sobre el código fuente.
 */

/** La configuración del workspace, o los valores por omisión si nunca se tocó. */
export async function loadSettings(workspaceId: string): Promise<CoverageSettingsShape> {
  const fila = await prisma.coverageSettings.findUnique({ where: { workspaceId } });
  if (!fila) return DEFAULT_COVERAGE_SETTINGS;
  return {
    moduleLabel: fila.moduleLabel,
    termRequest: fila.termRequest,
    termCollaborator: fila.termCollaborator,
    termRequester: fila.termRequester,
    termCall: fila.termCall,
    assignmentMode: fila.assignmentMode,
    requiresApproval: fila.requiresApproval,
    requiresCoordinatorConfirmation: fila.requiresCoordinatorConfirmation,
    reinforcementThresholdMinutes: fila.reinforcementThresholdMinutes,
    recommendedCollaborators: fila.recommendedCollaborators,
    roleTemplates: fila.roleTemplates,
    specialties: fila.specialties,
    zones: fila.zones,
    publicFormEnabled: fila.publicFormEnabled,
    publicFormIntro: fila.publicFormIntro,
    consentTextVersion: fila.consentTextVersion,
    trackingLinkTtlDays: fila.trackingLinkTtlDays,
    notifyEmails: fila.notifyEmails,
  };
}

export async function listRequests(input: {
  workspaceId: string;
  filter: string;
  now?: Date;
}) {
  return prisma.coverageRequest.findMany({
    where: {
      workspaceId: input.workspaceId,
      ...whereForFilter(input.filter, input.now ?? new Date()),
    },
    select: {
      id: true,
      publicCode: true,
      eventTitle: true,
      startsAt: true,
      endsAt: true,
      city: true,
      status: true,
      priority: true,
      createdAt: true,
      client: { select: { businessName: true, firstName: true, lastName: true } },
    },
    orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
}

/** La ficha completa. Devuelve `null` si esa solicitud es de otro workspace. */
export async function loadRequest(input: { workspaceId: string; id: string }) {
  return prisma.coverageRequest.findFirst({
    where: { id: input.id, workspaceId: input.workspaceId },
    include: {
      client: true,
      consents: true,
      coverages: { orderBy: { startsAt: "asc" } },
    },
  });
}

/**
 * La solicitud detrás de un enlace de seguimiento.
 *
 * Busca por el hash y **no** por el token crudo, que nunca se guardó.
 *
 * No filtra por workspace a propósito: el token ES la credencial y no sabe de qué institución
 * es. Quien lo tiene ve esa solicitud y ninguna otra.
 *
 * `select` explícito, campo por campo, en vez de `include` sobre la fila entera: esta es la
 * consulta detrás de una pantalla pública sin cuenta, así que lo que no se trae acá no se
 * puede filtrar por accidente el día que alguien pase esta fila a un componente cliente o a
 * un registro. Nada de `coordinatorUserId`, `priority` ni ningún otro campo interno.
 */
export async function findByTrackingToken(rawToken: string) {
  return prisma.coverageRequest.findUnique({
    where: { tokenHash: hashTrackingToken(rawToken) },
    select: {
      id: true,
      workspaceId: true,
      publicCode: true,
      eventTitle: true,
      startsAt: true,
      status: true,
      rejectionReason: true,
      infoRequested: true,
      tokenExpiresAt: true,
      tokenRevokedAt: true,
      client: { select: { businessName: true } },
    },
  });
}

/**
 * Cuántos envíos hubo desde este correo o desde este origen en la ventana.
 *
 * Se cuenta sobre `CoverageRequest`, sin tabla nueva: las filas que queremos limitar son
 * exactamente las que ya se guardan.
 *
 * El `OR` entre correo y origen comparte el cupo entre los dos criterios, y eso tiene dos
 * costados imperfectos, aceptados a propósito para esta etapa:
 * - Falso positivo: dos organizaciones detrás del mismo origen (misma red, mismo dispositivo)
 *   se gastan el cupo entre sí. Alguien que nunca envió nada puede quedar frenado por un envío
 *   ajeno.
 * - Evasión: si `originHash` es `null` (sin sal configurada, ver `hashOrigen`), cambiar de
 *   correo en cada envío evade el límite por completo.
 * Se acepta igual porque el tope de 3 por hora es alto para una organización real (no lo va a
 * rozar) y bajo para un envío automático (lo corta enseguida). Afinar esto de verdad requeriría
 * identificar a quien envía, que es justo el dato que este formulario público evita pedir.
 */
export async function countRecentSubmissions(input: {
  workspaceId: string;
  email: string;
  originHash: string | null;
  now?: Date;
}): Promise<number> {
  const desde = new Date(
    (input.now ?? new Date()).getTime() - PUBLIC_FORM_WINDOW_MINUTES * 60 * 1000,
  );
  return prisma.coverageRequest.count({
    where: {
      workspaceId: input.workspaceId,
      createdAt: { gte: desde },
      OR: [
        { client: { email: input.email } },
        ...(input.originHash
          ? [{ consents: { some: { sourceHash: input.originHash } } }]
          : []),
      ],
    },
  });
}

/** Si ya hay una solicitud viva del mismo correo para la misma fecha. */
export async function findDuplicateRequest(input: {
  workspaceId: string;
  email: string;
  startsAt: Date;
}) {
  return prisma.coverageRequest.findFirst({
    where: {
      workspaceId: input.workspaceId,
      startsAt: input.startsAt,
      status: { in: [...REQUEST_LIVE_STATUSES] },
      client: { email: input.email },
    },
    select: { id: true, publicCode: true },
  });
}

/**
 * Los socios del workspace, con su perfil de colaborador si lo tienen.
 *
 * Alimenta la pantalla de administración (`/coberturas/colaboradores`): de ahí sale a quién
 * marcar como colaborador activo. Trae TODOS los socios, no solo los que ya tienen perfil —
 * la pantalla necesita poder ofrecerle el alta a alguien que todavía nunca se tocó— y por eso
 * la consulta es sobre `Member`, no sobre `CoverageCollaboratorProfile`.
 */
export async function listCollaborators(input: { workspaceId: string }) {
  return prisma.member.findMany({
    where: { workspaceId: input.workspaceId },
    select: {
      id: true,
      memberNumber: true,
      firstName: true,
      lastName: true,
      email: true,
      city: true,
      status: true,
      coverageProfile: {
        select: {
          active: true,
          homeCity: true,
          coverageZones: true,
          maxTravelKm: true,
          transport: true,
          equipment: true,
          specialties: true,
          experienceLevel: true,
          acceptsUrgent: true,
          notes: true,
        },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

/**
 * La ficha de una cobertura: sus roles (con sus asignaciones vivas, para calcular cupos con
 * `lib/coverages/cupos.ts`), su convocatoria si ya la tiene, y los datos mínimos de la
 * solicitud de la que salió, para el enlace de "volver". Devuelve `null` si esa cobertura es de
 * otro workspace.
 *
 * Las asignaciones se traen ahora aunque esta etapa todavía no las genera (eso es de la tanda
 * siguiente, que elige el equipo): sin este campo, esa tanda tendría que volver a tocar esta
 * consulta para poder calcular lugares libres.
 */
export async function loadCoverage(input: { workspaceId: string; coverageId: string }) {
  return prisma.coverage.findFirst({
    where: { id: input.coverageId, workspaceId: input.workspaceId },
    include: {
      request: { select: { id: true, publicCode: true, eventTitle: true, status: true } },
      roles: {
        orderBy: { createdAt: "asc" },
        include: { assignments: { select: { id: true, status: true } } },
      },
      call: true,
    },
  });
}

/** El perfil de colaborador de un socio puntual. `null` si nunca se creó o es de otro workspace. */
export async function loadCollaboratorProfile(input: { workspaceId: string; memberId: string }) {
  return prisma.coverageCollaboratorProfile.findFirst({
    where: { workspaceId: input.workspaceId, memberId: input.memberId },
  });
}

/**
 * Crea o actualiza el perfil de colaborador de un socio.
 *
 * Antes de escribir nada, verifica que ese `memberId` sea de ESTE workspace. Sin ese chequeo,
 * un `memberId` de otra institución llegado a mano en el `FormData` (el formulario solo ofrece
 * los socios del propio padrón, pero eso es cortesía de la pantalla, no un control) crearía un
 * `CoverageCollaboratorProfile` que cruza instituciones — el `memberId` es `@unique` en el
 * modelo, así que el `where` del `upsert` no puede llevar el aislamiento por sí solo: hace
 * falta esta comprobación antes.
 *
 * Devuelve `null`, sin escribir nada, cuando el socio no es de este workspace.
 */
export async function upsertCollaboratorProfile(input: {
  workspaceId: string;
  memberId: string;
  datos: ParsedCollaboratorProfile;
}) {
  const socio = await prisma.member.findFirst({
    where: { id: input.memberId, workspaceId: input.workspaceId },
    select: { id: true },
  });
  if (!socio) return null;

  return prisma.coverageCollaboratorProfile.upsert({
    where: { memberId: input.memberId, workspaceId: input.workspaceId },
    update: { ...input.datos },
    create: { workspaceId: input.workspaceId, memberId: input.memberId, ...input.datos },
  });
}
