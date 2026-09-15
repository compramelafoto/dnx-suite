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
 * Por cada rol vienen sus asignaciones (para calcular lugares libres) y sus postulaciones con
 * el mensaje que escribió cada persona: de ahí sale la pantalla donde la coordinación elige el
 * equipo. Los dos con el nombre del socio, porque una lista de identificadores no le sirve a
 * nadie para decidir.
 */
export async function loadCoverage(input: { workspaceId: string; coverageId: string }) {
  return prisma.coverage.findFirst({
    where: { id: input.coverageId, workspaceId: input.workspaceId },
    include: {
      request: { select: { id: true, publicCode: true, eventTitle: true, status: true } },
      roles: {
        orderBy: { createdAt: "asc" },
        include: {
          assignments: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              status: true,
              origin: true,
              memberId: true,
              member: { select: { firstName: true, lastName: true } },
            },
          },
          applications: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              status: true,
              message: true,
              createdAt: true,
              memberId: true,
              member: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
      call: true,
    },
  });
}

/**
 * Los colaboradores activos del workspace, para ofrecerlos en la invitación directa.
 *
 * Distinta de `listCollaborators`, que trae TODO el padrón porque su pantalla necesita poder
 * darle el alta a quien todavía no tiene perfil. Acá, en cambio, invitar a alguien sin perfil
 * activo es justo lo que `planInvitacionDirecta` rechaza, así que ofrecerlo en la lista sería
 * ofrecer un botón que no puede funcionar.
 */
export async function listActiveCollaborators(input: { workspaceId: string }) {
  return prisma.member.findMany({
    where: { workspaceId: input.workspaceId, coverageProfile: { active: true } },
    select: { id: true, firstName: true, lastName: true, memberNumber: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

/**
 * Una invitación puntual, para la pantalla donde la persona la responde.
 *
 * El aislamiento es doble y los dos filtros van en el mismo `where`, no en un `if` después de
 * traer la fila: por workspace (vía la cobertura) y por persona (`memberId`). Nadie responde la
 * invitación de otro, y una invitación ajena no vuelve `null` por un chequeo que alguien pueda
 * borrar sin querer: directamente no aparece.
 *
 * Es la única consulta del módulo que trae `privateBriefing` —teléfono de emergencia, contacto
 * del día—: eso es exactamente lo que ve quien ya está invitada y no ve nadie más (ver
 * `loadCallForPortal`, que a propósito no lo trae).
 */
export async function loadMyAssignment(input: {
  workspaceId: string;
  memberId: string;
  assignmentId: string;
}) {
  return prisma.coverageAssignment.findFirst({
    where: {
      id: input.assignmentId,
      memberId: input.memberId,
      coverage: { workspaceId: input.workspaceId },
    },
    select: {
      id: true,
      status: true,
      origin: true,
      respondBy: true,
      role: { select: { name: true, requirements: true } },
      coverage: {
        select: {
          title: true,
          startsAt: true,
          endsAt: true,
          addressLine: true,
          city: true,
          instructions: true,
          call: { select: { id: true, publicSummary: true, privateBriefing: true } },
        },
      },
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

/**
 * Las convocatorias publicadas de este workspace, para el portal del voluntario.
 *
 * Solo `PUBLICADA`: una convocatoria en borrador, cerrada, vencida o cancelada no tiene nada
 * que ofrecerle a quien busca anotarse — ni siquiera como lectura, porque mostrarla ahí sugiere
 * que se puede hacer algo con ella. Trae los roles con sus asignaciones para que la pantalla
 * calcule cuántos lugares quedan con `lib/coverages/cupos.ts`, sin una segunda vuelta a la base.
 */
export async function listOpenCallsForPortal(input: { workspaceId: string }) {
  return prisma.coverageCall.findMany({
    where: { workspaceId: input.workspaceId, status: "PUBLICADA" },
    select: {
      id: true,
      title: true,
      urgency: true,
      coverage: {
        select: {
          startsAt: true,
          endsAt: true,
          addressLine: true,
          city: true,
          roles: {
            select: {
              vacancies: true,
              assignments: { select: { status: true } },
            },
          },
        },
      },
    },
    orderBy: { coverage: { startsAt: "asc" } },
  });
}

/**
 * Las postulaciones de este colaborador, para "tus postulaciones" del portal.
 *
 * El aislamiento acá es doble: por workspace (vía la convocatoria, `CoverageApplication` no
 * tiene la columna directa) y por persona (`memberId`). Sin el segundo filtro, cualquier socio
 * vería las postulaciones de cualquier otro — el cuidado del plan sobre "mis postulaciones" es
 * exactamente este.
 */
export async function listMyApplications(input: { workspaceId: string; memberId: string }) {
  return prisma.coverageApplication.findMany({
    where: { memberId: input.memberId, call: { workspaceId: input.workspaceId } },
    select: {
      id: true,
      status: true,
      createdAt: true,
      role: { select: { name: true } },
      call: {
        select: {
          id: true,
          title: true,
          coverage: { select: { startsAt: true, city: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Las asignaciones de este colaborador que todavía esperan su respuesta: "tus invitaciones".
 *
 * Solo `INVITADA`. `ACEPTADA` y `CONFIRMADA` ya no esperan nada de esta persona, y `RECHAZADA` /
 * `CANCELADA` / `REEMPLAZADA` tampoco: lo que va acá es exactamente lo que tiene un plazo
 * corriendo, que es por lo que este bloque va primero en la pantalla (ver el plan).
 */
export async function listMyPendingAssignments(input: { workspaceId: string; memberId: string }) {
  return prisma.coverageAssignment.findMany({
    where: {
      memberId: input.memberId,
      status: "INVITADA",
      coverage: { workspaceId: input.workspaceId },
    },
    select: {
      id: true,
      createdAt: true,
      role: { select: { name: true } },
      coverage: { select: { title: true, startsAt: true, city: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * El detalle de una convocatoria para el portal del voluntario.
 *
 * Trae la cobertura completa —**dirección incluida**, ver §3.4 del diseño: quien la ve es un
 * colaborador con sesión iniciada y sin la dirección no puede decidir si le queda cerca— y sus
 * roles con TODAS sus asignaciones y postulaciones (de cualquier persona, no solo de quien
 * mira), para que la pantalla calcule cupos con `cupos.ts` y elegibilidad con `elegibilidad.ts`
 * sin una segunda consulta. Que ese detalle llegue hasta acá no filtra nada hacia el navegador:
 * la pantalla lo reduce a números y booleanos antes de pintar nada.
 *
 * Devuelve `null` si la convocatoria es de otro workspace. **No** trae `privateBriefing`: eso es
 * solo para quien ya está asignado (tanda siguiente), y esta consulta la usa cualquier
 * colaborador que abra el enlace.
 */
export async function loadCallForPortal(input: { workspaceId: string; callId: string }) {
  return prisma.coverageCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: {
      id: true,
      title: true,
      publicSummary: true,
      status: true,
      urgency: true,
      applicationsCloseAt: true,
      coverage: {
        select: {
          title: true,
          startsAt: true,
          endsAt: true,
          addressLine: true,
          city: true,
          instructions: true,
          roles: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              name: true,
              requirements: true,
              vacancies: true,
              assignments: { select: { status: true, memberId: true } },
              applications: { select: { memberId: true } },
            },
          },
        },
      },
    },
  });
}
