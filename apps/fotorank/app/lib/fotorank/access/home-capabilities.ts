/**
 * Resolución de capacidades post-login (ETAPA 09B).
 * Una sola identidad User → destinos y secciones del hub personal.
 * Jurado: detectado por FotorankJudgeAccount con el mismo email (cuenta existente).
 *
 * Fail-closed: las 3 consultas se ejecutan de forma independiente
 * (Promise.allSettled). Los rechazos de esas 3 consultas se convierten en un
 * estado degradado y restrictivo (nunca en acceso concedido) y quedan
 * registrados con un incidentId correlacionable. Una excepción inesperada
 * FUERA de esas 3 consultas (armado del resultado, `randomUUID`, etc.) no
 * está cubierta acá — la captura el nivel superior (error boundary de la
 * app; ver `app/error.tsx`).
 *
 * Deduplicación por request: `fetchHomeCapabilitiesSettled` está envuelta en
 * `cache()` de React con argumentos primitivos (userId, email). Next.js
 * resetea ese cache al inicio de cada request — nunca persiste entre
 * usuarios ni entre requests distintos (confirmado leyendo la implementación
 * de `cache()` en el build react-server instalado: usa un cache root que
 * cuelga del dispatcher async-scoped de React, no un Map global). Dentro de
 * un mismo request, `(home)/layout.tsx` y `mi-actividad/page.tsx` llaman a
 * esta función con los mismos argumentos primitivos → 1 sola ejecución real
 * de las 3 queries, no 2. La consulta que corre durante el login en sí NO
 * se deduplica con la del render posterior: son requests HTTP distintos
 * (POST del login vs. GET de la página de destino tras el redirect), y el
 * cache de `cache()` no sobrevive esa frontera — eso no es evitable con este
 * mecanismo.
 */
import { randomUUID } from "node:crypto";
import { cache } from "react";
import { Prisma, prisma } from "@repo/db";

export type HomeCapabilityKind =
  | "participant"
  | "organizer"
  | "jury"
  | "superAdmin"
  | "none";

export type HomeParticipationSummary = {
  id: string;
  contestTitle: string;
  contestSlug: string;
  status: string;
  registrationNumber: string;
};

export type HomeOrganizationSummary = {
  id: string;
  name: string;
  slug: string;
};

export type HomeOrganizerContestSummary = {
  id: string;
  title: string;
  slug: string;
  organizationId: string;
  organizationName: string;
  status: string;
};

export type HomeJuryContestSummary = {
  contestId: string;
  title: string;
  slug: string;
  judgeAccountId: string;
};

/** Qué consulta independiente falló. Usado para logging y para el aviso al usuario. */
export type HomeCapabilityFailedPart = "registrations" | "memberships" | "judgeAccount";

export type HomeCapabilities = {
  userId: number;
  email: string;
  isSuperAdmin: boolean;
  hasParticipations: boolean;
  hasOrganizations: boolean;
  hasJuryAccount: boolean;
  participations: HomeParticipationSummary[];
  organizations: HomeOrganizationSummary[];
  organizerContests: HomeOrganizerContestSummary[];
  juryContests: HomeJuryContestSummary[];
  /** Capabilidades “activas” (excluye none). */
  kinds: Exclude<HomeCapabilityKind, "none">[];
  /** true si al menos una de las 3 consultas falló. No implica "sin acceso": implica "no se pudo confirmar". */
  degraded: boolean;
  /** Qué partes fallaron. Vacío si degraded=false. */
  failedParts: HomeCapabilityFailedPart[];
  /** Identificador correlacionable con los logs del servidor. null si no hubo fallos. */
  incidentId: string | null;
};

export type ResolveHomeCapabilitiesInput = {
  userId: number;
  email: string;
  globalRole?: string | null;
};

type RawRegistration = {
  id: string;
  status: string;
  registrationNumber: string;
  contest: { title: string; slug: string };
};

type RawMembership = {
  organization: {
    id: string;
    name: string;
    slug: string;
    contests: Array<{
      id: string;
      title: string;
      slug: string;
      status: string;
      organizationId: string;
    }>;
  };
};

type RawJudgeAccount = {
  id: string;
  accountStatus: string;
  assignments: Array<{
    contestId: string;
    contest: { id: string; title: string; slug: string };
  }>;
} | null;

type SettledCapabilityInputs = {
  registrations: PromiseSettledResult<RawRegistration[]>;
  memberships: PromiseSettledResult<RawMembership[]>;
  judgeAccount: PromiseSettledResult<RawJudgeAccount>;
};

/**
 * Categoría segura de un fallo de Prisma, sin datos de usuario ni de conexión.
 * `code` es el código corto y documentado de Prisma (p. ej. "P2025",
 * "P1001") — nunca su `.message`, que en algunos casos de Prisma puede
 * incluir el nombre de columnas/tablas o fragmentos de la operación.
 */
