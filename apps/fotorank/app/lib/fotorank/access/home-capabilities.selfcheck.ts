/**
 * Selfcheck ETAPA 09B — resolución de destinos post-login.
 *   pnpm --filter fotorank run test:access:home-capabilities
 */
import { resolvePostLoginPath, type HomeCapabilities } from "./home-capabilities";

function base(partial: Partial<HomeCapabilities>): HomeCapabilities {
  return {
    userId: 1,
    email: "t@fotorank.test",
    isSuperAdmin: false,
    hasParticipations: false,
    hasOrganizations: false,
    hasJuryAccount: false,
    participations: [],
    organizations: [],
    organizerContests: [],
    juryContests: [],
    kinds: [],
    degraded: false,
    failedParts: [],
    incidentId: null,
    ...partial,
  };
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
}

function main() {
  assert(
    resolvePostLoginPath(base({ kinds: ["participant"], hasParticipations: true })) ===
      "/participaciones",
    "participante solamente → /participaciones",
  );

  assert(
    resolvePostLoginPath(base({ kinds: ["organizer"], hasOrganizations: true })) ===
      "/dashboard",
    "organizador solamente → /dashboard",
  );

  assert(
    resolvePostLoginPath(base({ kinds: ["jury"], hasJuryAccount: true })).startsWith(
      "/jurado/login",
    ),
    "jurado solamente → /jurado/login",
  );

  assert(
    resolvePostLoginPath(
      base({
        kinds: ["participant", "jury"],
        hasParticipations: true,
        hasJuryAccount: true,
      }),
    ) === "/mi-actividad",
    "participante + jurado → /mi-actividad",
  );

  assert(
    resolvePostLoginPath(
      base({
        kinds: ["organizer", "jury"],
        hasOrganizations: true,
        hasJuryAccount: true,
      }),
    ) === "/mi-actividad",
    "organizador + jurado → /mi-actividad",
  );

  assert(
    resolvePostLoginPath(
      base({
        kinds: ["organizer", "participant"],
        hasOrganizations: true,
        hasParticipations: true,
      }),
    ) === "/mi-actividad",
    "organizador + participante → /mi-actividad",
  );

  assert(
    resolvePostLoginPath(base({ kinds: ["superAdmin"], isSuperAdmin: true })) ===
      "/mi-actividad",
    "super admin → /mi-actividad",
  );

  assert(
    resolvePostLoginPath(base({ kinds: [] })) === "/mi-actividad",
    "usuario sin permisos → /mi-actividad",
  );

  assert(
    resolvePostLoginPath(
      base({
        kinds: ["participant"],
        hasParticipations: true,
        degraded: true,
        failedParts: ["judgeAccount"],
        incidentId: "test-incident",
      }),
    ) === "/mi-actividad",
    "degraded (aunque haya una sola capacidad confirmada) → siempre /mi-actividad, nunca el panel directo",
  );

  console.log("FINAL: PASS");
}

main();
