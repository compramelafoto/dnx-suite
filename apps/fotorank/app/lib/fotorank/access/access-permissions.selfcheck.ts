/**
 * Selfcheck ETAPA 11 — permisos scoped + Super Admin.
 *   pnpm --filter fotorank run test:access:permissions
 */
import { userIsFotorankSuperAdmin } from "./super-admin";
import { resolvePostLoginPath, type HomeCapabilities } from "./home-capabilities";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
}

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
    ...partial,
  };
}

function main() {
  assert(userIsFotorankSuperAdmin({ globalRole: "SUPER_ADMIN" }), "globalRole SUPER_ADMIN");
  assert(userIsFotorankSuperAdmin({ role: "SUPER_ADMIN" }), "legacy role SUPER_ADMIN");
  assert(!userIsFotorankSuperAdmin({ globalRole: "USER" }), "USER no es Super Admin");
  assert(!userIsFotorankSuperAdmin({ globalRole: null, role: "ORGANIZER" }), "ORGANIZER no es SA");

  assert(
    resolvePostLoginPath(base({ kinds: ["participant"], hasParticipations: true })) ===
      "/participaciones",
    "participant scoped → participaciones",
  );
  assert(
    resolvePostLoginPath(base({ kinds: ["organizer"], hasOrganizations: true })) === "/dashboard",
    "organizer scoped → dashboard",
  );
  assert(
    resolvePostLoginPath(base({ kinds: ["jury"], hasJuryAccount: true })).startsWith(
      "/jurado/login",
    ),
    "jury scoped → jurado login",
  );
  assert(
    resolvePostLoginPath(
      base({
        kinds: ["organizer", "participant", "jury"],
        hasOrganizations: true,
        hasParticipations: true,
        hasJuryAccount: true,
      }),
    ) === "/mi-actividad",
    "triple rol → mi-actividad",
  );
  assert(
    resolvePostLoginPath(base({ kinds: ["superAdmin"], isSuperAdmin: true })) === "/mi-actividad",
    "super admin → mi-actividad",
  );
  assert(resolvePostLoginPath(base({ kinds: [] })) === "/mi-actividad", "sin roles → hub vacío");

  console.log("FINAL: PASS");
}

main();