export type SanitizedFailure = { category: string; code: string | null };

/** Exportada para que otros puntos de captura (login/actions.ts, login/page.tsx) usen la misma clasificación sin duplicarla. */
export function classifyFailure(reason: unknown): SanitizedFailure {
  if (reason instanceof Prisma.PrismaClientKnownRequestError) {
    return { category: "known_request", code: reason.code };
  }
  if (reason instanceof Prisma.PrismaClientInitializationError) {
    return { category: "connection", code: reason.errorCode ?? null };
  }
  if (reason instanceof Prisma.PrismaClientRustPanicError) {
    return { category: "engine_panic", code: null };
  }
  if (reason instanceof Prisma.PrismaClientUnknownRequestError) {
    return { category: "unknown_request", code: null };
  }
  if (reason instanceof Prisma.PrismaClientValidationError) {
    return { category: "validation", code: null };
  }
  return { category: "other", code: null };
}

/**
 * Log sanitizado: nunca connection strings, hosts, SQL, parámetros, emails,
 * tokens, cookies, secretos, contraseñas ni `.message` crudo — solo
 * categoría + código corto de Prisma. El detalle completo (si hace falta
 * para debug) queda en la observabilidad de la plataforma (logs de runtime
 * de Vercel, que ya capturan la excepción real); esto no intenta ser un
 * sistema de observabilidad nuevo, solo la miga de pan correlacionable.
 */
function logFotorankAccessFailure(
  part: HomeCapabilityFailedPart,
  incidentId: string,
  userId: number,
  reason: unknown,
): void {
  const { category, code } = classifyFailure(reason);
  console.error("FOTORANK_HOME_CAPABILITIES_FAILURE", {
    incidentId,
    part,
    userId,
    category,
    code,
  });
}

/**
 * Pura, sin I/O: arma `HomeCapabilities` a partir de los 3 resultados ya
 * resueltos (fulfilled o rejected). Fail-closed — un `rejected` nunca se
 * traduce en acceso concedido. Testeable sin mockear Prisma: se le pueden
 * pasar `PromiseSettledResult` construidos a mano.
 */
export function buildHomeCapabilities(
  identity: { userId: number; email: string; isSuperAdmin: boolean },
  settled: SettledCapabilityInputs,
): HomeCapabilities {
  const failedParts: HomeCapabilityFailedPart[] = [];
  let incidentId: string | null = null;

  function fail(part: HomeCapabilityFailedPart, reason: unknown): void {
    failedParts.push(part);
    incidentId ??= randomUUID();
    logFotorankAccessFailure(part, incidentId, identity.userId, reason);
  }

  let participations: HomeParticipationSummary[] = [];
  if (settled.registrations.status === "fulfilled") {
    participations = settled.registrations.value.map((r) => ({
      id: r.id,
      contestTitle: r.contest.title,
      contestSlug: r.contest.slug,
      status: r.status,
      registrationNumber: r.registrationNumber,
    }));
  } else {
    fail("registrations", settled.registrations.reason);
  }

  let organizations: HomeOrganizationSummary[] = [];
  let organizerContests: HomeOrganizerContestSummary[] = [];
  if (settled.memberships.status === "fulfilled") {
    organizations = settled.memberships.value.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
    }));
    organizerContests = settled.memberships.value.flatMap((m) =>
      m.organization.contests.map((c) => ({
        id: c.id,
        title: c.title,
        slug: c.slug,
        organizationId: m.organization.id,
        organizationName: m.organization.name,
        status: c.status,
      })),
    );
  } else {
    fail("memberships", settled.memberships.reason);
  }

  let juryContests: HomeJuryContestSummary[] = [];
  let hasJuryAccount = false;
  if (settled.judgeAccount.status === "fulfilled") {
    const judgeAccount = settled.judgeAccount.value;
    const juryActive =
      Boolean(judgeAccount) &&
      (judgeAccount!.accountStatus === "ACTIVE" || judgeAccount!.accountStatus === "INVITED");
    hasJuryAccount = juryActive;
    if (juryActive && judgeAccount) {
      const byContest = new Map<string, HomeJuryContestSummary>();
      for (const a of judgeAccount.assignments) {
        if (!byContest.has(a.contestId)) {
          byContest.set(a.contestId, {
            contestId: a.contest.id,
            title: a.contest.title,
            slug: a.contest.slug,
            judgeAccountId: judgeAccount.id,
          });
        }
      }
      juryContests = [...byContest.values()];
    }
  } else {
    fail("judgeAccount", settled.judgeAccount.reason);
  }

  const hasParticipations = participations.length > 0;
  const hasOrganizations = organizations.length > 0;

  const kinds: Exclude<HomeCapabilityKind, "none">[] = [];
  if (hasParticipations) kinds.push("participant");
  if (hasOrganizations) kinds.push("organizer");
  if (hasJuryAccount) kinds.push("jury");
  // isSuperAdmin viene de globalRole (sesión ya resuelta), nunca de estas 3 consultas:
  // ninguna falla de DB puede otorgar ni retirar este flag.
  if (identity.isSuperAdmin) kinds.push("superAdmin");

  return {
    userId: identity.userId,
    email: identity.email,
    isSuperAdmin: identity.isSuperAdmin,
    hasParticipations,
    hasOrganizations,
    hasJuryAccount,
    participations,
    organizations,
    organizerContests,
    juryContests,
    kinds,
    degraded: failedParts.length > 0,
    failedParts,
    incidentId,
  };
}

