/**
 * Selfcheck — comportamiento fail-closed de `buildHomeCapabilities`.
 *   pnpm --filter fotorank run test:access:home-capabilities-failclosed
 *
 * Prueba de regresión para el incidente de login: antes de esta corrección,
 * una excepción en cualquiera de las 3 consultas de `resolveHomeCapabilities`
 * se propagaba sin capturar y producía la pantalla genérica de error de
 * Next.js justo después de un login exitoso. Este archivo no toca la base:
 * construye a mano los `PromiseSettledResult` que Prisma produciría.
 */
import { buildHomeCapabilities } from "./home-capabilities";

function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
}

const identity = { userId: 1, email: "t@fotorank.test", isSuperAdmin: false };

const fulfilledRegistrations = {
  status: "fulfilled" as const,
  value: [
    {
      id: "reg-1",
      status: "CONFIRMED",
      registrationNumber: "SFE-000001",
      contest: { title: "Concurso Demo", slug: "concurso-demo" },
    },
  ],
};

const fulfilledMemberships = {
  status: "fulfilled" as const,
  value: [
    {
      organization: {
        id: "org-1",
        name: "Org Demo",
        slug: "org-demo",
        contests: [
          { id: "c-1", title: "Concurso Demo", slug: "concurso-demo", status: "PUBLISHED", organizationId: "org-1" },
        ],
      },
    },
  ],
};

const fulfilledJudgeAccount = {
  status: "fulfilled" as const,
  value: {
    id: "judge-1",
    accountStatus: "ACTIVE",
    assignments: [
      { contestId: "c-2", contest: { id: "c-2", title: "Concurso Jurado", slug: "concurso-jurado" } },
    ],
  },
};

const emptyFulfilledRegistrations = { status: "fulfilled" as const, value: [] };
const emptyFulfilledMemberships = { status: "fulfilled" as const, value: [] };
const emptyFulfilledJudgeAccount = { status: "fulfilled" as const, value: null };

function rejected(message: string) {
  return { status: "rejected" as const, reason: new Error(message) };
}

function main() {
  // 1) Las 3 consultas OK → resultado normal, sin degradación.
  {
    const caps = buildHomeCapabilities(identity, {
      registrations: fulfilledRegistrations,
      memberships: fulfilledMemberships,
      judgeAccount: fulfilledJudgeAccount,
    });
    ok(caps.degraded === false, "3 consultas OK → degraded=false");
    ok(caps.failedParts.length === 0, "3 consultas OK → failedParts vacío");
    ok(caps.incidentId === null, "3 consultas OK → incidentId null");
    ok(caps.hasParticipations === true, "3 consultas OK → hasParticipations true");
    ok(caps.hasOrganizations === true, "3 consultas OK → hasOrganizations true");
    ok(caps.hasJuryAccount === true, "3 consultas OK → hasJuryAccount true");
  }

  // 2) 0 filas (consulta exitosa, sin datos) NO es degradación.
  {
    const caps = buildHomeCapabilities(identity, {
      registrations: emptyFulfilledRegistrations,
      memberships: emptyFulfilledMemberships,
      judgeAccount: emptyFulfilledJudgeAccount,
    });
    ok(caps.degraded === false, "0 filas (fulfilled) → degraded=false, distinto de fallo");
    ok(caps.kinds.length === 0, "0 filas → kinds vacío");
  }

  // 3) Falla SOLO fotorankContestRegistration → fail-closed: sin participaciones,
  //    pero NO afecta organizerContests ni juryContests (no debe "explotar genéricamente").
  {
    const caps = buildHomeCapabilities(identity, {
      registrations: rejected("timeout"),
      memberships: fulfilledMemberships,
      judgeAccount: fulfilledJudgeAccount,
    });
    ok(caps.hasParticipations === false, "falla inscripción → hasParticipations false (fail-closed)");
    ok(caps.participations.length === 0, "falla inscripción → participations vacío, nunca datos parciales/inventados");
    ok(caps.degraded === true, "falla inscripción → degraded true");
    ok(
      caps.failedParts.length === 1 && caps.failedParts[0] === "registrations",
      "falla inscripción → failedParts=['registrations'] exactamente",
    );
    ok(typeof caps.incidentId === "string" && caps.incidentId.length > 0, "falla inscripción → incidentId generado");
    ok(caps.hasOrganizations === true, "falla inscripción NO debe tumbar hasOrganizations");
    ok(caps.hasJuryAccount === true, "falla inscripción NO debe tumbar hasJuryAccount");
  }

  // 4) Falla SOLO membership → fail-closed: nunca concede organizador por default.
  {
    const caps = buildHomeCapabilities(identity, {
      registrations: fulfilledRegistrations,
      memberships: rejected("connection reset"),
      judgeAccount: fulfilledJudgeAccount,
    });
    ok(caps.hasOrganizations === false, "falla membresía → hasOrganizations false (fail-closed, nunca true por fallback)");
    ok(caps.organizerContests.length === 0, "falla membresía → organizerContests vacío");
    ok(caps.failedParts[0] === "memberships", "falla membresía → failedParts=['memberships']");
  }

  // 5) Falla SOLO judgeAccount → fail-closed: nunca concede jurado por default.
  {
    const caps = buildHomeCapabilities(identity, {
      registrations: fulfilledRegistrations,
      memberships: fulfilledMemberships,
      judgeAccount: rejected("enum mismatch"),
    });
    ok(caps.hasJuryAccount === false, "falla jurado → hasJuryAccount false (fail-closed)");
    ok(caps.juryContests.length === 0, "falla jurado → juryContests vacío");
    ok(caps.failedParts[0] === "judgeAccount", "falla jurado → failedParts=['judgeAccount']");
  }

  // 6) Fallan las 3 → ningún permiso concedido, degraded=true, un solo incidentId compartido.
  {
    const caps = buildHomeCapabilities(identity, {
      registrations: rejected("db down"),
      memberships: rejected("db down"),
      judgeAccount: rejected("db down"),
    });
    ok(caps.kinds.length === 0, "falla total → kinds vacío (nunca se infiere acceso)");
    ok(caps.degraded === true, "falla total → degraded true");
    ok(caps.failedParts.length === 3, "falla total → failedParts tiene las 3 partes");
    ok(
      new Set(caps.failedParts).size === 3,
      "falla total → las 3 partes son distintas (registrations, memberships, judgeAccount)",
    );
    ok(typeof caps.incidentId === "string", "falla total → incidentId presente");
  }

  // 7) isSuperAdmin viene únicamente del globalRole de sesión, nunca de las 3 consultas:
  //    ninguna falla de DB puede otorgarlo ni retirarlo.
  {
    const superAdminIdentity = { ...identity, isSuperAdmin: true };
    const caps = buildHomeCapabilities(superAdminIdentity, {
      registrations: rejected("db down"),
      memberships: rejected("db down"),
      judgeAccount: rejected("db down"),
    });
    ok(caps.isSuperAdmin === true, "isSuperAdmin se mantiene aunque las 3 consultas fallen (viene de la sesión, no de estas queries)");
    ok(caps.kinds.includes("superAdmin"), "kinds incluye superAdmin pese a la falla total");
  }
  {
    const caps = buildHomeCapabilities(identity, {
      registrations: fulfilledRegistrations,
      memberships: fulfilledMemberships,
      judgeAccount: fulfilledJudgeAccount,
    });
    ok(caps.isSuperAdmin === false, "isSuperAdmin false no se convierte en true aunque las 3 consultas tengan éxito");
  }

  console.log("FINAL: PASS");
}

main();