/**
 * Ejecuta las 3 consultas de forma independiente. Envuelta en `cache()` de
 * React con SOLO argumentos primitivos (userId, email) — a propósito, no un
 * objeto: `cache()` indexa objetos por identidad de referencia (WeakMap) y
 * primitivos por valor (Map). Si esta función recibiera un objeto literal
 * `{userId, email}` distinto en cada call site, cada uno fallaría el cache
 * (referencias distintas aunque el contenido sea igual). Con primitivos,
 * `(home)/layout.tsx` y `mi-actividad/page.tsx` SÍ comparten una sola
 * ejecución real dentro del mismo request.
 */
const fetchHomeCapabilitiesSettled = cache(
  async (userId: number, email: string): Promise<SettledCapabilityInputs> => {
    const [registrations, memberships, judgeAccount] = await Promise.allSettled([
      prisma.fotorankContestRegistration.findMany({
        where: {
          participantUserId: userId,
          status: { notIn: ["CANCELLED", "DRAFT"] },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          status: true,
          registrationNumber: true,
          contest: { select: { title: true, slug: true } },
        },
      }),
      prisma.contestOrganizationMember.findMany({
        where: { userId, status: "ACTIVE" },
        select: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              contests: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  status: true,
                  organizationId: true,
                },
                orderBy: { createdAt: "desc" },
                take: 40,
              },
            },
          },
        },
      }),
      prisma.fotorankJudgeAccount.findUnique({
        where: { email },
        select: {
          id: true,
          accountStatus: true,
          assignments: {
            where: {
              assignmentStatus: {
                in: ["ASSIGNED", "ACCEPTED", "IN_PROGRESS", "EXTENDED"],
              },
            },
            select: {
              contestId: true,
              contest: { select: { id: true, title: true, slug: true } },
            },
            take: 40,
          },
        },
      }),
    ]);

    return { registrations, memberships, judgeAccount };
  },
);

/**
 * Punto de entrada público. Normaliza el email ANTES de llamar a la función
 * cacheada, para que la clave de cache sea consistente entre call sites
 * (mismo valor normalizado siempre, sin importar cómo llegó el email).
 */
export async function resolveHomeCapabilities(
  input: ResolveHomeCapabilitiesInput,
): Promise<HomeCapabilities> {
  const email = input.email.trim().toLowerCase();
  const isSuperAdmin =
    input.globalRole === "SUPER_ADMIN" || input.globalRole === "SUPERADMIN";

  const settled = await fetchHomeCapabilitiesSettled(input.userId, email);

  return buildHomeCapabilities({ userId: input.userId, email, isSuperAdmin }, settled);
}

/**
 * Destino post-login cuando no hay `next` seguro.
 * Multi-capacidad → hub personal. Una sola → panel directo.
 * degraded → siempre hub personal: es el único lugar que muestra el aviso
 * de "no pudimos confirmar toda tu actividad"; nunca mandamos a un panel
 * directo que asuma datos que no pudimos verificar.
 */
export function resolvePostLoginPath(caps: HomeCapabilities): string {
  const { kinds, degraded } = caps;

  if (degraded) {
    return "/mi-actividad";
  }

  if (kinds.length === 0) {
    return "/mi-actividad";
  }

  if (kinds.length === 1) {
    switch (kinds[0]) {
      case "participant":
        return "/participaciones";
      case "organizer":
        return "/dashboard";
      case "jury":
        // Sesión jurado sigue siendo independiente; aterriza en login jurado con next.
        return "/jurado/login?next=/jurado/panel";
      case "superAdmin":
        return "/mi-actividad";
      default:
        return "/mi-actividad";
    }
  }

  return "/mi-actividad";
}

export async function resolvePostLoginPathForUser(input: {
  userId: number;
  email: string;
  globalRole?: string | null;
  next?: string | null;
}): Promise<string> {
  if (input.next) return input.next;
  const caps = await resolveHomeCapabilities({
    userId: input.userId,
    email: input.email,
    globalRole: input.globalRole,
  });
  return resolvePostLoginPath(caps);
}
